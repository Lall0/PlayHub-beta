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
  const token = localStorage.getItem("playhub_token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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
  changePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
    }),
  adminResetPassword: (userId: string, newPassword: string) =>
    request(`/api/admin/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
  adminBanUser: (userId: string) => request(`/api/admin/users/${userId}/ban`, { method: "POST" }),
  adminUnbanUser: (userId: string) => request(`/api/admin/users/${userId}/unban`, { method: "POST" }),
};

export { API_URL };
