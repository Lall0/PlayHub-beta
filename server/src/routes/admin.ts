import { Router } from "express";
import { pool } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

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
