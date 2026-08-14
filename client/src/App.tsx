import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LudoSocketProvider } from "./contexts/LudoSocketContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import LudoPage from "./pages/LudoPage";
import ChessPage from "./pages/ChessPage";
import CheckersPage from "./pages/CheckersPage";
import Admin from "./pages/Admin";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/40 text-sm">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LudoSocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/ludo" element={<PrivateRoute><LudoPage /></PrivateRoute>} />
            <Route path="/xadrez" element={<PrivateRoute><ChessPage /></PrivateRoute>} />
            <Route path="/dama" element={<PrivateRoute><CheckersPage /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
            <Route path="/profile/:username" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LudoSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
