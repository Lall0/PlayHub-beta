import rateLimit from "express-rate-limit";

// Login/registro: limite mais apertado para dificultar força bruta de senha,
// sem travar um usuário legítimo que erra a senha uma ou duas vezes.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 tentativas por IP a cada 15 min é generoso para uso legítimo, apertado para brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

// Limite geral para o restante da API (mais permissivo, só evita abuso grosseiro)
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde um momento." },
});
