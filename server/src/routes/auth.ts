import { Router } from "express";
import { pool } from "../db";
import { hashPassword, verifyPassword, signToken, requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

// Em produção, frontend (Static Site) e backend (Web Service) do Render normalmente
// ficam em domínios diferentes. Cookies cross-site só são enviados pelo navegador com
// SameSite=None + Secure. Em dev local (mesma origem/porta diferente em localhost),
// SameSite=Lax funciona normalmente e não exige HTTPS.
function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    secure: isProd,
  };
}

authRouter.post("/register", async (req, res) => {
  const { username, password, confirmPassword } = req.body || {};
  if (!username || typeof username !== "string" || username.length < 3) {
    return res.status(400).json({ error: "Usuário deve ter ao menos 3 caracteres" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "As senhas não coincidem" });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rows.length > 0) return res.status(409).json({ error: "Esse nome de usuário já existe" });

    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, 'USER', 'OFFLINE') RETURNING id, username, role",
      [username, hashPassword(password)]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    res.cookie("token", token, cookieOptions());
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar conta. Tente novamente." });
  }
});

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user || !verifyPassword(password || "", user.password_hash)) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
    const token = signToken(user.id);
    res.cookie("token", token, cookieOptions());
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao entrar. Tente novamente." });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role, status, wins, losses, games_played, created_at FROM users WHERE id = $1",
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar perfil." });
  }
});

authRouter.get("/profile/:username", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, status, wins, losses, games_played, created_at FROM users WHERE username = $1",
      [req.params.username]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar perfil." });
  }
});
