import "dotenv/config";
import { pool, ensureSchema } from "./index";
import { hashPassword } from "../middleware/auth";

const username = process.env.ADMIN_USERNAME || "lallo";
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error("Defina ADMIN_PASSWORD no .env antes de rodar o seed.");
  process.exit(1);
}

async function run() {
  await ensureSchema();
  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);

  if (existing.rows.length > 0) {
    await pool.query("UPDATE users SET password_hash = $1, role = 'ADMIN', updated_at = now() WHERE id = $2", [
      hashPassword(password!),
      existing.rows[0].id,
    ]);
    console.log(`Admin "${username}" atualizado.`);
  } else {
    await pool.query(
      "INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, 'ADMIN', 'OFFLINE')",
      [username, hashPassword(password!)]
    );
    console.log(`Admin "${username}" criado.`);
  }
  await pool.end();
}

run().catch((err) => {
  console.error("Erro ao rodar seed:", err);
  process.exit(1);
});
