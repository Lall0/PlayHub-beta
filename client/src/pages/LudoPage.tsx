import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLudoSocket } from "../contexts/LudoSocketContext";
import Navbar from "../components/Navbar";
import LudoBoard from "../games/ludo/LudoBoard";
import Dice from "../games/ludo/Dice";
import { COLOR_HEX } from "../games/ludo/boardGeometry";
import { Color } from "../types/ludo";
import EndGameCard from "../components/EndGameCard";

const GLOW: Record<Color, string> = {
  RED: "rgba(231,76,60,0.28)",
  GREEN: "rgba(39,174,96,0.28)",
  YELLOW: "rgba(241,196,15,0.28)",
  BLUE: "rgba(47,128,237,0.28)",
};

export default function LudoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    connected, connectError, room, publicRooms, errorMsg, lastDice, winner,
    createRoom, joinRoom, listRooms, startGame, cancelStartVote, addBot, removeBot, rollDice, movePiece,
    pauseGame, resumeGame, leaveRoom, destroyRoom, requestEnd, cancelEndVote, forceEnd,
  } = useLudoSocket();

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [movable, setMovable] = useState<string[]>([]);
  const [showEndCard, setShowEndCard] = useState(false);

  useEffect(() => {
    if (!room) listRooms();
  }, [room, listRooms]);

  useEffect(() => {
    if (lastDice) {
      setRolling(true);
      const t = setTimeout(() => {
        setRolling(false);
        setMovable(lastDice.userId === user?.id ? lastDice.movablePieces : []);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [lastDice, user?.id]);

  useEffect(() => {
    if (room?.state?.diceRolledThisTurn === false) setMovable([]);
  }, [room?.state?.diceRolledThisTurn]);

  useEffect(() => {
    if (room?.status === "FINISHED") {
      setShowEndCard(false);
      const timer = setTimeout(() => {
        handleLeaveAndNav();
      }, 10000); // 10 segundos
      return () => clearTimeout(timer);
    }
  }, [room?.status]);

  async function handleJoinByCode() {
    if (!joinCode.trim()) return;
    setJoining(true);
    await joinRoom(joinCode.trim().toUpperCase());
    setJoining(false);
  }

  function handleLeaveAndNav() {
    if (room) {
      leaveRoom(room.code);
    }
    navigate('/');
  }

  function handleDestroyAndNav() {
    if (room) {
      destroyRoom(room.code);
    }
    navigate('/');
  }

  if (!room) {
    return (
      <div>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎲</span>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Ludo</h1>
          </div>
          <p className="text-white/40 text-sm mb-8">
            {connected ? "Conectado ao servidor em tempo real" : connectError || "Conectando..."}
          </p>

          {connectError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-6">
              {connectError} — tentando reconectar automaticamente...
            </div>
          )}
          {errorMsg && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-6">{errorMsg}</div>}

          <div className="bg-surface border border-border rounded-2xl p-6 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06] bg-[conic-gradient(from_90deg,#e74c3c,#f1c40f,#27ae60,#2f80ed,#e74c3c)] pointer-events-none" />
            <h2 className="text-sm font-medium text-white/70 mb-2 relative">CRIAR SALA</h2>
            <p className="text-white/40 text-xs mb-4 relative">
              Até 4 jogadores podem entrar. Quando quiserem começar, qualquer um propõe e todos confirmam.
            </p>
            <button
              onClick={() => createRoom()}
              disabled={!connected}
              className="relative bg-white text-black font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-white/90 transition disabled:opacity-40"
            >
              CRIAR SALA
            </button>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-medium text-white/70 mb-4">ENTRAR COM CÓDIGO</h2>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                placeholder="LUDO-XXXX"
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-white/30 font-mono"
              />
              <button
                onClick={handleJoinByCode}
                disabled={!connected || joining || !joinCode.trim()}
                className="bg-surface-2 border border-border rounded-lg px-5 text-sm hover:border-white/40 transition disabled:opacity-40"
              >
                {joining ? "ENTRANDO..." : "ENTRAR"}
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-sm font-medium text-white/70 mb-4">SALAS DE LUDO ABERTAS</h2>
            {publicRooms.length === 0 ? (
              <p className="text-white/40 text-sm">Nenhuma sala aberta no momento. Crie a sua!</p>
            ) : (
              <div className="space-y-2">
                {publicRooms.map((r) => (
                  <div key={r.code} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 text-sm">
                    <span className="text-white/80 font-mono">{r.code}</span>
                    <span className="text-white/40">{r.players}/{r.maxPlayers} jogadores</span>
                    <button onClick={() => joinRoom(r.code)} className="text-xs px-3 py-1 rounded-full border border-border hover:border-white/40 transition">
                      ENTRAR
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const myPlayer = room.players.find((p) => p.userId === user?.id);
  const isHost = room.hostId === user?.id;

  if (room.status === "WAITING") {
    return (
      <div>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-2">🎲</div>
          <h1 className="text-xl font-semibold text-white mb-1">Sala de Ludo</h1>
          <p className="text-white/40 text-sm mb-6">
            Código: <span className="text-white font-mono">{room.code}</span>{" "}
            <button onClick={() => navigator.clipboard.writeText(room.code)} className="underline hover:text-white ml-1">copiar</button>
          </p>

          {errorMsg && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">{errorMsg}</div>}

          <div className="bg-surface border border-border rounded-2xl p-5 space-y-2 mb-4">
            {room.players.map((p) => {
              const confirmed = (room.startVotes || []).includes(p.userId);
              return (
                <div key={p.userId} className="flex items-center gap-2 text-sm py-1">
                  <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-white/20"}`} />
                  <span className="text-white/80">{p.username}{p.isBot ? " 🤖" : ""}</span>
                  {p.userId === room.hostId && <span className="text-[10px] text-white/40 ml-1">anfitrião</span>}
                  {(confirmed || p.isBot) && <span className="text-[10px] text-green-400 ml-auto">✓ pronto</span>}
                  {isHost && p.isBot && (
                    <button onClick={() => removeBot(room.code, p.userId)} className="text-[10px] text-white/40 hover:text-red-400 transition">
                      remover
                    </button>
                  )}
                </div>
              );
            })}
            {room.players.length < 4 && (
              <div className="flex items-center gap-2 text-sm py-1 text-white/30">
                <span className="w-2 h-2 rounded-full border border-white/20" /> Compartilhe o código para mais pessoas entrarem...
              </div>
            )}
          </div>

          <p className="text-white/40 text-sm mb-4">{room.players.length}/4 jogadores — todos precisam confirmar pra começar</p>

          <div className="flex flex-col gap-2 items-center">
            {isHost && room.players.length < 4 && (
              <button
                onClick={() => addBot(room.code)}
                className="text-xs px-4 py-2 rounded-lg border border-border text-white/70 hover:border-white/40 transition"
              >
                🤖 ADICIONAR BOT
              </button>
            )}

            {(room.startVotes || []).includes(user?.id || "") ? (
              <button
                onClick={() => cancelStartVote(room.code)}
                disabled={room.players.length < 2}
                className="border border-border text-white/70 rounded-lg px-6 py-2.5 text-sm hover:border-white/40 transition disabled:opacity-40"
              >
                Cancelar minha confirmação
              </button>
            ) : (
              <button
                onClick={() => startGame(room.code)}
                disabled={room.players.length < 2}
                className="bg-white text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-white/90 transition disabled:opacity-40"
              >
                {room.players.length < 2 ? "AGUARDANDO MAIS JOGADORES" : "PRONTO PARA COMEÇAR"}
              </button>
            )}

            {isHost ? (
              <button
                onClick={handleDestroyAndNav}
                className="text-xs text-white/40 hover:text-red-400 transition mt-2"
              >
                Cancelar sala
              </button>
            ) : (
              <button
                onClick={handleLeaveAndNav}
                className="text-xs text-white/40 hover:text-red-400 transition mt-2"
              >
                Sair da sala
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const state = room.state!;
  const currentPlayer = state.players[state.currentTurn];
  const currentColor = currentPlayer?.color as Color | undefined;
  const isMyTurn = currentPlayer?.userId === user?.id;
  const canRoll = isMyTurn && !state.diceRolledThisTurn && room.status === "PLAYING";

  const humanPlayers = room.players.filter((p) => !p.isBot);
  const votes = room.endVotes || [];

  return (
    <div
      className="min-h-[calc(100vh-56px)] transition-[background] duration-700"
      style={{
        background: currentColor && room.status !== 'FINISHED'
          ? `radial-gradient(ellipse at 50% 0%, ${GLOW[currentColor]}, transparent 60%), var(--color-bg)`
          : "var(--color-bg)",
      }}
    >
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {!connected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm rounded-lg px-3 py-2 mb-4 text-center">
            CONEXÃO PERDIDA — Reconectando...
          </div>
        )}
        {errorMsg && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">{errorMsg}</div>}

        {room.status === "FINISHED" && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 text-center">
            {winner ? (
              <p className="text-white font-semibold">🏆 {room.players.find((p) => p.userId === winner)?.username} venceu a partida!</p>
            ) : (
              <p className="text-white/80 text-sm font-medium">Partida encerrada por acordo entre os jogadores.</p>
            )}
            <p className="text-xs text-white/50 mt-1">Você será redirecionado em breve...</p>
            <button onClick={handleLeaveAndNav} className="block mx-auto mt-2 text-xs underline">
              Sair agora
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            {room.players.map((p) => {
              const isTurn = p.userId === currentPlayer?.userId && room.status === "PLAYING";
              return (
                <div
                  key={p.userId}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all ${isTurn ? "border-white/70 bg-white/5 turn-active" : "border-border"}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: COLOR_HEX[p.color as Color] }} />
                  {p.username}{p.isBot ? " 🤖" : ""}
                  {isTurn && <span className="text-white/40">turno</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            {room.status === "PLAYING" && (
              <button onClick={() => pauseGame(room.code)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-white/40 transition">
                ⏸ PAUSAR
              </button>
            )}
            {room.status === "PAUSED" && (
              <button onClick={() => resumeGame(room.code)} className="text-xs px-3 py-1.5 rounded-full border border-white/40 bg-white text-black transition">
                RETOMAR
              </button>
            )}
            {(room.status === "PLAYING" || room.status === "PAUSED") && (
              <button
                onClick={() => setShowEndCard(true)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-white/50 hover:text-red-400 hover:border-red-400/40 transition"
              >
                Encerrar partida
              </button>
            )}
            {room.status === "FINISHED" && (
              <button
                onClick={handleLeaveAndNav}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-white/50 hover:text-red-400 hover:border-red-400/40 transition"
              >
                Sair
              </button>
            )}
          </div>
        </div>

        {room.status === "PAUSED" && (
          <div className="text-center py-3 mb-4 bg-surface border border-border rounded-xl text-white/60 text-sm">PARTIDA PAUSADA</div>
        )}

        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
          <div
            className="rounded-[28px] p-3 w-full max-w-[580px]"
            style={{
              background: "linear-gradient(160deg, var(--color-arena-wood-light), var(--color-arena-wood))",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.08)",
            }}
          >
            <div className="bg-[color:var(--color-arena-felt)] rounded-3xl p-4">
              <LudoBoard state={state} myColor={myPlayer?.color as Color} movablePieces={movable} onMovePiece={(id) => movePiece(room.code, id)} />
            </div>
          </div>

          <div className="flex md:flex-col items-center gap-4">
            <Dice value={state.diceValue} rolling={rolling} canRoll={!!canRoll} onRoll={() => rollDice(room.code)} />
            <div className="text-center text-sm">
              {isMyTurn ? (
                <p className="text-white font-medium">{state.diceRolledThisTurn ? "Escolha uma peça" : "Seu turno — lance o dado"}</p>
              ) : (
                <p className="text-white/40">Vez de {room.players.find((p) => p.userId === currentPlayer?.userId)?.username}{room.players.find((p) => p.userId === currentPlayer?.userId)?.isBot ? " 🤖" : ""}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEndCard && (
        <EndGameCard
          players={humanPlayers}
          endVotes={votes}
          myUserId={user?.id}
          isHost={isHost}
          onConfirm={() => requestEnd(room.code)}
          onCancelVote={() => cancelEndVote(room.code)}
          onForceEnd={() => forceEnd(room.code)}
          onClose={() => setShowEndCard(false)}
        />
      )}
    </div>
  );
}
