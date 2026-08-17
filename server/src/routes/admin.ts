import { Router } from "express";
import { pool } from "../db";
import { requireAuth, AuthedRequest, hashPassword } from "../middleware/auth";
import { invalidateUsernameCache } from "../db/userCache";

export const adminRouter = Router();

async function requireAdmin(req: AuthedRequest, res: any, next: any) {
  const result = await pool.query("SELECT role FROM users WHERE id = $1", [req.userId]);
  const user = result.rows[0];
  if (!user || user.role !== "ADMIN") return res.status(403).json({ error: "Acesso restrito ao administrador" });
  next();
}

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/stats", async (_req, res) => {
  const [totalUsers, onlineUsers, openRooms, playingGames, finishedGames] = await Promise.all([
    pool.query("SELECT COUNT(*)::int as c FROM users"),
    pool.query("SELECT COUNT(*)::int as c FROM users WHERE status != 'OFFLINE'"),
    pool.query("SELECT COUNT(*)::int as c FROM rooms WHERE status IN ('WAITING','READY')"),
    pool.query("SELECT COUNT(*)::int as c FROM games WHERE status = 'PLAYING'"),
    pool.query("SELECT COUNT(*)::int as c FROM games WHERE status = 'FINISHED'"),
  ]);
  res.json({
    totalUsers: totalUsers.rows[0].c,
    onlineUsers: onlineUsers.rows[0].c,
    openRooms: openRooms.rows[0].c,
    playingGames: playingGames.rows[0].c,
    finishedGames: finishedGames.rows[0].c,
  });
});

adminRouter.get("/users", async (_req, res) => {
  const result = await pool.query(
    "SELECT id, username, role, status, wins, losses, games_played, created_at FROM users ORDER BY created_at DESC"
  );
  res.json({ users: result.rows });
});

adminRouter.get("/rooms", async (_req, res) => {
  const result = await pool.query(
    `SELECT r.code, r.game_type, r.status, r.max_players, r.created_at, u.username as host
     FROM rooms r JOIN users u ON u.id = r.host_id
     ORDER BY r.created_at DESC LIMIT 50`
  );
  res.json({ rooms: result.rows });
});

adminRouter.get("/games", async (_req, res) => {
  const result = await pool.query(
    `SELECT g.id, g.game_type, g.status, g.started_at, g.finished_at, u.username as winner
     FROM games g LEFT JOIN users u ON u.id = g.winner_id
     ORDER BY g.created_at DESC LIMIT 50`
  );
  res.json({ games: result.rows });
});

// --- Ações de escrita: resetar senha de um usuário e banir/desbanir ---

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres" });
  }
  try {
    const result = await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING username", [
      hashPassword(newPassword),
      req.params.id,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ ok: true, username: result.rows[0].username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao resetar senha." });
  }
});

adminRouter.post("/users/:id/ban", async (req: AuthedRequest, res) => {
  if (req.params.id === req.userId) return res.status(400).json({ error: "Você não pode banir a si mesmo" });
  try {
    const result = await pool.query(
      "UPDATE users SET status = 'BANNED', updated_at = now() WHERE id = $1 RETURNING username",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Usuário não encontrado" });
    invalidateUsernameCache(String(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao banir usuário." });
  }
});

adminRouter.post("/users/:id/unban", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET status = 'OFFLINE', updated_at = now() WHERE id = $1 RETURNING username",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao desbanir usuário." });
  }
});
