import { Server, Socket } from "socket.io";
import { pool } from "../db";
import { verifyToken } from "../middleware/auth";
import {
  createInitialChessState,
  applyChessMove,
  advanceChessTurn,
  getLegalMoves,
  ChessState,
  PieceColor,
  PieceType,
} from "../games/chess/engine";

interface ChessRoom {
  code: string;
  hostId: string;
  status: "WAITING" | "PLAYING" | "FINISHED";
  players: { userId: string; username: string; socketId: string | null; color?: PieceColor }[];
  state?: ChessState;
  endVotes: Set<string>;
}

const rooms = new Map<string, ChessRoom>();

function genCode() {
  return "CHESS-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function ok(cb?: Function, payload: any = {}) {
  if (typeof cb === "function") cb({ ok: true, ...payload });
}
function fail(cb: Function | undefined, error: string) {
  if (typeof cb === "function") cb({ ok: false, error });
}

function publicView(room: ChessRoom) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({ userId: p.userId, username: p.username, color: p.color, connected: !!p.socketId })),
    state: room.state,
    endVotes: [...room.endVotes],
  };
}

export function registerChessSockets(io: Server) {
  const nsp = io.of("/chess");

  nsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));
    (socket as any).userId = payload.sub;
    next();
  });

  nsp.on("connection", async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const userResult = await pool.query("SELECT id, username FROM users WHERE id = $1", [userId]).catch(() => null);
    const user = userResult?.rows[0];
    if (!user) return socket.disconnect();

    socket.on("room:create", (_data: any, callback?: Function) => {
      const code = genCode();
      const room: ChessRoom = {
        code,
        hostId: userId,
        status: "WAITING",
        players: [{ userId, username: user.username, socketId: socket.id }],
        endVotes: new Set(),
      };
      rooms.set(code, room);
      socket.join(code);
      ok(callback, { room: publicView(room) });
    });

    socket.on("room:join", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room) return fail(callback, "Sala inexistente");
      if (room.players.find((p) => p.userId === userId)) {
        room.players = room.players.map((p) => (p.userId === userId ? { ...p, socketId: socket.id } : p));
        socket.join(code);
        return ok(callback, { room: publicView(room) });
      }
      if (room.status !== "WAITING") return fail(callback, "Partida já iniciada");
      if (room.players.length >= 2) return fail(callback, "Sala cheia");
      room.players.push({ userId, username: user.username, socketId: socket.id });
      socket.join(code);
      nsp.to(code).emit("room:update", publicView(room));
      ok(callback, { room: publicView(room) });
    });

    socket.on("room:start", (data: { code: string }, callback?: Function) => {
      const room = rooms.get(data.code);
      if (!room) return fail(callback, "Sala inexistente");
      if (room.hostId !== userId) return fail(callback, "Somente o anfitrião pode iniciar");
      if (room.players.length !== 2) return fail(callback, "São necessários 2 jogadores");

      const colors: PieceColor[] = Math.random() < 0.5 ? ["WHITE", "BLACK"] : ["BLACK", "WHITE"];
      room.players.forEach((p, i) => (p.color = colors[i]));
      room.status = "PLAYING";
      room.state = createInitialChessState(room.players.map((p) => ({ userId: p.userId, color: p.color! })));

      nsp.to(data.code).emit("game:started", publicView(room));
      ok(callback);
    });

    socket.on("game:legalMoves", ({ code, row, col }: { code: string; row: number; col: number }) => {
      const room = rooms.get(code);
      if (!room?.state) return;
      const current = room.state.players[room.state.currentTurn];
      const moves = getLegalMoves(room.state, current.color).filter((m) => m.from.row === row && m.from.col === col);
      socket.emit("game:legalMoves", { row, col, moves: moves.map((m) => m.to) });
    });

    socket.on(
      "game:move",
      ({ code, from, to, promotion }: { code: string; from: { row: number; col: number }; to: { row: number; col: number }; promotion?: PieceType }) => {
        const room = rooms.get(code);
        if (!room?.state || room.status !== "PLAYING") return;
        const current = room.state.players[room.state.currentTurn];
        if (current.userId !== userId) return socket.emit("error:message", "Não é o seu turno");

        try {
          const result = applyChessMove(room.state, from, to, promotion || "Q");
          room.state = result.state;

          if (result.isCheckmate || result.state.status === "DRAW" || result.isStalemate) {
            room.status = "FINISHED";
            nsp.to(code).emit("game:finished", {
              winnerUserId: room.state.winnerUserId,
              reason: result.isCheckmate ? "CHECKMATE" : result.isStalemate ? "STALEMATE" : "DRAW",
              state: room.state,
            });
            return;
          }

          advanceChessTurn(room.state);
          nsp.to(code).emit("game:state", publicView(room));
        } catch (err: any) {
          socket.emit("error:message", err.message || "Movimento inválido");
        }
      }
    );

    socket.on("game:requestEnd", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room || room.status !== "PLAYING") return fail(callback, "Não há partida em andamento");
      room.endVotes.add(userId);
      const allConfirmed = room.players.every((p) => room.endVotes.has(p.userId));
      if (allConfirmed) {
        room.status = "FINISHED";
        room.endVotes.clear();
        nsp.to(code).emit("game:endedByConsensus", publicView(room));
        setTimeout(() => rooms.delete(code), 60_000);
      } else {
        nsp.to(code).emit("game:endVoteUpdate", publicView(room));
      }
      ok(callback);
    });

    socket.on("game:cancelEndVote", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room) return fail(callback, "Sala inexistente");
      room.endVotes.delete(userId);
      nsp.to(code).emit("game:endVoteUpdate", publicView(room));
      ok(callback);
    });

    socket.on("game:forceEnd", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room) return fail(callback, "Sala inexistente");
      if (room.hostId !== userId) return fail(callback, "Somente o anfitrião pode forçar o encerramento");
      if (room.status !== "PLAYING") return fail(callback, "Não há partida em andamento");
      room.status = "FINISHED";
      room.endVotes.clear();
      nsp.to(code).emit("game:endedByConsensus", publicView(room));
      setTimeout(() => rooms.delete(code), 60_000);
      ok(callback);
    });

    socket.on("room:leave", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (room) {
        room.players = room.players.filter((p) => p.userId !== userId);
        if (room.players.length === 0) rooms.delete(code);
        else nsp.to(code).emit("room:update", publicView(room));
      }
      ok(callback);
    });

    socket.on("room:destroy", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room) return fail(callback, "Sala inexistente");
      if (room.hostId !== userId) return fail(callback, "Somente o anfitrião pode cancelar");
      if (room.status === "PLAYING") return fail(callback, "Não é possível cancelar partida em andamento");
      rooms.delete(code);
      nsp.to(code).emit("room:destroyed");
      ok(callback);
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        const p = room.players.find((pl) => pl.userId === userId);
        if (p) {
          p.socketId = null;
          nsp.to(room.code).emit("room:update", publicView(room));
        }
      }
    });
  });
}
