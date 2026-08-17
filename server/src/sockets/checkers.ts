import { Server, Socket } from "socket.io";
import { pool } from "../db";
import { getUsernameCached } from "../db/userCache";
import { verifyToken } from "../middleware/auth";
import {
  createInitialCheckersState,
  applyCheckersMove,
  advanceCheckersTurn,
  getLegalMoves,
  CheckersState,
  PieceColor,
} from "../games/checkers/engine";

interface CheckersRoom {
  code: string;
  hostId: string;
  status: "WAITING" | "PLAYING" | "PAUSED" | "FINISHED";
  players: { userId: string; username: string; socketId: string | null; color?: PieceColor }[];
  state?: CheckersState;
  endVotes: Set<string>;
  startVotes: Set<string>;
  createdAt: number;
  clockMs: Record<string, number>;
  turnStartedAt: number;
  clockInitialMs: number;
  coinFlip?: { result: "CARA" | "COROA"; winnerUserId: string };
}

const rooms = new Map<string, CheckersRoom>();

function genCode() {
  return "CHECKERS-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function ok(cb?: Function, payload: any = {}) {
  if (typeof cb === "function") cb({ ok: true, ...payload });
}
function fail(cb: Function | undefined, error: string) {
  if (typeof cb === "function") cb({ ok: false, error });
}

function publicView(room: CheckersRoom) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({ userId: p.userId, username: p.username, color: p.color, connected: !!p.socketId })),
    state: room.state,
    endVotes: [...room.endVotes],
    startVotes: [...room.startVotes],
    clockMs: room.clockMs,
    turnStartedAt: room.turnStartedAt,
    coinFlip: room.coinFlip,
  };
}

async function finalizeCheckersGame(room: CheckersRoom, winnerUserId: string | undefined) {
  try {
    for (const p of room.players) {
      const won = p.userId === winnerUserId;
      await pool.query(
        `UPDATE users SET games_played = games_played + 1, wins = wins + $1, losses = losses + $2 WHERE id = $3`,
        [won ? 1 : 0, won ? 0 : 1, p.userId]
      );
    }
    await pool.query(
      `UPDATE games SET status = 'FINISHED', state = $1, winner_id = $2, finished_at = now()
       WHERE room_id = (SELECT id FROM rooms WHERE code = $3)`,
      [JSON.stringify(room.state), winnerUserId || null, room.code]
    );
    await pool.query("UPDATE rooms SET status = 'FINISHED' WHERE code = $1", [room.code]);
  } catch (err) {
    console.error("Erro ao persistir fim de partida de damas:", err);
  }
}

export function registerCheckersSockets(io: Server) {
  const nsp = io.of("/checkers");

  // Sala sem ninguém confirmar início em 2 minutos: cancela sozinha
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.status === "WAITING" && now - room.createdAt > 2 * 60 * 1000) {
        rooms.delete(room.code);
        nsp.to(room.code).emit("room:destroyed", { reason: "TIMEOUT" });
        pool.query("UPDATE rooms SET status = 'ABANDONED' WHERE code = $1", [room.code]).catch(() => {});
      }
    }
  }, 15_000);

  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status !== "PLAYING" || !room.state) continue;
      const current = room.state.players[room.state.currentTurn];
      const base = room.clockMs[current.userId] ?? room.clockInitialMs;
      const remaining = base - (Date.now() - room.turnStartedAt);
      if (remaining <= 0) {
        room.status = "FINISHED";
        room.clockMs[current.userId] = 0;
        const winnerUserId = room.players.find((p) => p.userId !== current.userId)!.userId;
        finalizeCheckersGame(room, winnerUserId);
        nsp.to(room.code).emit("game:finished", { winnerUserId, reason: "TIMEOUT", state: room.state, clockMs: room.clockMs });
      }
    }
  }, 1000);

  nsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));
    (socket as any).userId = payload.sub;
    next();
  });

  nsp.on("connection", async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const username = await getUsernameCached(userId).catch(() => null);
    if (!username) return socket.disconnect();

    socket.on("room:create", (_data: any, callback?: Function) => {
      const code = genCode();
      const room: CheckersRoom = {
        code,
        hostId: userId,
        status: "WAITING",
        players: [{ userId, username: username, socketId: socket.id }],
        endVotes: new Set(),
        startVotes: new Set(),
        createdAt: Date.now(),
        clockMs: {},
        turnStartedAt: 0,
        clockInitialMs: 10 * 60 * 1000,
      };
      rooms.set(code, room);
      socket.join(code);
      pool
        .query("INSERT INTO rooms (code, game_type, host_id, status, max_players) VALUES ($1, 'CHECKERS', $2, 'WAITING', 2)", [code, userId])
        .catch((err) => console.error("Erro ao persistir sala de damas:", err));
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
      room.players.push({ userId, username: username, socketId: socket.id });
      socket.join(code);
      nsp.to(code).emit("room:update", publicView(room));
      ok(callback, { room: publicView(room) });
    });

    socket.on("room:start", (data: { code: string; clockMinutes?: number }, callback?: Function) => {
      const room = rooms.get(data.code);
      if (!room) return fail(callback, "Sala inexistente");
      if (!room.players.find((p) => p.userId === userId)) return fail(callback, "Você não está nesta sala");
      if (room.players.length !== 2) return fail(callback, "São necessários 2 jogadores");

      if (data.clockMinutes) room.clockInitialMs = Math.min(60, Math.max(1, data.clockMinutes)) * 60 * 1000;

      room.startVotes.add(userId);
      const allConfirmed = room.players.every((p) => room.startVotes.has(p.userId));

      if (!allConfirmed) {
        nsp.to(data.code).emit("room:startVoteUpdate", publicView(room));
        return ok(callback, { waiting: true });
      }

      room.startVotes.clear();

      const flipResult: "CARA" | "COROA" = Math.random() < 0.5 ? "CARA" : "COROA";
      const winnerIndex = flipResult === "CARA" ? 0 : 1;
      const winnerUserId = room.players[winnerIndex].userId;
      room.coinFlip = { result: flipResult, winnerUserId };

      nsp.to(data.code).emit("game:coinFlip", { result: flipResult, winnerUserId });
      ok(callback, { waiting: false });

      setTimeout(async () => {
        // Quem ganhou a moeda joga com DARK e começa (currentTurn = 0 sempre é o primeiro
        // jogador da lista, então colocamos o vencedor nessa posição)
        const orderedPlayers = winnerUserId === room.players[0].userId ? room.players : [room.players[1], room.players[0]];
        const colors: PieceColor[] = ["DARK", "LIGHT"];
        orderedPlayers.forEach((p, i) => (p.color = colors[i]));
        room.status = "PLAYING";
        room.state = createInitialCheckersState(orderedPlayers.map((p) => ({ userId: p.userId, color: p.color! })));
        room.clockMs = { [room.players[0].userId]: room.clockInitialMs, [room.players[1].userId]: room.clockInitialMs };
        room.turnStartedAt = Date.now();

        try {
          await pool.query("UPDATE rooms SET status = 'PLAYING', updated_at = now() WHERE code = $1", [data.code]);
          const roomRow = await pool.query("SELECT id FROM rooms WHERE code = $1", [data.code]);
          await pool.query(
            "INSERT INTO games (room_id, game_type, status, current_turn, state, started_at) VALUES ($1, 'CHECKERS', 'PLAYING', 0, $2, now())",
            [roomRow.rows[0].id, JSON.stringify(room.state)]
          );
        } catch (err) {
          console.error("Erro ao persistir início de partida de damas:", err);
        }

        nsp.to(data.code).emit("game:started", publicView(room));
      }, 2400);
    });

    socket.on("room:cancelStartVote", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room) return fail(callback, "Sala inexistente");
      room.startVotes.delete(userId);
      nsp.to(code).emit("room:startVoteUpdate", publicView(room));
      ok(callback);
    });

    socket.on("game:legalMoves", ({ code, pieceId }: { code: string; pieceId: string }) => {
      const room = rooms.get(code);
      if (!room?.state) return;
      const current = room.state.players[room.state.currentTurn];
      const allMoves = getLegalMoves(room.state, current.color);
      const moves = allMoves.filter((m) => m.pieceId === pieceId);
      const mandatoryCaptureElsewhere = moves.length === 0 && allMoves.some((m) => m.captured.length > 0);
      socket.emit("game:legalMoves", { pieceId, moves, mandatoryCaptureElsewhere });
    });

    socket.on("game:move", ({ code, pieceId, row, col }: { code: string; pieceId: string; row: number; col: number }) => {
      const room = rooms.get(code);
      if (!room?.state || room.status !== "PLAYING") return;
      const current = room.state.players[room.state.currentTurn];
      if (current.userId !== userId) return socket.emit("error:message", "Não é o seu turno");

      try {
        if (!room.clockMs[current.userId]) room.clockMs[current.userId] = room.clockInitialMs;
        const elapsed = Date.now() - room.turnStartedAt;
        room.clockMs[current.userId] = Math.max(0, room.clockMs[current.userId] - elapsed);
        if (room.clockMs[current.userId] <= 0) {
          room.status = "FINISHED";
          const winnerUserId = room.players.find((p) => p.userId !== current.userId)!.userId;
          finalizeCheckersGame(room, winnerUserId);
          nsp.to(code).emit("game:finished", { winnerUserId, reason: "TIMEOUT", state: room.state, clockMs: room.clockMs });
          return;
        }

        const result = applyCheckersMove(room.state, pieceId, { row, col });
        room.state = result.state;
        room.turnStartedAt = Date.now();

        if (room.state.status === "FINISHED") {
          room.status = "FINISHED";
          finalizeCheckersGame(room, room.state.winnerUserId);
          nsp.to(code).emit("game:finished", { winnerUserId: room.state.winnerUserId, reason: "NO_MOVES", state: room.state, clockMs: room.clockMs });
          return;
        }

        advanceCheckersTurn(room.state);
        nsp.to(code).emit("game:state", publicView(room));
      } catch (err: any) {
        socket.emit("error:message", err.message || "Movimento inválido");
      }
    });

    socket.on("game:pause", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room || room.status !== "PLAYING" || !room.state) return fail(callback, "Não é possível pausar agora");
      const current = room.state.players[room.state.currentTurn];
      room.clockMs[current.userId] = Math.max(0, (room.clockMs[current.userId] ?? room.clockInitialMs) - (Date.now() - room.turnStartedAt));
      room.status = "PAUSED";
      nsp.to(code).emit("game:paused", publicView(room));
      ok(callback);
    });

    socket.on("game:resume", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room || room.status !== "PAUSED") return fail(callback, "Não é possível retomar agora");
      room.status = "PLAYING";
      room.turnStartedAt = Date.now();
      nsp.to(code).emit("game:resumed", publicView(room));
      ok(callback);
    });

    socket.on("game:requestEnd", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (!room || (room.status !== "PLAYING" && room.status !== "PAUSED")) return fail(callback, "Não há partida em andamento");
      room.endVotes.add(userId);
      const allConfirmed = room.players.every((p) => room.endVotes.has(p.userId));
      if (allConfirmed) {
        room.status = "FINISHED";
        room.endVotes.clear();
        finalizeCheckersGame(room, undefined);
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
      if (room.status !== "PLAYING" && room.status !== "PAUSED") return fail(callback, "Não há partida em andamento");
      room.status = "FINISHED";
      room.endVotes.clear();
      finalizeCheckersGame(room, undefined);
      nsp.to(code).emit("game:endedByConsensus", publicView(room));
      setTimeout(() => rooms.delete(code), 60_000);
      ok(callback);
    });

    socket.on("room:leave", ({ code }: { code: string }, callback?: Function) => {
      const room = rooms.get(code);
      if (room) {
        room.players = room.players.filter((p) => p.userId !== userId);
        room.startVotes.delete(userId);
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
