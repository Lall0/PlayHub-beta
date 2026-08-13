import { createContext, useContext, ReactNode } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../services/api";
import { RoomView } from "../types/ludo";

function useLudoSocketInternal() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
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
    const s = io(API_URL, { auth: { token } });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      const savedCode = localStorage.getItem("playhub_room_code");
      if (savedCode) s.emit("room:join", { code: savedCode });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("room:joined", (r: RoomView) => {
      setRoom(r);
      localStorage.setItem("playhub_room_code", r.code);
    });
    s.on("room:update", (r: RoomView) => setRoom(r));
    s.on("game:started", (r: RoomView) => setRoom(r));
    s.on("game:state", (r: RoomView) => setRoom(r));
    s.on("game:paused", (r: RoomView) => setRoom(r));
    s.on("game:resumed", (r: RoomView) => setRoom(r));
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

  const createRoom = useCallback((maxPlayers: number) => socketRef.current?.emit("room:create", { maxPlayers }), []);
  const joinRoom = useCallback((code: string) => socketRef.current?.emit("room:join", { code }), []);
  const listRooms = useCallback(() => socketRef.current?.emit("rooms:list"), []);
  const startGame = useCallback((code: string) => socketRef.current?.emit("room:start", { code }), []);
  const rollDice = useCallback((code: string) => socketRef.current?.emit("game:rollDice", { code }), []);
  const movePiece = useCallback((code: string, pieceId: string) => socketRef.current?.emit("game:movePiece", { code, pieceId }), []);
  const pauseGame = useCallback((code: string) => socketRef.current?.emit("game:pause", { code }), []);
  const resumeGame = useCallback((code: string) => socketRef.current?.emit("game:resume", { code }), []);
  const leaveRoom = useCallback((code: string) => {
    localStorage.removeItem("playhub_room_code");
    socketRef.current?.emit("room:leave", { code });
  }, []);
  const sendInvite = useCallback((toUserId: string) => socketRef.current?.emit("invite:send", { toUserId }), []);
  const acceptInvite = useCallback((inviteId: string) => socketRef.current?.emit("invite:accept", { inviteId }), []);
  const declineInvite = useCallback((inviteId: string) => {
    socketRef.current?.emit("invite:decline", { inviteId });
    setIncomingInvite(null);
  }, []);

  return {
    connected, room, publicRooms, presence, errorMsg, lastDice, winner, incomingInvite,
    createRoom, joinRoom, listRooms, startGame, rollDice, movePiece, pauseGame, resumeGame, leaveRoom,
    sendInvite, acceptInvite, declineInvite,
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
