import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    api.profile(username).then((d) => setProfile(d.user)).catch((e) => setError(e.message));
  }, [username]);

  const isOwnProfile = user?.username === username;

  return (
    <div>
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-16">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {profile && (
          <div className="bg-surface border border-border rounded-2xl p-6 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-surface-2 border border-border mx-auto mb-3 flex items-center justify-center text-2xl">
              {profile.username[0].toUpperCase()}
            </div>
            <h1 className="text-xl font-semibold text-white">@{profile.username}</h1>
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/50 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${profile.status === "ONLINE" ? "bg-green-400" : profile.status === "IN_GAME" ? "bg-yellow-400" : "bg-white/20"}`} />
              {profile.status === "ONLINE" ? "Online" : profile.status === "IN_GAME" ? "Em partida" : "Offline"}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <Stat label="Partidas" value={profile.games_played} />
              <Stat label="Vitórias" value={profile.wins} />
              <Stat label="Derrotas" value={profile.losses} />
            </div>
          </div>
        )}

        {isOwnProfile && <ChangePasswordCard />}
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword, confirm);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-6 space-y-3">
      <h2 className="text-sm font-medium text-white/70">Trocar senha</h2>
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-lg px-3 py-2">Senha alterada com sucesso.</div>}
      <input
        type="password"
        placeholder="Senha atual"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-white/30"
      />
      <input
        type="password"
        placeholder="Nova senha"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        minLength={6}
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-white/30"
      />
      <input
        type="password"
        placeholder="Confirmar nova senha"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-white/30"
      />
      <button
        disabled={loading}
        className="w-full bg-white text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-white/90 transition disabled:opacity-50"
      >
        {loading ? "Salvando..." : "SALVAR NOVA SENHA"}
      </button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl py-3">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[11px] text-white/40 mt-0.5">{label}</div>
    </div>
  );
}
