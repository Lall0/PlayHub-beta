import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import Navbar from "../components/Navbar";

export default function Profile() {
  const { username } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    api.profile(username).then((d) => setProfile(d.user)).catch((e) => setError(e.message));
  }, [username]);

  return (
    <div>
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-16">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {profile && (
          <div className="bg-surface border border-border rounded-2xl p-6 text-center">
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
      </div>
    </div>
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
