import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLudoSocket } from "../contexts/LudoSocketContext";
import Navbar from "../components/Navbar";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { presence, incomingInvite, sendInvite, acceptInvite, declineInvite, room } = useLudoSocket();

  const others = presence.filter((p) => p.userId !== user?.id);

  useEffect(() => {
    if (room) navigate("/ludo");
  }, [room, navigate]);

  return (
    <div>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-white mb-8">Olá, {user?.username} 👋</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <GameCard emoji="♟" name="XADREZ" sub="2 jogadores" disabled />
          <GameCard emoji="◉" name="DAMAS" sub="2 jogadores" disabled />
          <GameCard emoji="🎲" name="LUDO" sub="2–4 jogadores" onClick={() => navigate("/ludo")} colorful />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-medium text-white/70 mb-4 tracking-wide">JOGADORES ONLINE</h2>
          {others.length === 0 ? (
            <p className="text-white/40 text-sm">Nenhum jogador online no momento.</p>
          ) : (
            <div className="space-y-2">
              {others.map((p) => (
                <div key={p.userId} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${p.status === "IN_GAME" ? "bg-yellow-400" : "bg-green-400"}`} />
                    {p.username}
                    {p.status === "IN_GAME" && <span className="text-white/40 text-xs">Em partida</span>}
                  </div>
                  <button
                    onClick={() => sendInvite(p.userId)}
                    disabled={p.status === "IN_GAME"}
                    className="text-xs px-3 py-1 rounded-full border border-border text-white/70 hover:text-white hover:border-white/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    CONVIDAR
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {incomingInvite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="text-3xl mb-2">🎲</div>
            <p className="text-white mb-6">
              <span className="font-semibold">{incomingInvite.fromUsername}</span> convidou você para jogar Ludo.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => declineInvite(incomingInvite.inviteId)}
                className="px-4 py-2 rounded-lg text-sm border border-border text-white/60 hover:border-white/40 transition"
              >
                RECUSAR
              </button>
              <button
                onClick={() => acceptInvite(incomingInvite.inviteId)}
                className="px-4 py-2 rounded-lg text-sm bg-white text-black font-semibold hover:bg-white/90 transition"
              >
                ACEITAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GameCard({ emoji, name, sub, onClick, disabled, colorful }: { emoji: string; name: string; sub: string; onClick?: () => void; disabled?: boolean; colorful?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-2xl border border-border p-6 text-left transition
        ${disabled ? "opacity-40 cursor-not-allowed bg-surface" : "bg-surface hover:border-white/30 hover:-translate-y-0.5"}`}
    >
      {colorful && !disabled && (
        <div className="absolute inset-0 opacity-10 bg-[conic-gradient(from_90deg,#e74c3c,#f1c40f,#27ae60,#2f80ed,#e74c3c)]" />
      )}
      <div className="relative">
        <div className="text-3xl mb-3">{emoji}</div>
        <div className="font-semibold text-white tracking-wide">{name}</div>
        <div className="text-xs text-white/40 mt-1">{sub}</div>
        {disabled && <div className="text-[10px] text-white/30 mt-2">em breve</div>}
      </div>
    </button>
  );
}
