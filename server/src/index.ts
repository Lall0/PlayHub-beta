import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { gamesRouter } from "./routes/games";
import { registerLudoSockets } from "./sockets/ludo";
import { registerChessSockets } from "./sockets/chess";
import { registerCheckersSockets } from "./sockets/checkers";
import { ensureSchema } from "./db";
import { authLimiter, apiLimiter } from "./middleware/rateLimit";

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Rate limit apertado só em login/registro (força bruta de senha), e um limite geral
// mais permissivo no resto da API. Desligado em NODE_ENV=test para não atrapalhar
// os testes automatizados que fazem várias requisições em sequência rápida.
if (process.env.NODE_ENV !== "test") {
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api", apiLimiter);
}

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/games", gamesRouter);

const io = new Server(httpServer, { cors: { origin: CLIENT_URL, credentials: true } });
registerLudoSockets(io);
registerChessSockets(io);
registerCheckersSockets(io);

// Fallback de SPA robusto: se o build do frontend (client/dist) estiver acessível
// a partir deste serviço — cenário de deploy em serviço único no Render, em vez de
// dois serviços separados — servimos os arquivos estáticos aqui e devolvemos
// index.html para qualquer rota GET que não seja API. Isso garante que F5 em
// /ludo, /profile etc funcione mesmo sem depender de configuração extra do Render
// (como _redirects, que só funciona no modo Static Site). Se os dois serviços
// estiverem separados (arquitetura recomendada no render.yaml), esta pasta
// simplesmente não existe aqui e o bloco abaixo não faz nada.
const clientDistPath = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path === "/health" || req.path.startsWith("/socket.io")) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const PORT = process.env.PORT || 4000;

ensureSchema()
  .then(() => {
    httpServer.listen(PORT, () => console.log(`PlayHub server rodando na porta ${PORT}`));
  })
  .catch((err) => {
    console.error("Erro ao conectar/preparar o banco de dados:", err);
    process.exit(1);
  });

export { app };
