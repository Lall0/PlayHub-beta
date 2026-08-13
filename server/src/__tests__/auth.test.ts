import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { newDb } from "pg-mem";

// Usamos pg-mem (Postgres em memória) para rodar os testes sem depender de rede —
// este ambiente de testes não tem acesso à internet. Fazemos isso "encaixando" o
// pool em memória no lugar do pool real (mesma interface .query), então o código
// de produção em src/db/index.ts e nas rotas continua idêntico ao que roda contra
// o Supabase de verdade.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test_secret";

const mem = newDb({ autoCreateForeignKeyIndices: true });
mem.public.registerFunction({ name: "gen_random_uuid", returns: "uuid" as any, implementation: () => crypto.randomUUID() });
mem.public.registerFunction({ name: "now", returns: "timestamptz" as any, implementation: () => new Date() });
const { Pool: MemPool } = mem.adapters.createPg();
const memPool = new MemPool();

let authRouter: typeof import("../routes/auth").authRouter;
let realPool: any;

beforeAll(async () => {
  const dbModule = await import("../db");
  realPool = dbModule.pool;
  // Encaixa o pool em memória no lugar do pool real, sem mudar a interface usada pelas rotas
  realPool.query = memPool.query.bind(memPool);
  await realPool.query(dbModule.SCHEMA_SQL.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/, ""));

  const mod = await import("../routes/auth");
  authRouter = mod.authRouter;
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  return app;
}

beforeEach(async () => {
  await realPool.query("DELETE FROM users");
});

describe("cadastro", () => {
  it("cria usuário com sucesso e nunca expõe a senha em texto puro", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/register").send({ username: "alice", password: "123456", confirmPassword: "123456" });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("alice");
    expect(res.body.user.password).toBeUndefined();

    const row = await realPool.query("SELECT password_hash FROM users WHERE username = $1", ["alice"]);
    expect(row.rows[0].password_hash).not.toBe("123456");
    expect(row.rows[0].password_hash.length).toBeGreaterThan(20);
  });

  it("rejeita senhas que não coincidem", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/register").send({ username: "bob", password: "123456", confirmPassword: "654321" });
    expect(res.status).toBe(400);
  });

  it("rejeita username duplicado", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/register").send({ username: "carol", password: "123456", confirmPassword: "123456" });
    const res = await request(app).post("/api/auth/register").send({ username: "carol", password: "abcdef", confirmPassword: "abcdef" });
    expect(res.status).toBe(409);
  });

  it("rejeita senha curta", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/register").send({ username: "dave", password: "123", confirmPassword: "123" });
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  it("autentica com credenciais corretas", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/register").send({ username: "erin", password: "senha123", confirmPassword: "senha123" });
    const res = await request(app).post("/api/auth/login").send({ username: "erin", password: "senha123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejeita senha errada", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/register").send({ username: "frank", password: "senha123", confirmPassword: "senha123" });
    const res = await request(app).post("/api/auth/login").send({ username: "frank", password: "errada" });
    expect(res.status).toBe(401);
  });

  it("rejeita usuário inexistente", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/login").send({ username: "ninguem", password: "x" });
    expect(res.status).toBe(401);
  });
});

describe("proteção de rotas privadas", () => {
  it("bloqueia acesso a /me sem token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("permite acesso a /me com token válido", async () => {
    const app = buildApp();
    const reg = await request(app).post("/api/auth/register").send({ username: "gina", password: "senha123", confirmPassword: "senha123" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("gina");
  });
});
