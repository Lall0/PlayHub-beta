import { describe, it, expect } from "vitest";
import {
  createInitialCheckersState,
  getLegalMoves,
  applyCheckersMove,
  advanceCheckersTurn,
  CheckersState,
} from "../games/checkers/engine";

function makeState(): CheckersState {
  return createInitialCheckersState([
    { userId: "u1", color: "LIGHT" },
    { userId: "u2", color: "DARK" },
  ]);
}

describe("configuração inicial", () => {
  it("cria 12 peças para cada cor nas casas escuras", () => {
    const state = makeState();
    expect(state.pieces.filter((p) => p.color === "LIGHT").length).toBe(12);
    expect(state.pieces.filter((p) => p.color === "DARK").length).toBe(12);
    for (const p of state.pieces) {
      expect((p.row + p.col) % 2).toBe(1);
    }
  });
});

describe("movimentos simples", () => {
  it("permite movimento diagonal de uma casa quando não há captura disponível", () => {
    const state = makeState();
    const moves = getLegalMoves(state, "DARK");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.captured.length === 0)).toBe(true);
  });

  it("rejeita movimento para casa ocupada", () => {
    const state = makeState();
    const piece = state.pieces.find((p) => p.color === "DARK")!;
    expect(() => applyCheckersMove(state, piece.id, { row: piece.row, col: piece.col })).toThrow();
  });
});

describe("captura obrigatória", () => {
  it("obriga a capturar quando há peça adversária capturável", () => {
    const state = makeState();
    // Limpa o tabuleiro e monta cenário controlado: DARK em (2,2), LIGHT em (3,3), destino (4,4) livre
    state.pieces = [
      { id: "d1", color: "DARK", row: 2, col: 2, king: false },
      { id: "l1", color: "LIGHT", row: 3, col: 3, king: false },
    ];
    const moves = getLegalMoves(state, "DARK");
    expect(moves.length).toBe(1);
    expect(moves[0].captured).toEqual(["l1"]);
    expect(moves[0].destination).toEqual({ row: 4, col: 4 });
  });

  it("aplica a captura e remove a peça capturada", () => {
    const state = makeState();
    state.pieces = [
      { id: "d1", color: "DARK", row: 2, col: 2, king: false },
      { id: "l1", color: "LIGHT", row: 3, col: 3, king: false },
    ];
    const result = applyCheckersMove(state, "d1", { row: 4, col: 4 });
    expect(result.captured).toEqual(["l1"]);
    expect(result.state.pieces.find((p) => p.id === "l1")).toBeUndefined();
    expect(result.state.pieces.find((p) => p.id === "d1")!.row).toBe(4);
  });

  it("encadeia múltiplas capturas em um único lance", () => {
    const state = makeState();
    // DARK em (2,2) pode capturar LIGHT em (3,3) indo para (4,4), depois capturar
    // outra LIGHT em (5,5) indo para (6,6)
    state.pieces = [
      { id: "d1", color: "DARK", row: 2, col: 2, king: false },
      { id: "l1", color: "LIGHT", row: 3, col: 3, king: false },
      { id: "l2", color: "LIGHT", row: 5, col: 5, king: false },
    ];
    const moves = getLegalMoves(state, "DARK");
    expect(moves.length).toBe(1);
    expect(moves[0].captured.sort()).toEqual(["l1", "l2"].sort());
    expect(moves[0].destination).toEqual({ row: 6, col: 6 });
  });

  it("obriga a escolher a sequência de maior captura quando há mais de uma opção", () => {
    const state = makeState();
    // Peça DARK tem duas capturas possíveis: uma simples (1 peça) e uma dupla (2 peças)
    state.pieces = [
      { id: "d1", color: "DARK", row: 2, col: 2, king: false },
      { id: "l1", color: "LIGHT", row: 3, col: 1, king: false }, // captura simples indo para (4,0)
      { id: "l2", color: "LIGHT", row: 3, col: 3, king: false }, // captura dupla via (4,4)
      { id: "l3", color: "LIGHT", row: 5, col: 5, king: false },
    ];
    const moves = getLegalMoves(state, "DARK");
    // só a sequência de 2 capturas deve estar disponível
    expect(moves.every((m) => m.captured.length === 2)).toBe(true);
  });
});

describe("promoção a dama", () => {
  it("promove peça LIGHT ao chegar na linha 0", () => {
    const state = makeState();
    state.pieces = [{ id: "l1", color: "LIGHT", row: 1, col: 1, king: false }];
    const result = applyCheckersMove(state, "l1", { row: 0, col: 0 });
    expect(result.promoted).toBe(true);
    expect(result.state.pieces[0].king).toBe(true);
  });

  it("promove peça DARK ao chegar na linha 7", () => {
    const state = makeState();
    state.pieces = [{ id: "d1", color: "DARK", row: 6, col: 6, king: false }];
    const result = applyCheckersMove(state, "d1", { row: 7, col: 7 });
    expect(result.promoted).toBe(true);
  });

  it("dama se move livremente por várias casas na diagonal", () => {
    const state = makeState();
    state.pieces = [{ id: "d1", color: "DARK", row: 4, col: 4, king: true }];
    const moves = getLegalMoves(state, "DARK");
    const farMove = moves.find((m) => m.destination.row === 7 && m.destination.col === 7);
    expect(farMove).toBeDefined();
  });
});

describe("vitória", () => {
  it("declara vitória quando o adversário perde todas as peças", () => {
    const state = makeState();
    state.pieces = [
      { id: "d1", color: "DARK", row: 2, col: 2, king: false },
      { id: "l1", color: "LIGHT", row: 3, col: 3, king: false },
    ];
    const result = applyCheckersMove(state, "d1", { row: 4, col: 4 });
    expect(result.state.status).toBe("FINISHED");
    expect(result.state.winnerUserId).toBe("u2"); // DARK é u2
  });
});

describe("turnos", () => {
  it("alterna entre os dois jogadores", () => {
    const state = makeState();
    expect(state.currentTurn).toBe(0);
    advanceCheckersTurn(state);
    expect(state.currentTurn).toBe(1);
    advanceCheckersTurn(state);
    expect(state.currentTurn).toBe(0);
  });
});
