import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold tracking-tight text-white">PLAYHUB</Link>
        <div className="flex items-center gap-5 text-sm">
          <Link to="/" className="text-white/60 hover:text-white transition">Início</Link>
          <Link to={`/profile/${user?.username}`} className="text-white/60 hover:text-white transition">Perfil</Link>
          {user?.role === "ADMIN" && (
            <Link to="/admin" className="text-white/60 hover:text-white transition">Admin</Link>
          )}
          <span className="text-white/40">@{user?.username}</span>
          <button
            onClick={async () => { await logout(); navigate("/login"); }}
            className="text-white/60 hover:text-white transition"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
