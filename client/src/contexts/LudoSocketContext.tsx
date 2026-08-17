import { createContext, useContext, ReactNode } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../services/api";
import { RoomView } from "../types/ludo";

type Ack = { ok: boolean; error?: string; [key: string]: any };

// Envolve um emit em Promise usando o callback (ack) do Socket.IO, com timeout de
// segurança: se o servidor não responder em 6s (queda de rede, CORS, etc.), a
// Promise rejeita em vez de deixar a UI travada para sempre em "Conectando...".
function emitWithAck(socket: Socket | null, event: string, payload: any): Promise<Ack> {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error("Sem conexão com o servidor. Tente novamente em instantes."));
    }
    const timeout = setTimeout(() => reject(new Error("O servidor demorou para responder. Tente novamente.")), 6000);
    socket.emit(event, payload, (ack: Ack) => {
      clearTimeout(timeout);
      if (!ack || ack.ok === false) return reject(new Error(ack?.error || "Erro inesperado."));
      resolve(ack);
    });
  });
}

function useLudoSocketInternal() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [publicRooms, setPublicRooms] = useState<{ code: string; players: number; maxPlayers: number }[]>([]);
  const [presence, setPresence] = useState<{ userId: string; username: string; status: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastDice, setLastDice] = useState<{ userId: string; dice: number; movablePieces: string[] } | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<{ inviteId: string; fromUserId: string; fromUsername: string; expiresAt: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("playhub_token");
    if (!token) return;
    const s = io(API_URL, { auth: { token }, reconnectionAttempts: Infinity, timeout: 8000 });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      setConnectError(null);
      const savedCode = localStorage.getItem("playhub_room_code");
      if (savedCode) s.emit("room:join", { code: savedCode }, () => {});
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (err) => {
      setConnected(false);
      setConnectError(err.message === "unauthorized" ? "Sessão expirada, faça login novamente." : "Não foi possível conectar ao servidor.");
    });
    s.on("room:joined", (r: RoomView) => {
      setRoom(r);
      localStorage.setItem("playhub_room_code", r.code);
    });
    s.on("room:update", (r: RoomView) => setRoom(r));
    s.on("room:destroyed", (data?: { reason?: string }) => {
      setRoom(null);
      localStorage.removeItem("playhub_room_code");
      if (data?.reason === "TIMEOUT") {
        setErrorMsg("A sala foi cancelada automaticamente por ficar 2 minutos sem ninguém iniciar a partida.");
        setTimeout(() => setErrorMsg(null), 6000);
      }
    });
    s.on("game:started", (r: RoomView) => setRoom(r));
    s.on("game:state", (r: RoomView) => setRoom(r));
    s.on("game:paused", (r: RoomView) => setRoom(r));
    s.on("game:resumed", (r: RoomView) => setRoom(r));
    s.on("room:startVoteUpdate", (r: RoomView) => setRoom(r));
    s.on("game:endVoteUpdate", (r: RoomView) => setRoom(r));
    s.on("game:endedByConsensus", (r: RoomView) => {
      setRoom(r);
      localStorage.removeItem("playhub_room_code");
    });
    s.on("game:diceRolled", (d) => setLastDice(d));
    s.on("game:finished", (d) => {
      setWinner(d.winnerUserId);
      localStorage.removeItem("playhub_room_code");
    });
    s.on("rooms:list", (list) => setPublicRooms(list));
    s.on("presence:update", (list) => setPresence(list));
    s.on("invite:received", (data) => setIncomingInvite(data));
    s.on("invite:expired", () => setIncomingInvite(null));
    s.on("invite:declined", () => setErrorMsg("Convite recusado"));
    s.on("invite:accepted", (r: RoomView) => {
      setRoom(r);
      localStorage.setItem("playhub_room_code", r.code);
      setIncomingInvite(null);
    });
    s.on("error:message", (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 3500);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  function showError(err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado.";
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  const createRoom = useCallback(async () => {
    try {
      await emitWithAck(socketRef.current, "room:create", {});
    } catch (err) {
      showError(err);
    }
  }, []);

  const joinRoom = useCallback(async (code: string) => {
    try {
      await emitWithAck(socketRef.current, "room:join", { code });
    } catch (err) {
      showError(err);
    }
  }, []);

  const listRooms = useCallback(() => socketRef.current?.emit("rooms:list"), []);

  const startGame = useCallback(async (code: string) => {
    try {
      await emitWithAck(socketRef.current, "room:start", { code });
    } catch (err) {
      showError(err);
    }
  }, []);

  const cancelStartVote = useCallback(async (code: string) => {
    try {
      await emitWithAck(socketRef.current, "room:cancelStartVote", { code });
    } catch (err) {
      showError(err);
    }
  }, []);

  const addBot = useCallback(async (code: string) => {
    try {
      await emitWithAck(socketRef.current, "room:addBot", { code });
    } catch (err) {
      showError(err);
    }
  }, []);

  const removeBot = useCallback(async (code: string, botUserId: string) => {
    try {
      await emitWithAck(socketRef.current, "room:removeBot", { code, botUserId });
    } catch (err) {
      showError(err);
    }
  }, []);

  const rollDice = useCallback((code: string) => socketRef.current?.emit("game:rollDice", { code }), []);
  const movePiece = useCallback((code: string, pieceId: string) => socketRef.current?.emit("game:movePiece", { code, pieceId }), []);
  const pauseGame = useCallback((code: string) => socketRef.current?.emit("game:pause", { code }, () => {}), []);
  const resumeGame = useCallback((code: string) => socketRef.current?.emit("game:resume", { code }, () => {}), []);

  const requestEnd = useCallback(async (code: string) => {
    try { await emitWithAck(socketRef.current, "game:requestEnd", { code }); } catch (err) { showError(err); }
  }, []);
  const cancelEndVote = useCallback(async (code: string) => {
    try { await emitWithAck(socketRef.current, "game:cancelEndVote", { code }); } catch (err) { showError(err); }
  }, []);
  const forceEnd = useCallback(async (code: string) => {
    try { await emitWithAck(socketRef.current, "game:forceEnd", { code }); } catch (err) { showError(err); }
  }, []);

  // Feature 3.1: sair da sala (convidado) e cancelar sala (anfitrião)
  const leaveRoom = useCallback(async (code: string) => {
    localStorage.removeItem("playhub_room_code");
    setRoom(null);
    try {
      await emitWithAck(socketRef.current, "room:leave", { code });
    } catch (err) {
      showError(err);
    }
  }, []);

  const destroyRoom = useCallback(async (code: string) => {
    try {
      await emitWithAck(socketRef.current, "room:destroy", { code });
      localStorage.removeItem("playhub_room_code");
      setRoom(null);
    } catch (err) {
      showError(err);
    }
  }, []);

  const sendInvite = useCallback((toUserId: string) => socketRef.current?.emit("invite:send", { toUserId }), []);
  const acceptInvite = useCallback((inviteId: string) => socketRef.current?.emit("invite:accept", { inviteId }), []);
  const declineInvite = useCallback((inviteId: string) => {
    socketRef.current?.emit("invite:decline", { inviteId });
    setIncomingInvite(null);
  }, []);

  return {
    connected, connectError, room, publicRooms, presence, errorMsg, lastDice, winner, incomingInvite,
    createRoom, joinRoom, listRooms, startGame, cancelStartVote, addBot, removeBot, rollDice, movePiece, pauseGame, resumeGame,
    leaveRoom, destroyRoom, sendInvite, acceptInvite, declineInvite,
    requestEnd, cancelEndVote, forceEnd,
  };
}

type LudoSocketValue = ReturnType<typeof useLudoSocketInternal>;
const LudoSocketContext = createContext<LudoSocketValue | null>(null);

export function LudoSocketProvider({ children }: { children: ReactNode }) {
  const value = useLudoSocketInternal();
  return <LudoSocketContext.Provider value={value}>{children}</LudoSocketContext.Provider>;
}

export function useLudoSocket() {
  const ctx = useContext(LudoSocketContext);
  if (!ctx) throw new Error("useLudoSocket deve ser usado dentro de LudoSocketProvider");
  return ctx;
}
