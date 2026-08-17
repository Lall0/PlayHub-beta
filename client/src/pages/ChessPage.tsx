import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import ChessBoard from "../games/chess/ChessBoard";
import EndGameCard from "../components/EndGameCard";
import CoinFlip from "../components/CoinFlip";
import ClockDisplay from "../components/ClockDisplay";

interface RoomView {
  code: string;
  hostId: string;
  status: "WAITING" | "PLAYING" | "PAUSED" | "FINISHED";
  players: { userId: string; username: string; color?: "WHITE" | "BLACK"; connected: boolean }[];
  state?: any;
  endVotes?: string[];
  startVotes?: string[];
  clockMs?: Record<string, number>;
  turnStartedAt?: number;
  coinFlip?: { result: "CARA" | "COROA"; winnerUserId: string };
}

export default function ChessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<{ row: number; col: number }[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const [endedByConsensus, setEndedByConsensus] = useState(false);
  const [showEndCard, setShowEndCard] = useState(false);
  const [coinFlipping, setCoinFlipping] = useState<{ result: "CARA" | "COROA" | null; winnerUserId: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("playhub_token");
    if (!token) return;
    const s = io(`${API_URL}/chess`, { auth: { token } });
    socketRef.current = s;
    s.on("room:update", (r) => setRoom(r));
    s.on("game:coinFlip", (d) => {
      setCoinFlipping({ result: null, winnerUserId: d.winnerUserId });
      setTimeout(() => setCoinFlipping({ result: d.result, winnerUserId: d.winnerUserId }), 1200);
    });
    s.on("game:started", (r) => {
      setRoom(r);
      setTimeout(() => setCoinFlipping(null), 1000);
    });
    s.on("game:state", (r) => { setRoom(r); setSelected(null); setLegalDestinations([]); });
    s.on("game:legalMoves", (d) => setLegalDestinations(d.moves));
    s.on("game:finished", (d) => {
      setWinner(d.winnerUserId || null);
      setFinishReason(d.reason);
      setRoom((r) => (r ? { ...r, state: d.state, status: "FINISHED" } : r));
    });
    s.on("room:destroyed", (data?: { reason?: string }) => {
      setRoom(null);
      if (data?.reason === "TIMEOUT") {
        setError("A sala foi cancelada automaticamente por ficar 2 minutos sem ninguém iniciar a partida.");
        setTimeout(() => setError(null), 6000);
      }
    });
    s.on("room:startVoteUpdate", (r) => setRoom(r));
    s.on("game:paused", (r) => setRoom(r));
    s.on("game:resumed", (r) => setRoom(r));
    s.on("game:endVoteUpdate", (r) => setRoom(r));
    s.on("game:endedByConsensus", (r) => { setRoom(r); setEndedByConsensus(true); setShowEndCard(false); });
    s.on("error:message", (msg) => { setError(msg); setTimeout(() => setError(null), 3500); });
    return () => { s.disconnect(); };
  }, []);

  function emitAck(event: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Sem resposta do servidor")), 6000);
      socketRef.current?.emit(event, payload, (ack: any) => { clearTimeout(t); ack?.ok ? resolve(ack) : reject(new Error(ack?.error || "Erro")); });
    });
  }

  async function createRoom() {
    try { const ack = await emitAck("room:create", {}); setRoom(ack.room); } catch (e: any) { setError(e.message); }
  }
  async function joinRoom() {
    if (!joinCode.trim()) return;
    try { const ack = await emitAck("room:join", { code: joinCode.trim().toUpperCase() }); setRoom(ack.room); } catch (e: any) { setError(e.message); }
  }
  async function startGame() {
    try { await emitAck("room:start", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }
  async function cancelStartVote() {
    try { await emitAck("room:cancelStartVote", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }
  async function leaveRoom() {
    try { await emitAck("room:leave", { code: room!.code }); } catch {}
    setRoom(null);
    navigate("/");
  }
  async function destroyRoom() {
    try { await emitAck("room:destroy", { code: room!.code }); } catch (e: any) { setError(e.message); }
    setRoom(null);
    navigate("/");
  }
  async function requestEnd() {
    try { await emitAck("game:requestEnd", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }
  async function pauseGame() {
    try { await emitAck("game:pause", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }
  async function resumeGame() {
    try { await emitAck("game:resume", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }
  async function cancelEndVote() {
    try { await emitAck("game:cancelEndVote", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }
  async function forceEnd() {
    try { await emitAck("game:forceEnd", { code: room!.code }); } catch (e: any) { setError(e.message); }
  }

  function selectSquare(row: number, col: number) {
    if (!room?.state) return;
    const piece = room.state.board[row][col];
    const myPlayer = room.players.find((p) => p.userId === user?.id);

    if (selected && selected.row === row && selected.col === col) {
      setSelected(null);
      setLegalDestinations([]);
      return;
    }

    if (piece && piece.color === myPlayer?.color) {
      setSelected({ row, col });
      socketRef.current?.emit("game:legalMoves", { code: room.code, row, col });
      return;
    }

    if (selected) {
      moveTo(row, col);
    }
  }

  function moveTo(row: number, col: number) {
    if (!selected || !room) return;

    // SOLUÇÃO DO XADREZ: Interceptando a chamada errada do tabuleiro!
    // Se o clique caiu aqui, mas o jogador clicou numa peça PRÓPRIA,
    // nós fazemos a troca de seleção em vez de tentar realizar um movimento fantasma.
    const piece = room.state.board[row][col];
    const myPlayer = room.players.find((p) => p.userId === user?.id);

    if (piece && piece.color === myPlayer?.color) {
      setSelected({ row, col });
      socketRef.current?.emit("game:legalMoves", { code: room.code, row, col });
      return;
    }

    // Se não for uma peça própria, emite o movimento normalmente
    socketRef.current?.emit("game:move", { code: room.code, from: selected, to: { row, col } });
  }

  if (!room) {
    return (
      <div>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-2">♟️</div>
          <h1 className="text-xl font-semibold text-white mb-1">Xadrez</h1>
          <p className="text-white/40 text-sm mb-6">Regras completas: roque, en passant, promoção, xeque-mate.</p>
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
          <div className="space-y-4">
            <button onClick={createRoom} className="w-full bg-white text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-white/90 transition">
              CRIAR SALA
            </button>
            <div className="flex gap-2">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="CÓDIGO DA SALA"
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-white/30" />
              <button onClick={joinRoom} className="bg-surface-2 border border-border rounded-lg px-5 text-sm hover:border-white/40 transition">ENTRAR</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isHost = room.hostId === user?.id;

  if (room.status === "WAITING") {
    return (
      <div>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-2">♟️</div>
          <h1 className="text-xl font-semibold text-white mb-1">Sala de Xadrez</h1>
          <p className="text-white/40 text-sm mb-6">
            Código: <span className="text-white font-mono">{room.code}</span>{" "}
            <button onClick={() => navigator.clipboard.writeText(room.code)} className="underline hover:text-white ml-1">copiar</button>
          </p>
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-2 mb-4">
            {room.players.map((p) => {
              const confirmed = (room.startVotes || []).includes(p.userId);
              return (
                <div key={p.userId} className="flex items-center gap-2 text-sm py-1">
                  <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-white/20"}`} />
                  {p.username}
                  {p.userId === room.hostId && <span className="text-[10px] text-white/40 ml-1">anfitrião</span>}
                  {confirmed && <span className="text-[10px] text-green-400 ml-auto">✓ pronto</span>}
                </div>
              );
            })}
            {room.players.length < 2 && <div className="text-white/30 text-sm py-1">Aguardando jogador...</div>}
          </div>

          {(room.startVotes || []).includes(user?.id || "") ? (
            <button
              onClick={cancelStartVote}
              disabled={room.players.length < 2}
              className="border border-border text-white/70 rounded-lg px-6 py-2.5 text-sm hover:border-white/40 transition disabled:opacity-40"
            >
              Cancelar minha confirmação
            </button>
          ) : (
            <button
              onClick={startGame}
              disabled={room.players.length < 2}
              className="bg-white text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-white/90 transition disabled:opacity-40"
            >
              {room.players.length < 2 ? "AGUARDANDO ADVERSÁRIO" : "PRONTO PARA COMEÇAR"}
            </button>
          )}
          <div>
            <button onClick={isHost ? destroyRoom : leaveRoom} className="text-xs text-white/40 hover:text-red-400 transition mt-4">
              {isHost ? "Cancelar sala" : "Sair da sala"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const state = room.state;
  const myPlayer = room.players.find((p) => p.userId === user?.id);
  const currentPlayer = state.players[state.currentTurn];
  const isMyTurn = currentPlayer?.userId === user?.id;
  const inCheckColor = state.status === "CHECK" || state.status === "CHECKMATE" ? currentPlayer?.color : null;

  return (
    <div>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
        {room.status === "FINISHED" && (
          <div className="bg-white text-black rounded-2xl p-4 mb-4 text-center font-semibold">
            {winner ? `🏆 ${room.players.find((p) => p.userId === winner)?.username} venceu por ${finishReason === "CHECKMATE" ? "xeque-mate" : finishReason}!` : `Empate (${finishReason === "STALEMATE" ? "afogamento" : "regra dos 50 lances"})`}
            <button onClick={leaveRoom} className="block mx-auto mt-2 text-xs underline">Voltar ao início</button>
          </div>
        )}
        {room.status === "FINISHED" && endedByConsensus && !winner && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 text-center">
            <p className="text-white/80 text-sm font-medium">Partida encerrada por acordo entre os jogadores.</p>
            <button onClick={leaveRoom} className="block mx-auto mt-2 text-xs underline text-white/50">Voltar ao início</button>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/70 text-sm">
            {state.status === "CHECK" && "Xeque! "}
            {isMyTurn ? "Seu turno" : `Vez de ${room.players.find((p) => p.userId === currentPlayer?.userId)?.username}`}
          </p>
          <div className="flex gap-2">
            {room.status === "PLAYING" && (
              <>
                <button onClick={pauseGame} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-white/40 transition">⏸ Pausar</button>
                <button onClick={() => setShowEndCard(true)} className="text-xs px-3 py-1.5 rounded-full border border-border text-white/50 hover:text-red-400 hover:border-red-400/40 transition">
                  Encerrar partida
                </button>
              </>
            )}
            {room.status === "PAUSED" && (
              <button onClick={resumeGame} className="text-xs px-3 py-1.5 rounded-full border border-white/40 bg-white text-black transition">Retomar</button>
            )}
            <button onClick={leaveRoom} className="text-xs px-3 py-1.5 rounded-full border border-border text-white/50 hover:text-red-400 hover:border-red-400/40 transition">Sair</button>
          </div>
        </div>

        {room.status === "PAUSED" && (
          <div className="text-center py-3 mb-4 bg-surface border border-border rounded-xl text-white/60 text-sm">PARTIDA PAUSADA</div>
        )}

        <div className="flex justify-center gap-3 mb-4">
          {room.players.map((p) => (
            <ClockDisplay
              key={p.userId}
              clockMs={room.clockMs}
              turnStartedAt={room.turnStartedAt}
              userId={p.userId}
              isCurrentTurn={p.userId === currentPlayer?.userId}
              active={room.status === "PLAYING"}
              label={p.username}
            />
          ))}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4">
          <ChessBoard
            board={state.board}
            myColor={myPlayer?.color}
            selected={selected}
            legalDestinations={isMyTurn ? legalDestinations : []}
            lastMove={state.lastMove}
            inCheckColor={inCheckColor}
            onSelect={isMyTurn ? selectSquare : () => {}}
            onMoveTo={isMyTurn ? moveTo : () => {}}
          />
        </div>
      </div>

      {coinFlipping && (
        <CoinFlip
          result={coinFlipping.result}
          winnerName={room.players.find((p) => p.userId === coinFlipping.winnerUserId)?.username || null}
        />
      )}

      {showEndCard && (
        <EndGameCard
          players={room.players}
          endVotes={room.endVotes || []}
          myUserId={user?.id}
          isHost={isHost}
          onConfirm={requestEnd}
          onCancelVote={cancelEndVote}
          onForceEnd={forceEnd}
          onClose={() => setShowEndCard(false)}
        />
      )}
    </div>
  );
}