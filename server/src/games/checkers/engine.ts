// Damas brasileiras simplificadas: tabuleiro 8x8, peças só nas casas escuras,
// captura obrigatória (e deve escolher a sequência de maior captura quando houver
// mais de uma opção — regra clássica), múltiplas capturas em cadeia, promoção a dama
// ao alcançar a última linha. Damas (peça promovida) capturam à distância (voo).

export type PieceColor = "LIGHT" | "DARK"; // dois jogadores
export type Square = { row: number; col: number }; // 0-7, 0-7

export interface CheckersPiece {
  id: string;
  color: PieceColor;
  row: number;
  col: number;
  king: boolean;
}

export interface CheckersState {
  players: { userId: string; color: PieceColor }[];
  pieces: CheckersPiece[];
  currentTurn: number; // índice em players[]
  status: "PLAYING" | "FINISHED";
  winnerUserId?: string;
}

function isDarkSquare(row: number, col: number) {
  return (row + col) % 2 === 1;
}

export function createInitialCheckersState(players: { userId: string; color: PieceColor }[]): CheckersState {
  const pieces: CheckersPiece[] = [];
  let id = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if (isDarkSquare(row, col)) pieces.push({ id: `p${id++}`, color: "DARK", row, col, king: false });
    }
  }
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (isDarkSquare(row, col)) pieces.push({ id: `p${id++}`, color: "LIGHT", row, col, king: false });
    }
  }
  return { players, pieces, currentTurn: 0, status: "PLAYING" };
}

function pieceAt(state: CheckersState, row: number, col: number): CheckersPiece | undefined {
  return state.pieces.find((p) => p.row === row && p.col === col);
}

function inBounds(row: number, col: number) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

interface CaptureSequence {
  path: Square[]; // casas percorridas após cada captura
  captured: string[]; // ids capturados na sequência
}

// Busca todas as sequências de captura possíveis para uma peça (recursivo, múltiplas capturas)
function findCaptureSequences(state: CheckersState, piece: CheckersPiece, visited: Set<string> = new Set()): CaptureSequence[] {
  const dirs = piece.king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : piece.color === "LIGHT"
    ? [[-1, -1], [-1, 1]] // LIGHT anda "para cima" (rows menores)
    : [[1, -1], [1, 1]]; // DARK anda "para baixo"

  const sequences: CaptureSequence[] = [];

  for (const [dr, dc] of dirs) {
    const midRow = piece.row + dr;
    const midCol = piece.col + dc;
    const destRow = piece.row + dr * 2;
    const destCol = piece.col + dc * 2;
    if (!inBounds(destRow, destCol)) continue;
    const mid = pieceAt(state, midRow, midCol);
    if (!mid || mid.color === piece.color) continue;
    if (visited.has(mid.id)) continue;
    if (pieceAt(state, destRow, destCol)) continue;

    // simula a captura para buscar continuações
    const nextVisited = new Set(visited);
    nextVisited.add(mid.id);
    const simulated: CheckersPiece = { ...piece, row: destRow, col: destCol };
    const stateAfter: CheckersState = {
      ...state,
      pieces: state.pieces.map((p) => (p.id === piece.id ? simulated : p)),
    };
    const continuations = findCaptureSequences(stateAfter, simulated, nextVisited);

    if (continuations.length === 0) {
      sequences.push({ path: [{ row: destRow, col: destCol }], captured: [mid.id] });
    } else {
      for (const cont of continuations) {
        sequences.push({ path: [{ row: destRow, col: destCol }, ...cont.path], captured: [mid.id, ...cont.captured] });
      }
    }
  }

  return sequences;
}

export interface CheckersMoveOption {
  pieceId: string;
  destination: Square;
  captured: string[];
  fullPath: Square[];
}

// Lista todos os movimentos legais do jogador atual
export function getLegalMoves(state: CheckersState, color: PieceColor): CheckersMoveOption[] {
  const myPieces = state.pieces.filter((p) => p.color === color);
  const allMoves: CheckersMoveOption[] = [];

  // Adiciona todos os movimentos de captura
  for (const piece of myPieces) {
    const seqs = findCaptureSequences(state, piece);
    for (const seq of seqs) {
      allMoves.push({
        pieceId: piece.id,
        destination: seq.path[seq.path.length - 1],
        captured: seq.captured,
        fullPath: seq.path,
      });
    }
  }

  // Adiciona todos os movimentos simples
  for (const piece of myPieces) {
    const dirs = piece.king
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.color === "LIGHT"
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];
    for (const [dr, dc] of dirs) {
      if (piece.king) {
        // dama: anda livremente na diagonal até encontrar obstáculo
        let r = piece.row + dr;
        let c = piece.col + dc;
        while (inBounds(r, c) && !pieceAt(state, r, c)) {
          allMoves.push({ pieceId: piece.id, destination: { row: r, col: c }, captured: [], fullPath: [{ row: r, col: c }] });
          r += dr;
          c += dc;
        }
      } else {
        const r = piece.row + dr;
        const c = piece.col + dc;
        if (inBounds(r, c) && !pieceAt(state, r, c)) {
          allMoves.push({ pieceId: piece.id, destination: { row: r, col: c }, captured: [], fullPath: [{ row: r, col: c }] });
        }
      }
    }
  }

  return allMoves;
}

export interface CheckersMoveResult {
  state: CheckersState;
  captured: string[];
  promoted: boolean;
}

export function applyCheckersMove(state: CheckersState, pieceId: string, destination: Square): CheckersMoveResult {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error("Peça inválida");

  const color = piece.color;
  const legalMoves = getLegalMoves(state, color);
  const chosen = legalMoves.find((m) => m.pieceId === pieceId && m.destination.row === destination.row && m.destination.col === destination.col);
  if (!chosen) throw new Error("Movimento inválido");

  let pieces = state.pieces.filter((p) => !chosen.captured.includes(p.id));
  pieces = pieces.map((p) => (p.id === pieceId ? { ...p, row: destination.row, col: destination.col } : p));

  let promoted = false;
  const moved = pieces.find((p) => p.id === pieceId)!;
  if (!moved.king && ((moved.color === "LIGHT" && moved.row === 0) || (moved.color === "DARK" && moved.row === 7))) {
    moved.king = true;
    promoted = true;
  }

  const newState: CheckersState = { ...state, pieces };

  const opponentColor = state.players.find((p) => p.color !== color)!.color;
  const opponentHasPieces = pieces.some((p) => p.color === opponentColor);
  const opponentHasMoves = opponentHasPieces && getLegalMoves(newState, opponentColor).length > 0;

  if (!opponentHasPieces || !opponentHasMoves) {
    newState.status = "FINISHED";
    newState.winnerUserId = state.players.find((p) => p.color === color)!.userId;
  }

  return { state: newState, captured: chosen.captured, promoted };
}

export function advanceCheckersTurn(state: CheckersState) {
  state.currentTurn = (state.currentTurn + 1) % state.players.length;
}
