import { Router } from "express";

export const gamesRouter = Router();

// Rota simples de metadados dos jogos disponíveis/planejados. Usada pelo frontend
// para exibir os cards do dashboard sem precisar hardcodar o status de cada jogo.
gamesRouter.get("/", (_req, res) => {
  res.json({
    games: [
      { id: "LUDO", name: "Ludo", players: "2-4", status: "AVAILABLE" },
      { id: "CHESS", name: "Xadrez", players: "2", status: "COMING_SOON" },
      { id: "CHECKERS", name: "Damas", players: "2", status: "COMING_SOON" },
    ],
  });
});
