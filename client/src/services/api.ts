const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export interface User {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  status?: string;
  wins?: number;
  losses?: number;
  games_played?: number;
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro inesperado. Tente novamente.");
  return data;
}

export const api = {
  register: (username: string, password: string, confirmPassword: string) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, confirmPassword }) }),
  login: (username: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  profile: (username: string) => request(`/api/auth/profile/${username}`),
  adminStats: () => request("/api/admin/stats"),
  adminUsers: () => request("/api/admin/users"),
  adminRooms: () => request("/api/admin/rooms"),
  adminGames: () => request("/api/admin/games"),
};

export { API_URL };
