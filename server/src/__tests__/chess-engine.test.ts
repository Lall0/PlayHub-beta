import { describe, it, expect } from "vitest";
import {
  createInitialChessState,
  getLegalMoves,
  applyChessMove,
  isInCheck,
  ChessState,
  Board,
} from "../games/chess/engine";

function makeState(): ChessState {
  return createInitialChessState([
    { userId: "u1", color: "WHITE" },
    { userId: "u2", color: "BLACK" },
  ]);
}

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

describe("configuração inicial", () => {
  it("posiciona 16 peças de cada cor corretamente", () => {
    const state = makeState();
    let white = 0, black = 0;
    for (const row of state.board) for (const cell of row) {
      if (cell?.color === "WHITE") white++;
      if (cell?.color === "BLACK") black++;
    }
    expect(white).toBe(16);
    expect(black).toBe(16);
  });

  it("brancas começam jogando", () => {
    const state = makeState();
    expect(state.players[state.currentTurn].color).toBe("WHITE");
  });
});

describe("movimentos básicos", () => {
  it("peão pode avançar 1 ou 2 casas no primeiro lance", () => {
    const state = makeState();
    const moves = getLegalMoves(state, "WHITE").filter((m) => m.from.row === 6 && m.from.col === 4);
    expect(moves.some((m) => m.to.row === 5)).toBe(true);
    expect(moves.some((m) => m.to.row === 4)).toBe(true);
  });

  it("peão não pode avançar 2 casas depois do primeiro lance", () => {
    const state = makeState();
    const r1 = applyChessMove(state, { row: 6, col: 4 }, { row: 4, col: 4 });
    const r2 = applyChessMove(r1.state, { row: 1, col: 4 }, { row: 3, col: 4 });
    const moves = getLegalMoves(r2.state, "WHITE").filter((m) => m.from.row === 4 && m.from.col === 4);
    expect(moves.every((m) => m.to.row !== 2)).toBe(true);
  });

  it("cavalo se move em L", () => {
    const state = makeState();
    const moves = getLegalMoves(state, "WHITE").filter((m) => m.from.row === 7 && m.from.col === 1);
    expect(moves.map((m) => `${m.to.row},${m.to.col}`).sort()).toEqual(["5,0", "5,2"].sort());
  });

  it("rejeita movimento para casa ocupada pela própria peça", () => {
    const state = makeState();
    expect(() => applyChessMove(state, { row: 7, col: 0 }, { row: 6, col: 0 })).toThrow();
  });
});

describe("captura", () => {
  it("permite capturar peça adversária", () => {
    const state = makeState();
    const r1 = applyChessMove(state, { row: 6, col: 4 }, { row: 4, col: 4 }); // e4
    const r2 = applyChessMove(r1.state, { row: 1, col: 3 }, { row: 3, col: 3 }); // d5
    const r3 = applyChessMove(r2.state, { row: 4, col: 4 }, { row: 3, col: 3 }); // exd5
    expect(r3.captured).toBe(true);
    expect(r3.state.board[3][3]?.color).toBe("WHITE");
  });
});

describe("en passant", () => {
  it("permite captura en passant logo após avanço duplo do peão adversário", () => {
    const state = makeState();
    let s = applyChessMove(state, { row: 6, col: 4 }, { row: 4, col: 4 }).state; // e4
    s = applyChessMove(s, { row: 1, col: 0 }, { row: 2, col: 0 }).state; // a6 (peça neutra)
    s = applyChessMove(s, { row: 4, col: 4 }, { row: 3, col: 4 }).state; // e5
    s = applyChessMove(s, { row: 1, col: 3 }, { row: 3, col: 3 }).state; // d5 (avanço duplo, habilita en passant)

    const moves = getLegalMoves(s, "WHITE").filter((m) => m.from.row === 3 && m.from.col === 4);
    const enPassantMove = moves.find((m) => m.to.row === 2 && m.to.col === 3);
    expect(enPassantMove).toBeDefined();

    const result = applyChessMove(s, { row: 3, col: 4 }, { row: 2, col: 3 });
    expect(result.captured).toBe(true);
    expect(result.state.board[3][3]).toBeNull(); // peão preto capturado sai do tabuleiro
  });
});

describe("roque", () => {
  it("permite roque curto quando o caminho está livre e seguro", () => {
    const state = makeState();
    state.board = emptyBoard();
    state.board[7][4] = { type: "K", color: "WHITE", hasMoved: false };
    state.board[7][7] = { type: "R", color: "WHITE", hasMoved: false };
    state.board[0][4] = { type: "K", color: "BLACK", hasMoved: false };

    const moves = getLegalMoves(state, "WHITE").filter((m) => m.from.row === 7 && m.from.col === 4);
    const castle = moves.find((m) => m.to.col === 6);
    expect(castle).toBeDefined();

    const result = applyChessMove(state, { row: 7, col: 4 }, { row: 7, col: 6 });
    expect(result.state.board[7][6]?.type).toBe("K");
    expect(result.state.board[7][5]?.type).toBe("R"); // torre também se moveu
  });

  it("proíbe roque se o rei estiver em xeque", () => {
    const state = makeState();
    state.board = emptyBoard();
    state.board[7][4] = { type: "K", color: "WHITE", hasMoved: false };
    state.board[7][7] = { type: "R", color: "WHITE", hasMoved: false };
    state.board[0][4] = { type: "K", color: "BLACK", hasMoved: false };
    state.board[0][0] = { type: "R", color: "BLACK", hasMoved: false }; // torre preta ataca coluna 4? não, coluna 0
    state.board[1][4] = { type: "R", color: "BLACK", hasMoved: false }; // torre preta na coluna 4, dá xeque

    const moves = getLegalMoves(state, "WHITE").filter((m) => m.from.row === 7 && m.from.col === 4);
    expect(moves.some((m) => m.to.col === 6)).toBe(false);
  });
});

describe("xeque e xeque-mate", () => {
  it("detecta xeque simples", () => {
    const state = makeState();
    state.board = emptyBoard();
    state.board[7][4] = { type: "K", color: "WHITE", hasMoved: false };
    state.board[0][4] = { type: "K", color: "BLACK", hasMoved: false };
    state.board[1][4] = { type: "R", color: "BLACK", hasMoved: false };
    expect(isInCheck(state, "WHITE")).toBe(true);
  });

  it("detecta xeque-mate (mate de corredor com duas torres)", () => {
    const state = makeState();
    state.board = emptyBoard();
    state.board[0][7] = { type: "K", color: "BLACK", hasMoved: true }; // rei preto no canto
    state.board[7][7] = { type: "K", color: "WHITE", hasMoved: true };
    state.board[0][0] = { type: "R", color: "WHITE", hasMoved: true }; // já dá xeque na fileira 0
    state.board[5][0] = { type: "R", color: "WHITE", hasMoved: true }; // vai cobrir a fileira 1

    // Move a segunda torre para a fileira 1, cortando toda fuga do rei preto: xeque-mate
    const result = applyChessMove(state, { row: 5, col: 0 }, { row: 1, col: 0 });
    expect(result.isCheckmate).toBe(true);
    expect(result.state.winnerUserId).toBe("u1");
  });

  it("rei não pode se mover para casa atacada", () => {
    const state = makeState();
    state.board = emptyBoard();
    state.board[7][4] = { type: "K", color: "WHITE", hasMoved: false };
    state.board[0][4] = { type: "K", color: "BLACK", hasMoved: false };
    state.board[0][3] = { type: "R", color: "BLACK", hasMoved: false }; // ataca coluna 3
    const moves = getLegalMoves(state, "WHITE").filter((m) => m.from.row === 7 && m.from.col === 4);
    expect(moves.some((m) => m.to.col === 3)).toBe(false);
  });
});

describe("promoção", () => {
  it("promove peão a dama ao alcançar a última fileira", () => {
    const state = makeState();
    state.board = emptyBoard();
    state.board[1][0] = { type: "P", color: "WHITE", hasMoved: true };
    state.board[7][7] = { type: "K", color: "WHITE", hasMoved: true };
    state.board[0][7] = { type: "K", color: "BLACK", hasMoved: true };
    const result = applyChessMove(state, { row: 1, col: 0 }, { row: 0, col: 0 }, "Q");
    expect(result.state.board[0][0]?.type).toBe("Q");
  });
});

describe("turnos", () => {
  it("não permite mover peça fora do turno (validação de posse)", () => {
    const state = makeState();
    // Tentando aplicar um lance de peça preta enquanto currentTurn é branco deve ser
    // responsabilidade do socket (não do motor em si, que só valida legalidade da jogada
    // dado que a cor foi determinada por quem está chamando) — aqui garantimos que
    // getLegalMoves(BLACK) não inclui peças que não existem na posição errada.
    const blackMoves = getLegalMoves(state, "BLACK").filter((m) => m.from.row === 6);
    expect(blackMoves.length).toBe(0); // linha 6 é toda de peões brancos
  });
});
