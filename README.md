# PlayHub — Ludo (com capricho visual), Xadrez e Damas, encerrar partida por consenso

## O que fiz nesta rodada

**Capricho visual no Ludo**
- Tabuleiro com moldura "de mesa" (gradiente madeira + feltro escuro por trás), sombra
  em camadas, peças com relevo real (sombra própria + destaque de luz), fundo do tabuleiro
  com gradiente radial em vez de bege chapado
- Fundo da tela de jogo ganha um glow ambiente sutil na cor do jogador da vez (transição
  suave quando o turno muda)
- Chips de jogador com anel pulsante (`turn-active`) destacando quem está jogando agora
- Código de sala em fonte monoespaçada, cartões com leve textura de conic-gradient nas
  cores do Ludo por trás do painel "como você quer jogar"

**Encerrar partida — em todos os jogos (Ludo, Xadrez, Damas)**
- Qualquer jogador pode clicar em "Encerrar partida" e abre um cartão mostrando quem já
  confirmou e quem falta
- A partida só termina de verdade quando **todos os jogadores humanos confirmam** (bots no
  Ludo não precisam confirmar)
- O anfitrião tem um botão adicional para **forçar o encerramento imediatamente**, sem
  esperar consenso — testei que um convidado tentando forçar é bloqueado com erro
- Testei ao vivo via Socket.IO: 1 voto não encerra, 2 votos encerram, força do anfitrião
  funciona sozinha, convidado não pode forçar — os 4 cenários passaram
- Componente `EndGameCard` compartilhado entre os três jogos, para não duplicar a lógica

## Estado geral do projeto
- **48 testes automatizados passando** (Xadrez 15, Ludo 12, Damas 12, Auth 9)
- Os três jogos completos e jogáveis: Ludo (com bots), Xadrez (roque, en passant, xeque-mate),
  Damas (captura obrigatória, múltiplas capturas, promoção)
- Backend Postgres real via `pg`, cookie cross-origin corrigido, fallback SPA, acks no
  Socket.IO, sair/cancelar sala

## O que ainda falta
- Cronômetro e "cara ou coroa" em Xadrez/Damas
- Pausa/retomada fora do Ludo
- Histórico de partidas de Xadrez/Damas persistido no banco
- Validação real contra seu Supabase — continuo sem acesso de rede a `*.supabase.co` neste
  sandbox; testei tudo com Postgres local temporário, sem tocar sua connection string real

## Rodando localmente
```bash
cd server
npm install
cp .env.example .env        # cole a DATABASE_URL do seu Supabase
npm run seed:admin
npm run dev                  # http://localhost:4000
npm test                     # 48 testes automatizados

cd ../client
npm install
npm run dev                  # http://localhost:5173
```

## Deploy no Render
`render.yaml` na raiz. Preencha `DATABASE_URL` (Supabase), `CLIENT_URL`, `VITE_API_URL`,
`ADMIN_PASSWORD`. `JWT_SECRET` é gerado automaticamente.

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
