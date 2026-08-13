import { Server, Socket } from "socket.io";
import { pool, uuid } from "../db";
import { verifyToken } from "../middleware/auth";
import {
  createInitialState,
  rollDice,
  applyMove,
  advanceTurn,
  getMovablePieces,
  ALL_COLORS,
  Color,
  LudoState,
} from "../games/ludo/engine";

interface RoomMemory {
  code: string;
  hostId: string;
  maxPlayers: number;
  status: "WAITING" | "PLAYING" | "PAUSED" | "FINISHED";
  players: { userId: string; username: string; socketId: string | null; color?: Color; order: number }[];
  state?: LudoState;
  turnStartedAt?: number;
}

const rooms = new Map<string, RoomMemory>(); // key = room code
const onlineUsers = new Map<string, { username: string; socketId: string; status: string }>();

function genCode() {
  return "LUDO-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function publicRoomView(room: RoomMemory) {
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players.map((p) => ({ userId: p.userId, username: p.username, color: p.color, order: p.order, connected: !!p.socketId })),
    state: room.state,
  };
}

async function setUserStatus(userId: string, status: string) {
  await pool.query("UPDATE users SET status = $1, updated_at = now() WHERE id = $2", [status, userId]);
}

export function registerLudoSockets(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));
    (socket as any).userId = payload.sub;
    next();
  });

  io.on("connection", async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const userResult = await pool.query("SELECT id, username FROM users WHERE id = $1", [userId]);
    const user = userResult.rows[0];
    if (!user) return socket.disconnect();

    onlineUsers.set(userId, { username: user.username, socketId: socket.id, status: "ONLINE" });
    await setUserStatus(userId, "ONLINE");
    broadcastPresence(io);

    socket.on("rooms:list", () => {
      const list = [...rooms.values()]
        .filter((r) => r.status === "WAITING")
        .map((r) => ({ code: r.code, players: r.players.length, maxPlayers: r.maxPlayers }));
      socket.emit("rooms:list", list);
    });

    socket.on("room:create", async ({ maxPlayers }: { maxPlayers: number }) => {
      const mp = Math.min(4, Math.max(2, maxPlayers || 4));
      const code = genCode();
      const room: RoomMemory = {
        code,
        hostId: userId,
        maxPlayers: mp,
        status: "WAITING",
        players: [{ userId, username: user.username, socketId: socket.id, order: 0 }],
      };
      rooms.set(code, room);
      try {
        await pool.query(
          "INSERT INTO rooms (code, game_type, host_id, status, max_players) VALUES ($1, 'LUDO', $2, 'WAITING', $3)",
          [code, userId, mp]
        );
      } catch (err) {
        console.error("Erro ao criar sala no banco:", err);
      }
      socket.join(code);
      socket.emit("room:joined", publicRoomView(room));
      io.emit("rooms:updated");
    });

    socket.on("room:join", ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room) return socket.emit("error:message", "Sala inexistente");
      if (room.players.find((p) => p.userId === userId)) {
        room.players = room.players.map((p) => (p.userId === userId ? { ...p, socketId: socket.id } : p));
        socket.join(code);
        socket.emit("room:joined", publicRoomView(room));
        io.to(code).emit("room:update", publicRoomView(room));
        return;
      }
      if (room.status !== "WAITING") return socket.emit("error:message", "Partida já iniciada");
      if (room.players.length >= room.maxPlayers) return socket.emit("error:message", "Sala cheia");

      room.players.push({ userId, username: user.username, socketId: socket.id, order: room.players.length });
      socket.join(code);
      socket.emit("room:joined", publicRoomView(room));
      io.to(code).emit("room:update", publicRoomView(room));
      io.emit("rooms:updated");
    });

    socket.on("room:start", async ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      if (room.hostId !== userId) return socket.emit("error:message", "Somente o anfitrião pode iniciar");
      if (room.players.length < 2) return socket.emit("error:message", "Mínimo de 2 jogadores");

      const colors = shuffle([...ALL_COLORS]).slice(0, room.players.length);
      room.players.forEach((p, i) => (p.color = colors[i]));
      room.status = "PLAYING";
      room.state = createInitialState(room.players.map((p) => ({ userId: p.userId, color: p.color!, order: p.order })));
      room.turnStartedAt = Date.now();

      try {
        await pool.query("UPDATE rooms SET status = 'PLAYING', updated_at = now() WHERE code = $1", [code]);
        const roomRow = await pool.query("SELECT id FROM rooms WHERE code = $1", [code]);
        await pool.query(
          "INSERT INTO games (room_id, game_type, status, current_turn, state, started_at) VALUES ($1, 'LUDO', 'PLAYING', 0, $2, now())",
          [roomRow.rows[0].id, JSON.stringify(room.state)]
        );
        await Promise.all(room.players.map((p) => setUserStatus(p.userId, "IN_GAME")));
      } catch (err) {
        console.error("Erro ao iniciar jogo no banco:", err);
      }

      io.to(code).emit("game:started", publicRoomView(room));
    });

    socket.on("game:rollDice", ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room?.state || room.status !== "PLAYING") return;
      const current = room.state.players[room.state.currentTurn];
      if (current.userId !== userId) return socket.emit("error:message", "Não é o seu turno");
      if (room.state.diceRolledThisTurn) return socket.emit("error:message", "Dado já foi lançado neste turno");

      const dice = rollDice(); // servidor é a única fonte da verdade
      room.state.diceValue = dice;
      room.state.diceRolledThisTurn = true;

      const movable = getMovablePieces(room.state, current.color, dice);
      io.to(code).emit("game:diceRolled", { userId, dice, movablePieces: movable });

      if (movable.length === 0) {
        setTimeout(() => {
          advanceTurn(room.state!);
          io.to(code).emit("game:state", publicRoomView(room));
        }, 900);
      }
    });

    socket.on("game:movePiece", async ({ code, pieceId }: { code: string; pieceId: string }) => {
      const room = rooms.get(code);
      if (!room?.state || room.status !== "PLAYING") return;
      const current = room.state.players[room.state.currentTurn];
      if (current.userId !== userId) return socket.emit("error:message", "Não é o seu turno");
      if (!room.state.diceRolledThisTurn || room.state.diceValue == null) {
        return socket.emit("error:message", "Lance o dado primeiro");
      }
      try {
        const result = applyMove(room.state, pieceId, room.state.diceValue);
        room.state = result.state;

        if (room.state.status === "FINISHED") {
          room.status = "FINISHED";
          await finalizeGame(room);
          io.to(code).emit("game:finished", { winnerUserId: room.state.winnerUserId, state: room.state });
          return;
        }

        if (!result.extraTurn) advanceTurn(room.state);
        else {
          room.state.diceValue = null;
          room.state.diceRolledThisTurn = false;
        }
        io.to(code).emit("game:state", publicRoomView(room));
      } catch (e: any) {
        socket.emit("error:message", e.message || "Movimento inválido");
      }
    });

    socket.on("game:pause", ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || room.status !== "PLAYING") return;
      room.status = "PAUSED";
      io.to(code).emit("game:paused", publicRoomView(room));
    });

    socket.on("game:resume", ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || room.status !== "PAUSED") return;
      room.status = "PLAYING";
      io.to(code).emit("game:resumed", publicRoomView(room));
    });

    socket.on("invite:send", async ({ toUserId }: { toUserId: string }) => {
      const target = onlineUsers.get(toUserId);
      if (!target) return socket.emit("error:message", "Jogador não está online");

      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      let inviteId: string;
      try {
        const result = await pool.query(
          "INSERT INTO invitations (sender_id, receiver_id, game_type, status, expires_at) VALUES ($1, $2, 'LUDO', 'PENDING', $3) RETURNING id",
          [userId, toUserId, expiresAt]
        );
        inviteId = result.rows[0].id;
      } catch (err) {
        console.error("Erro ao criar convite:", err);
        return socket.emit("error:message", "Erro ao enviar convite");
      }

      io.to(target.socketId).emit("invite:received", {
        inviteId,
        fromUserId: userId,
        fromUsername: user.username,
        gameType: "LUDO",
        expiresAt,
      });
      socket.emit("invite:sent", { inviteId, toUserId });

      setTimeout(async () => {
        try {
          const row = await pool.query("SELECT status FROM invitations WHERE id = $1", [inviteId]);
          if (row.rows[0]?.status === "PENDING") {
            await pool.query("UPDATE invitations SET status = 'EXPIRED' WHERE id = $1", [inviteId]);
            io.to(target.socketId).emit("invite:expired", { inviteId });
            socket.emit("invite:expired", { inviteId });
          }
        } catch (err) {
          console.error("Erro ao expirar convite:", err);
        }
      }, 60_000);
    });

    socket.on("invite:accept", async ({ inviteId }: { inviteId: string }) => {
      const inviteResult = await pool.query("SELECT * FROM invitations WHERE id = $1", [inviteId]);
      const invite = inviteResult.rows[0];
      if (!invite || invite.status !== "PENDING") return socket.emit("error:message", "Convite expirado ou inválido");
      if (invite.receiver_id !== userId) return;
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        await pool.query("UPDATE invitations SET status = 'EXPIRED' WHERE id = $1", [inviteId]);
        return socket.emit("error:message", "Convite expirado");
      }

      const code = genCode();
      const room: RoomMemory = {
        code,
        hostId: invite.sender_id,
        maxPlayers: 2,
        status: "WAITING",
        players: [],
      };
      const sender = onlineUsers.get(invite.sender_id);
      const senderUserRow = await pool.query("SELECT username FROM users WHERE id = $1", [invite.sender_id]);
      room.players.push({
        userId: invite.sender_id,
        username: senderUserRow.rows[0]?.username || "?",
        socketId: sender?.socketId || null,
        order: 0,
      });
      room.players.push({ userId, username: user.username, socketId: socket.id, order: 1 });
      rooms.set(code, room);

      try {
        await pool.query(
          "INSERT INTO rooms (code, game_type, host_id, status, max_players) VALUES ($1, 'LUDO', $2, 'WAITING', 2)",
          [code, invite.sender_id]
        );
        await pool.query("UPDATE invitations SET status = 'ACCEPTED', room_code = $1 WHERE id = $2", [code, inviteId]);
      } catch (err) {
        console.error("Erro ao aceitar convite:", err);
      }

      socket.join(code);
      if (sender?.socketId) io.sockets.sockets.get(sender.socketId)?.join(code);

      io.to(code).emit("invite:accepted", publicRoomView(room));
      io.emit("rooms:updated");
    });

    socket.on("invite:decline", async ({ inviteId }: { inviteId: string }) => {
      const inviteResult = await pool.query("SELECT * FROM invitations WHERE id = $1", [inviteId]);
      const invite = inviteResult.rows[0];
      if (!invite || invite.receiver_id !== userId) return;
      await pool.query("UPDATE invitations SET status = 'DECLINED' WHERE id = $1", [inviteId]);
      const sender = onlineUsers.get(invite.sender_id);
      if (sender) io.to(sender.socketId).emit("invite:declined", { inviteId });
    });

    socket.on("room:leave", ({ code }: { code: string }) => handleLeave(io, code, userId, false));

    socket.on("disconnect", async () => {
      onlineUsers.delete(userId);
      await setUserStatus(userId, "OFFLINE");
      broadcastPresence(io);
      for (const room of rooms.values()) {
        const p = room.players.find((pl) => pl.userId === userId);
        if (p) {
          p.socketId = null;
          io.to(room.code).emit("room:update", publicRoomView(room));
          if (room.status === "PLAYING") {
            io.to(room.code).emit("player:disconnected", { userId });
          }
        }
      }
    });
  });
}

async function finalizeGame(room: RoomMemory) {
  if (!room.state) return;
  const winnerId = room.state.winnerUserId;
  try {
    for (const p of room.players) {
      await setUserStatus(p.userId, "ONLINE");
      const won = p.userId === winnerId;
      await pool.query(
        `UPDATE users SET games_played = games_played + 1, wins = wins + $1, losses = losses + $2 WHERE id = $3`,
        [won ? 1 : 0, won ? 0 : 1, p.userId]
      );
    }
    await pool.query(
      `UPDATE games SET status = 'FINISHED', state = $1, winner_id = $2, finished_at = now()
       WHERE room_id = (SELECT id FROM rooms WHERE code = $3)`,
      [JSON.stringify(room.state), winnerId || null, room.code]
    );
    await pool.query("UPDATE rooms SET status = 'FINISHED' WHERE code = $1", [room.code]);
  } catch (err) {
    console.error("Erro ao finalizar jogo:", err);
  }
  setTimeout(() => rooms.delete(room.code), 5 * 60 * 1000); // limpeza depois de 5min
}

function handleLeave(io: Server, code: string, userId: string, abandon: boolean) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.status === "PLAYING" && !abandon) {
    io.to(code).emit("error:message", "Não é possível sair durante a partida sem abandonar");
    return;
  }
  room.players = room.players.filter((p) => p.userId !== userId);
  if (room.players.length === 0) rooms.delete(code);
  else io.to(code).emit("room:update", publicRoomView(room));
}

function broadcastPresence(io: Server) {
  const list = [...onlineUsers.entries()].map(([userId, v]) => ({ userId, username: v.username, status: v.status }));
  io.emit("presence:update", list);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
