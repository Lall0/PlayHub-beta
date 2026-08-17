import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import Navbar from "../components/Navbar";

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function loadUsers() {
    api.adminUsers().then((u) => setUsers(u.users)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    Promise.all([api.adminStats(), api.adminUsers(), api.adminRooms(), api.adminGames()])
      .then(([s, u, r, g]) => {
        setStats(s);
        setUsers(u.users);
        setRooms(r.rooms);
        setGames(g.games);
      })
      .catch((e) => setError(e.message));
  }, [user]);

  async function handleBan(userId: string) {
    setActionLoading(userId);
    try {
      await api.adminBanUser(userId);
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnban(userId: string) {
    setActionLoading(userId);
    try {
      await api.adminUnbanUser(userId);
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetPassword(userId: string, username: string) {
    const newPassword = window.prompt(`Nova senha para @${username} (mínimo 6 caracteres):`);
    if (!newPassword) return;
    setActionLoading(userId);
    try {
      await api.adminResetPassword(userId, newPassword);
      window.alert(`Senha de @${username} redefinida com sucesso.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (user && user.role !== "ADMIN") return <Navigate to="/" replace />;

  return (
    <div>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-white mb-8">Painel do administrador</h1>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
            <Stat label="Usuários" value={stats.totalUsers} />
            <Stat label="Online" value={stats.onlineUsers} />
            <Stat label="Salas abertas" value={stats.openRooms} />
            <Stat label="Em partida" value={stats.playingGames} />
            <Stat label="Finalizadas" value={stats.finishedGames} />
          </div>
        )}

        <Section title="Usuários cadastrados">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs">
              <tr className="text-left">
                <th className="pb-2">Usuário</th><th>Role</th><th>Status</th><th>V</th><th>D</th><th>Partidas</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="py-1.5">{u.username}</td>
                  <td>{u.role}</td>
                  <td>
                    {u.status === "BANNED" ? <span className="text-red-400">BANIDO</span> : u.status}
                  </td>
                  <td>{u.wins}</td>
                  <td>{u.losses}</td>
                  <td>{u.games_played}</td>
                  <td className="py-1.5">
                    {u.role !== "ADMIN" && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleResetPassword(u.id, u.username)}
                          disabled={actionLoading === u.id}
                          className="text-[10px] px-2 py-0.5 rounded border border-border text-white/50 hover:text-white hover:border-white/40 transition disabled:opacity-40"
                        >
                          resetar senha
                        </button>
                        {u.status === "BANNED" ? (
                          <button
                            onClick={() => handleUnban(u.id)}
                            disabled={actionLoading === u.id}
                            className="text-[10px] px-2 py-0.5 rounded border border-green-500/40 text-green-400 hover:bg-green-500/10 transition disabled:opacity-40"
                          >
                            desbanir
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(u.id)}
                            disabled={actionLoading === u.id}
                            className="text-[10px] px-2 py-0.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                          >
                            banir
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Salas recentes">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs"><tr className="text-left"><th className="pb-2">Código</th><th>Jogo</th><th>Status</th><th>Anfitrião</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.code} className="border-t border-border/60">
                  <td className="py-1.5 font-mono">{r.code}</td><td>{r.game_type}</td><td>{r.status}</td><td>{r.host}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Partidas recentes">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs"><tr className="text-left"><th className="pb-2">Jogo</th><th>Status</th><th>Vencedor</th></tr></thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-t border-border/60">
                  <td className="py-1.5">{g.game_type}</td><td>{g.status}</td><td>{g.winner || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-border rounded-xl py-3 text-center">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[11px] text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-6 overflow-x-auto">
      <h2 className="text-sm font-medium text-white/70 mb-3">{title}</h2>
      {children}
    </div>
  );
}
