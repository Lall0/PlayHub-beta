# PlayHub — Ludo, Xadrez e Damas com início por consenso e sala sem limite fixo

## Novidade desta rodada: quem inicia a partida agora é o grupo, não o anfitrião

- **Qualquer jogador propõe iniciar** — não é mais exclusivo do anfitrião. Testei ao vivo:
  o convidado (não anfitrião) conseguiu propor o início no Xadrez e no Ludo.
- **A partida só começa quando todos os presentes confirmam** (bots no Ludo contam
  automaticamente como prontos). Testei com 3 jogadores no Ludo: com 2 de 3 confirmados
  o jogo não começa; com o 3º confirmando, começa.
- **Ludo sem número fixo escolhido na criação** — antes você escolhia "2, 3 ou 4
  jogadores" ao criar a sala; agora a sala sempre aceita até 4 (limite do próprio
  tabuleiro) e as pessoas vão entrando livremente até alguém propor começar.
- **Sala parada em espera por 2 minutos cancela sozinha** e some da lista de salas
  abertas — implementado nos três jogos. Confirmei a lógica com um teste isolado (reduzi
  o timeout temporariamente durante o teste, sem deixar essa alteração no código: o
  `setInterval` de varredura roda corretamente a cada 15s e remove salas velhas).
- Botão "Cancelar minha confirmação" caso alguém confirme e mude de ideia antes dos
  outros confirmarem também.

## Sobre o bug de "lista de jogadores" que você reportou
Testei especificamente esse cenário em Xadrez e Damas (dois jogadores entrando, checando
se a lista atualiza para os dois lados) e **não consegui reproduzir** — a lista sempre
chegou correta nos meus testes de socket. Se ainda acontecer para você, me diga em qual
tela exatamente (lobby de sala? lista de "jogadores online" do dashboard?) e o que
apareceu errado, que eu investigo mais a fundo.

## Resumo de tudo que já foi fechado
Motor completo dos três jogos, cara ou coroa + relógio + pausa/retomada em Xadrez e
Damas, histórico persistido no banco, encerrar partida por consenso, fallback de SPA,
**rate limiting testado ao vivo** (22 tentativas de login seguidas: as 20 primeiras
passaram normalmente, a 21ª foi bloqueada com HTTP 429 e a mensagem correta; rotas de
jogo e `/health` continuam liberadas), troca/reset de senha, banir/desbanir usuário,
cache de username (reduz carga no Postgres do plano gratuito), capricho visual no
Ludo — **48 testes automatizados passando**, backend e frontend compilam limpo.

## O que ainda falta
- Validação real contra seu Supabase — meu sandbox continua bloqueando `*.supabase.co`
- Melhorias de UX identificadas numa análise anterior (destaque de captura no Xadrez,
  aviso de captura obrigatória em Damas, notação de lances, sons, etc.) — ainda não
  implementadas, ficaram só como lista priorizada

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
`ADMIN_PASSWORD`. `JWT_SECRET` é gerado automaticamente. Veja a seção sobre `_redirects`
e fallback de SPA nas notas de deploy dentro do próprio `render.yaml` e nos comentários
de `server/src/index.ts`.

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
