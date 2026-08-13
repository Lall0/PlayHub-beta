import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLudoSocket } from "../contexts/LudoSocketContext";
import Navbar from "../components/Navbar";
import LudoBoard from "../games/ludo/LudoBoard";
import Dice from "../games/ludo/Dice";
import { COLOR_HEX } from "../games/ludo/boardGeometry";
import { Color } from "../types/ludo";

export default function LudoPage() {
  const { user } = useAuth();
  const {
    connected, room, publicRooms, errorMsg, lastDice, winner,
    createRoom, joinRoom, listRooms, startGame, rollDice, movePiece, pauseGame, resumeGame,
  } = useLudoSocket();

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState("");
  const [rolling, setRolling] = useState(false);
  const [movable, setMovable] = useState<string[]>([]);

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

  if (!room) {
    return (
      <div>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-semibold text-white mb-1">🎲 Ludo</h1>
          <p className="text-white/40 text-sm mb-8">{connected ? "Conectado ao servidor em tempo real" : "Conectando..."}</p>

          {errorMsg && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-6">{errorMsg}</div>}

          <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-medium text-white/70 mb-4">COMO VOCÊ QUER JOGAR?</h2>
            <div className="flex gap-3 mb-4">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`px-4 py-2 rounded-lg text-sm border transition ${maxPlayers === n ? "bg-white text-black border-white" : "border-border text-white/60 hover:border-white/40"}`}
                >
                  {n} jogadores
                </button>
              ))}
            </div>
            <button onClick={() => createRoom(maxPlayers)} className="bg-white text-black font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-white/90 transition">
              CRIAR SALA
            </button>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-medium text-white/70 mb-4">ENTRAR COM CÓDIGO</h2>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="LUDO-XXXX"
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-white/30"
              />
              <button onClick={() => joinRoom(joinCode)} className="bg-surface-2 border border-border rounded-lg px-5 text-sm hover:border-white/40 transition">
                ENTRAR
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
                    <span className="text-white/80">{r.code}</span>
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

          <div className="bg-surface border border-border rounded-2xl p-5 space-y-2 mb-6">
            {room.players.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 text-sm py-1">
                <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-white/20"}`} />
                <span className="text-white/80">{p.username}</span>
                {p.userId === room.hostId && <span className="text-[10px] text-white/40 ml-auto">anfitrião</span>}
              </div>
            ))}
            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 text-white/30">
                <span className="w-2 h-2 rounded-full border border-white/20" /> Aguardando jogador...
              </div>
            ))}
          </div>

          <p className="text-white/40 text-sm mb-4">{room.players.length}/{room.maxPlayers} jogadores</p>

          {isHost ? (
            <button
              onClick={() => startGame(room.code)}
              disabled={room.players.length < 2}
              className="bg-white text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-white/90 transition disabled:opacity-40"
            >
              INICIAR PARTIDA
            </button>
          ) : (
            <p className="text-white/40 text-sm">Aguardando o anfitrião iniciar...</p>
          )}
        </div>
      </div>
    );
  }

  const state = room.state!;
  const currentPlayer = state.players[state.currentTurn];
  const isMyTurn = currentPlayer?.userId === user?.id;
  const canRoll = isMyTurn && !state.diceRolledThisTurn && room.status === "PLAYING";

  return (
    <div>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {!connected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm rounded-lg px-3 py-2 mb-4 text-center">
            CONEXÃO PERDIDA — Reconectando...
          </div>
        )}
        {errorMsg && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">{errorMsg}</div>}

        {winner && (
          <div className="bg-white text-black rounded-2xl p-4 mb-4 text-center font-semibold">
            🏆 {room.players.find((p) => p.userId === winner)?.username} venceu a partida!
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            {room.players.map((p) => (
              <div
                key={p.userId}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border ${p.userId === currentPlayer?.userId ? "border-white/60" : "border-border"}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: COLOR_HEX[p.color as Color] }} />
                {p.username}
                {p.userId === currentPlayer?.userId && <span className="text-white/40">turno</span>}
              </div>
            ))}
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
          </div>
        </div>

        {room.status === "PAUSED" && (
          <div className="text-center py-3 mb-4 bg-surface border border-border rounded-xl text-white/60 text-sm">PARTIDA PAUSADA</div>
        )}

        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
          <div className="bg-surface border border-border rounded-2xl p-4 w-full max-w-[560px]">
            <LudoBoard state={state} myColor={myPlayer?.color as Color} movablePieces={movable} onMovePiece={(id) => movePiece(room.code, id)} />
          </div>

          <div className="flex md:flex-col items-center gap-4">
            <Dice value={state.diceValue} rolling={rolling} canRoll={!!canRoll} onRoll={() => rollDice(room.code)} />
            <div className="text-center text-sm">
              {isMyTurn ? (
                <p className="text-white font-medium">{state.diceRolledThisTurn ? "Escolha uma peça" : "Seu turno — lance o dado"}</p>
              ) : (
                <p className="text-white/40">Vez de {room.players.find((p) => p.userId === currentPlayer?.userId)?.username}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
