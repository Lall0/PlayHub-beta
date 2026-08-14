// Motor de Xadrez servidor-autoritativo. Representação: tabuleiro 8x8, linha 0 = fileira 8
// (topo, pretas) até linha 7 = fileira 1 (base, brancas) — convenção interna only, a UI
// converte para notação visual como quiser.

export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export type PieceColor = "WHITE" | "BLACK";

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved: boolean;
}

export type Board = (ChessPiece | null)[][]; // board[row][col]

export interface ChessState {
  players: { userId: string; color: PieceColor }[];
  board: Board;
  currentTurn: number; // índice em players[]
  status: "PLAYING" | "CHECK" | "CHECKMATE" | "STALEMATE" | "DRAW" | "FINISHED";
  winnerUserId?: string;
  enPassantTarget: { row: number; col: number } | null; // casa capturável via en passant no próximo lance
  halfMoveClock: number; // para regra dos 50 lances (empate)
  lastMove?: { from: { row: number; col: number }; to: { row: number; col: number } };
}

export interface Square {
  row: number;
  col: number;
}

function inBounds(row: number, col: number) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function createInitialChessState(players: { userId: string; color: PieceColor }[]): ChessState {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRow: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRow[col], color: "BLACK", hasMoved: false };
    board[1][col] = { type: "P", color: "BLACK", hasMoved: false };
    board[6][col] = { type: "P", color: "WHITE", hasMoved: false };
    board[7][col] = { type: backRow[col], color: "WHITE", hasMoved: false };
  }

  return {
    players,
    board,
    currentTurn: players.findIndex((p) => p.color === "WHITE"),
    status: "PLAYING",
    enPassantTarget: null,
    halfMoveClock: 0,
  };
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function findKing(board: Board, color: PieceColor): Square | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row][col];
      if (p?.type === "K" && p.color === color) return { row, col };
    }
  }
  return null;
}

// Casas atacadas por `color` no tabuleiro dado (ignora regras de "não deixar seu próprio
// rei em xeque" — usado só para checar se uma casa está sob ataque)
function isSquareAttacked(board: Board, square: Square, byColor: PieceColor): boolean {
  const dirsRook = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const dirsBishop = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const knightMoves = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]];

  // peões
  const pawnDir = byColor === "WHITE" ? -1 : 1; // peão branco ataca "para cima" (rows menores)
  for (const dc of [-1, 1]) {
    const r = square.row - pawnDir; // casa de onde um peão inimigo atacaria `square`
    const c = square.col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p?.type === "P" && p.color === byColor) return true;
    }
  }

  // cavalo
  for (const [dr, dc] of knightMoves) {
    const r = square.row + dr;
    const c = square.col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p?.type === "N" && p.color === byColor) return true;
    }
  }

  // rei (adjacente)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = square.row + dr;
      const c = square.col + dc;
      if (inBounds(r, c)) {
        const p = board[r][c];
        if (p?.type === "K" && p.color === byColor) return true;
      }
    }
  }

  // torre/dama em linha reta
  for (const [dr, dc] of dirsRook) {
    let r = square.row + dr;
    let c = square.col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === "R" || p.type === "Q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // bispo/dama na diagonal
  for (const [dr, dc] of dirsBishop) {
    let r = square.row + dr;
    let c = square.col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === "B" || p.type === "Q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

function opposite(color: PieceColor): PieceColor {
  return color === "WHITE" ? "BLACK" : "WHITE";
}

// Movimentos "pseudo-legais" (sem checar se deixam o próprio rei em xeque)
function pseudoMoves(state: ChessState, from: Square): Square[] {
  const piece = state.board[from.row][from.col];
  if (!piece) return [];
  const board = state.board;
  const moves: Square[] = [];

  const pushIfValid = (r: number, c: number, captureOnly = false, moveOnly = false) => {
    if (!inBounds(r, c)) return;
    const target = board[r][c];
    if (target && target.color === piece.color) return;
    if (moveOnly && target) return;
    if (captureOnly && !target) return;
    moves.push({ row: r, col: c });
  };

  if (piece.type === "P") {
    const dir = piece.color === "WHITE" ? -1 : 1;
    const startRow = piece.color === "WHITE" ? 6 : 1;
    // avanço simples
    if (inBounds(from.row + dir, from.col) && !board[from.row + dir][from.col]) {
      pushIfValid(from.row + dir, from.col, false, true);
      // avanço duplo
      if (from.row === startRow && !board[from.row + dir * 2][from.col]) {
        pushIfValid(from.row + dir * 2, from.col, false, true);
      }
    }
    // capturas diagonais
    for (const dc of [-1, 1]) {
      const r = from.row + dir;
      const c = from.col + dc;
      if (inBounds(r, c)) {
        if (board[r][c] && board[r][c]!.color !== piece.color) moves.push({ row: r, col: c });
        else if (state.enPassantTarget && state.enPassantTarget.row === r && state.enPassantTarget.col === c) {
          moves.push({ row: r, col: c });
        }
      }
    }
  } else if (piece.type === "N") {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]]) {
      pushIfValid(from.row + dr, from.col + dc);
    }
  } else if (piece.type === "K") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        pushIfValid(from.row + dr, from.col + dc);
      }
    }
    // roque
    if (!piece.hasMoved) {
      const row = from.row;
      // roque curto (lado do rei)
      const kingSideRook = board[row][7];
      if (kingSideRook?.type === "R" && !kingSideRook.hasMoved && !board[row][5] && !board[row][6]) {
        if (
          !isSquareAttacked(board, { row, col: 4 }, opposite(piece.color)) &&
          !isSquareAttacked(board, { row, col: 5 }, opposite(piece.color)) &&
          !isSquareAttacked(board, { row, col: 6 }, opposite(piece.color))
        ) {
          moves.push({ row, col: 6 });
        }
      }
      // roque longo (lado da dama)
      const queenSideRook = board[row][0];
      if (queenSideRook?.type === "R" && !queenSideRook.hasMoved && !board[row][1] && !board[row][2] && !board[row][3]) {
        if (
          !isSquareAttacked(board, { row, col: 4 }, opposite(piece.color)) &&
          !isSquareAttacked(board, { row, col: 3 }, opposite(piece.color)) &&
          !isSquareAttacked(board, { row, col: 2 }, opposite(piece.color))
        ) {
          moves.push({ row, col: 2 });
        }
      }
    }
  } else {
    const dirs =
      piece.type === "R"
        ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : piece.type === "B"
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]; // Q
    for (const [dr, dc] of dirs) {
      let r = from.row + dr;
      let c = from.col + dc;
      while (inBounds(r, c)) {
        const target = board[r][c];
        if (target) {
          if (target.color !== piece.color) moves.push({ row: r, col: c });
          break;
        }
        moves.push({ row: r, col: c });
        r += dr;
        c += dc;
      }
    }
  }

  return moves;
}

// Simula um lance (incluindo en passant e roque) e retorna o tabuleiro resultante
function simulateMove(state: ChessState, from: Square, to: Square): Board {
  const board = cloneBoard(state.board);
  const piece = board[from.row][from.col]!;

  // en passant: peão captura diagonalmente para casa vazia
  if (piece.type === "P" && from.col !== to.col && !board[to.row][to.col]) {
    board[from.row][to.col] = null; // remove o peão capturado
  }

  // roque: move a torre junto
  if (piece.type === "K" && Math.abs(to.col - from.col) === 2) {
    const row = from.row;
    if (to.col === 6) {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else if (to.col === 2) {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }

  board[to.row][to.col] = { ...piece, hasMoved: true };
  board[from.row][from.col] = null;
  return board;
}

export interface LegalMove {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

export function getLegalMoves(state: ChessState, color: PieceColor): LegalMove[] {
  const legal: LegalMove[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (!piece || piece.color !== color) continue;
      const from = { row, col };
      for (const to of pseudoMoves(state, from)) {
        const resultBoard = simulateMove(state, from, to);
        const king = findKing(resultBoard, color);
        if (king && isSquareAttacked(resultBoard, king, opposite(color))) continue; // deixaria o próprio rei em xeque
        if (piece.type === "P" && (to.row === 0 || to.row === 7)) {
          legal.push({ from, to, promotion: "Q" }); // promoção default para dama; cliente pode escolher outra
        } else {
          legal.push({ from, to });
        }
      }
    }
  }
  return legal;
}

export function isInCheck(state: ChessState, color: PieceColor): boolean {
  const king = findKing(state.board, color);
  if (!king) return false;
  return isSquareAttacked(state.board, king, opposite(color));
}

export interface MoveResult {
  state: ChessState;
  captured: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}

export function applyChessMove(state: ChessState, from: Square, to: Square, promotion: PieceType = "Q"): MoveResult {
  const piece = state.board[from.row][from.col];
  if (!piece) throw new Error("Não há peça na casa de origem");
  const color = piece.color;

  const legalMoves = getLegalMoves(state, color);
  const chosen = legalMoves.find((m) => m.from.row === from.row && m.from.col === from.col && m.to.row === to.row && m.to.col === to.col);
  if (!chosen) throw new Error("Movimento inválido");

  const captured = !!state.board[to.row][to.col] || (piece.type === "P" && from.col !== to.col && !state.board[to.row][to.col]);
  const newBoard = simulateMove(state, from, to);

  // promoção
  if (piece.type === "P" && (to.row === 0 || to.row === 7)) {
    newBoard[to.row][to.col] = { type: promotion, color, hasMoved: true };
  }

  // en passant target para o próximo lance (peão andou 2 casas)
  let enPassantTarget: Square | null = null;
  if (piece.type === "P" && Math.abs(to.row - from.row) === 2) {
    enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
  }

  const newState: ChessState = {
    ...state,
    board: newBoard,
    enPassantTarget,
    halfMoveClock: piece.type === "P" || captured ? 0 : state.halfMoveClock + 1,
    lastMove: { from, to },
  };

  const opponentColor = opposite(color);
  const opponentInCheck = isInCheck(newState, opponentColor);
  const opponentMoves = getLegalMoves(newState, opponentColor);
  const opponentHasMoves = opponentMoves.length > 0;

  let isCheckmate = false;
  let isStalemate = false;

  if (!opponentHasMoves) {
    if (opponentInCheck) {
      isCheckmate = true;
      newState.status = "CHECKMATE";
      newState.winnerUserId = state.players.find((p) => p.color === color)!.userId;
    } else {
      isStalemate = true;
      newState.status = "STALEMATE";
    }
  } else if (opponentInCheck) {
    newState.status = "CHECK";
  } else {
    newState.status = "PLAYING";
  }

  if (newState.halfMoveClock >= 100) newState.status = "DRAW"; // regra dos 50 lances (100 meios-lances)

  return { state: newState, captured, isCheck: opponentInCheck, isCheckmate, isStalemate };
}

export function advanceChessTurn(state: ChessState) {
  state.currentTurn = (state.currentTurn + 1) % state.players.length;
}
