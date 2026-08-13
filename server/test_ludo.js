const { io } = require("socket.io-client");

const tokenA = process.argv[2];
const tokenB = process.argv[3];

function connect(token, name) {
  return new Promise((resolve) => {
    const s = io("http://localhost:4000", { auth: { token } });
    s.on("connect", () => resolve(s));
  });
}

(async () => {
  const a = await connect(tokenA, "lallo");
  const b = await connect(tokenB, "joao");

  let code;
  a.on("room:joined", (room) => { code = room.code; console.log("[A] sala criada:", room.code, "status:", room.status); });
  a.emit("room:create", { maxPlayers: 2 });
  await new Promise(r => setTimeout(r, 500));

  b.on("room:joined", (room) => console.log("[B] entrou na sala:", room.code, "jogadores:", room.players.length));
  b.emit("room:join", { code });
  await new Promise(r => setTimeout(r, 500));

  let started = false;
  a.on("game:started", (room) => { started = true; console.log("[A] jogo iniciado. Turno de:", room.state.players[room.state.currentTurn].userId, "cores:", room.players.map(p=>p.color)); });
  a.emit("room:start", { code });
  await new Promise(r => setTimeout(r, 500));
  console.log("Jogo iniciou de verdade?", started);

  // Rodar vários lances alternando, testando dado do servidor
  let diceResults = [];
  a.on("game:diceRolled", (d) => diceResults.push(d.dice));
  b.on("game:diceRolled", (d) => diceResults.push(d.dice));

  let lastState;
  a.on("game:state", (room) => { lastState = room.state; });
  b.on("game:state", (room) => { lastState = room.state; });

  // Tenta rolar dado com o jogador errado primeiro (deve dar erro)
  let gotError = false;
  b.on("error:message", (msg) => { gotError = true; console.log("[B] erro esperado recebido:", msg); });
  b.emit("game:rollDice", { code });
  await new Promise(r => setTimeout(r, 300));
  console.log("Validação de turno funcionou?", gotError);

  // Joga várias rodadas reais até alguém conseguir tirar 6 e mover peça da base
  for (let i = 0; i < 30; i++) {
    a.emit("game:rollDice", { code });
    b.emit("game:rollDice", { code });
    await new Promise(r => setTimeout(r, 150));
  }

  console.log("Total de dados lançados pelo servidor:", diceResults.length);
  console.log("Valores únicos observados (deve ter variedade 1-6):", [...new Set(diceResults)].sort());
  console.log("Todos entre 1 e 6?", diceResults.every(d => d >= 1 && d <= 6));

  process.exit(0);
})();
