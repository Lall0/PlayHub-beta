import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { registerLudoSockets } from "./sockets/ludo";
import { ensureSchema } from "./db";

const app = express();
const httpServer = createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);

const io = new Server(httpServer, { cors: { origin: CLIENT_URL, credentials: true } });
registerLudoSockets(io);

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
