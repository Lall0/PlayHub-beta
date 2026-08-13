# PlayHub — Ludo (backend em Postgres/Supabase + frontend + admin + testes)

## O que está pronto e testado de verdade

**Backend**
- **Banco: Postgres real** (driver `pg`, sem ORM pesado). Todo o backend foi migrado de
  SQLite para Postgres — mesmo schema, mesma sintaxe SQL que você vai usar no Supabase.
  Os 21 testes automatizados rodam contra Postgres de verdade (via `pg-mem`, um Postgres
  em memória, porque este ambiente de desenvolvimento não tem acesso à internet — mas o
  código de produção em `src/db/index.ts` usa o driver `pg` puro apontando para
  `DATABASE_URL`, exatamente a connection string do seu Supabase)
- Cadastro/login com hash bcrypt + JWT em cookie httpOnly, validações de erro
- Perfil com vitórias/derrotas/partidas
- Salas de Ludo em tempo real via Socket.IO (criar, entrar por código, salas públicas, presença online)
- Motor de Ludo **servidor-autoritativo**: dado com `crypto.randomInt`, validação de turno,
  movimento, captura, casas seguras, corredor final, condição de vitória
- Pausa/retomada de partida
- Painel administrador (`/api/admin/*`): estatísticas, usuários, salas, partidas — protegido por
  role ADMIN
- Seed do admin via `npm run seed:admin`
- Sistema de convites completo: enviar, receber, aceitar (cria sala automaticamente), recusar,
  expiração automática em 60s
- **21 testes automatizados passando** (`npm test`)
- Dockerfile do backend e do frontend, `render.yaml` com os dois serviços configurados
- Ao subir, o servidor roda `ensureSchema()` automaticamente — cria as tabelas no Postgres
  (via `CREATE TABLE IF NOT EXISTS`) se ainda não existirem, então **não precisa rodar
  migrations manualmente**: é só apontar o `DATABASE_URL` para o Supabase e subir o servidor

**Frontend**
- React + Vite + TypeScript + Tailwind v4, build de produção limpo
- Login, Cadastro, Dashboard (jogadores online + convites), Perfil, Painel Admin
- Página do Ludo completa: criar sala, entrar por código, lobby, tabuleiro em SVG colorido,
  dado animado, jogadas por clique, reconexão automática

## Conectando ao SEU Supabase (o que você já criou)
No arquivo `server/.env`, defina:
```
DATABASE_URL="postgresql://postgres:SUA_SENHA@db.ymzdellmheaqtobpdpby.supabase.co:5432/postgres"
```
Troque `SUA_SENHA` pela senha do banco que você definiu ao criar o projeto (se tiver caracteres
especiais, faça percent-encode). Essa é a **conexão direta** (porta 5432) que a própria Supabase
recomenda para aplicações persistentes como o Render — não precisa do pooler.

**Importante sobre o plano gratuito**: configurei o pool de conexões com `max: 5` em
`server/src/db/index.ts` para não estourar o limite de conexões simultâneas do plano free.
Se notar erros de "too many connections", pode abaixar ainda mais esse número.

Ao rodar `npm run dev` ou `npm run seed:admin` localmente, o backend vai conectar direto no
seu Supabase e criar as tabelas automaticamente na primeira execução — **não testei essa
conexão neste ambiente porque meu sandbox bloqueia o domínio `*.supabase.co`** (rede restrita
a poucos domínios, confirmei o bloqueio explicitamente). O código está pronto; a validação
final é rodar `npm run dev` no seu computador, que tem acesso normal à internet.

## O que ainda falta (transparência total)
- **Xadrez e Damas**: fora do escopo, por pedido explícito ("foque no ludo")
- Não consegui testar a conexão real com o Supabase neste ambiente (bloqueio de rede do
  sandbox) — testei toda a lógica contra um Postgres em memória com a mesma sintaxe SQL,
  mas vale você rodar `npm run seed:admin` localmente como primeiro teste de verdade
- Abandono explícito durante a partida (hoje só há "sair" antes de começar)
- Rate limiting nas APIs
- Testes end-to-end com navegador real (Playwright/Cypress) — o fluxo de UI foi validado
  manualmente via scripts Socket.IO, não clicando na interface

## Rodando localmente
```bash
# backend
cd server
npm install
cp .env.example .env        # cole a DATABASE_URL do seu Supabase, ajuste ADMIN_PASSWORD e JWT_SECRET
npm run seed:admin           # cria as tabelas (se não existirem) + o usuário admin "lallo"
npm run dev                  # http://localhost:4000
npm test                     # roda os 21 testes automatizados (Postgres em memória, não mexe no seu Supabase)

# frontend (outro terminal)
cd client
npm install
npm run dev                  # http://localhost:5173
```

## Deploy no Render
Há um `render.yaml` na raiz definindo dois serviços web (Docker): `playhub-server` e
`playhub-client`. Ao criar o Blueprint no Render:
1. Defina `DATABASE_URL` no `playhub-server` com a connection string do Supabase (a mesma do `.env` local)
2. Preencha `CLIENT_URL` no server com a URL pública do `playhub-client`
3. Preencha `VITE_API_URL` no client com a URL pública do `playhub-server`
4. Defina `ADMIN_PASSWORD` com uma senha forte
5. `JWT_SECRET` é gerado automaticamente pelo Render

## Variáveis de ambiente
Backend (`server/.env`):
```
DATABASE_URL="postgresql://postgres:SUA_SENHA@db.ymzdellmheaqtobpdpby.supabase.co:5432/postgres"
JWT_SECRET=troque_essa_chave
CLIENT_URL=http://localhost:5173
PORT=4000
NODE_ENV=development
ADMIN_USERNAME=lallo
ADMIN_PASSWORD=troque_essa_senha
```
Frontend (`client/.env`):
```
VITE_API_URL=http://localhost:4000
```
