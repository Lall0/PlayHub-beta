import { pool } from "./index";

// Cache simples em memória: evita bater no Postgres toda vez que um socket conecta
// em qualquer um dos três namespaces (Ludo, Xadrez, Damas). Isso é especialmente
// importante no plano gratuito do Supabase, onde o pool de conexões é escasso —
// se três sockets do mesmo usuário conectam quase ao mesmo tempo (ex: abrindo o
// Ludo enquanto o Xadrez também tenta reconectar), cada consulta extra ao banco
// disputa uma conexão do pool (max: 5) e pode atrasar o registro dos listeners do
// Socket.IO o suficiente para estourar o timeout do cliente.
const cache = new Map<string, { username: string; banned: boolean; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutos é suficiente; username praticamente não muda

export async function getUsernameCached(userId: string): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.banned ? null : cached.username;

  const result = await pool.query("SELECT username, status FROM users WHERE id = $1", [userId]);
  const row = result.rows[0];
  if (!row) return null;

  const banned = row.status === "BANNED";
  cache.set(userId, { username: row.username, banned, expiresAt: Date.now() + TTL_MS });
  return banned ? null : row.username;
}

export function invalidateUsernameCache(userId: string) {
  cache.delete(userId);
}
