import crypto from "crypto";

export type Color = "RED" | "GREEN" | "YELLOW" | "BLUE";
export const ALL_COLORS: Color[] = ["RED", "GREEN", "YELLOW", "BLUE"];

// 52 casas no anel externo. Cada cor tem uma casa de partida e uma entrada
// para o corredor final (home stretch de 6 casas + 1 casa final).
export const START_INDEX: Record<Color, number> = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };
export const ENTRY_INDEX: Record<Color, number> = { RED: 50, GREEN: 11, YELLOW: 24, BLUE: 37 };
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export interface Piece {
  id: string; // ex: RED-0
  color: Color;
  // position: -1 = na base (não saiu), 0-51 = anel externo (índice absoluto),
  // 100-105 = corredor final (0 = entrada, 105 = chegada)
  position: number;
  finished: boolean;
}

export interface LudoState {
  players: { userId: string; color: Color; order: number }[];
  pieces: Piece[];
  currentTurn: number; // índice em players[]
  diceValue: number | null;
  diceRolledThisTurn: boolean;
  consecutiveSixes: number;
  status: "WAITING" | "PLAYING" | "PAUSED" | "FINISHED";
  winnerUserId?: string;
  rankedFinish: string[]; // userIds na ordem em que terminaram
}

export function createInitialState(players: { userId: string; color: Color; order: number }[]): LudoState {
  const pieces: Piece[] = [];
  for (const p of players) {
    for (let i = 0; i < 4; i++) {
      pieces.push({ id: `${p.color}-${i}`, color: p.color, position: -1, finished: false });
    }
  }
  return {
    players: [...players].sort((a, b) => a.order - b.order),
    pieces,
    currentTurn: 0,
    diceValue: null,
    diceRolledThisTurn: false,
    consecutiveSixes: 0,
    status: "PLAYING",
    rankedFinish: [],
  };
}

// Dado justo, gerado com crypto.randomInt — nunca confiar no cliente.
export function rollDice(): number {
  return crypto.randomInt(1, 7);
}

function absoluteIndex(color: Color, relative: number): number {
  return (START_INDEX[color] + relative) % 52;
}

function pieceAbsoluteTrackPos(piece: Piece): number | null {
  if (piece.position < 0 || piece.position >= 100) return null;
  return piece.position;
}

export function getMovablePieces(state: LudoState, color: Color, dice: number): string[] {
  const movable: string[] = [];
  for (const piece of state.pieces.filter((p) => p.color === color && !p.finished)) {
    if (piece.position === -1) {
      if (dice === 6) movable.push(piece.id);
      continue;
    }
    if (piece.position >= 100) {
      const homeOffset = piece.position - 100;
      if (homeOffset + dice <= 5) movable.push(piece.id);
      continue;
    }
    // Peça no anel: verificar se dado a leva até ou além da chegada sem estourar
    const relative = (piece.position - START_INDEX[piece.color] + 52) % 52;
    const newRelative = relative + dice;
    movable.push(piece.id); // sempre pode mover no anel (chegada tratada abaixo)
    void newRelative;
  }
  return movable;
}

export interface MoveResult {
  state: LudoState;
  captured: string[];
  finished: boolean;
  extraTurn: boolean;
  gameWinner?: string;
}

export function applyMove(state: LudoState, pieceId: string, dice: number): MoveResult {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error("Peça inválida");
  const captured: string[] = [];
  let finished = false;

  if (piece.position === -1) {
    if (dice !== 6) throw new Error("Só é possível sair da base tirando 6");
    piece.position = START_INDEX[piece.color];
  } else if (piece.position >= 100) {
    const homeOffset = piece.position - 100;
    const newOffset = homeOffset + dice;
    if (newOffset > 5) throw new Error("Movimento ultrapassa a chegada");
    piece.position = 100 + newOffset;
    if (newOffset === 5) {
      piece.finished = true;
      finished = true;
    }
  } else {
    const relative = (piece.position - START_INDEX[piece.color] + 52) % 52;
    const newRelative = relative + dice;
    const entryRelative = (ENTRY_INDEX[piece.color] - START_INDEX[piece.color] + 52) % 52;
    if (newRelative > entryRelative + 6) throw new Error("Movimento inválido");
    if (newRelative > entryRelative) {
      const homeOffset = newRelative - entryRelative - 1;
      piece.position = 100 + homeOffset;
      if (homeOffset === 5) {
        piece.finished = true;
        finished = true;
      }
    } else {
      piece.position = absoluteIndex(piece.color, newRelative);
      // captura: qualquer peça adversária na mesma casa (fora de casa segura) volta à base
      if (!SAFE_SQUARES.has(piece.position)) {
        for (const other of state.pieces) {
          if (other.color !== piece.color && !other.finished && other.position === piece.position) {
            other.position = -1;
            captured.push(other.id);
          }
        }
      }
    }
  }

  // vitória de um jogador: suas 4 peças chegaram
  let gameWinner: string | undefined;
  const colorPieces = state.pieces.filter((p) => p.color === piece.color);
  if (colorPieces.every((p) => p.finished)) {
    const player = state.players.find((p) => p.color === piece.color)!;
    if (!state.rankedFinish.includes(player.userId)) state.rankedFinish.push(player.userId);
    if (!gameWinner) gameWinner = player.userId;
    if (state.players.length === 2) {
      state.status = "FINISHED";
      state.winnerUserId = player.userId;
    } else {
      const remainingActive = state.players.length - state.rankedFinish.length;
      if (remainingActive <= 1) {
        state.status = "FINISHED";
        state.winnerUserId = state.rankedFinish[0];
      }
    }
  }

  const extraTurn = dice === 6 || captured.length > 0 || finished;
  return { state, captured, finished, extraTurn, gameWinner };
}

export function advanceTurn(state: LudoState) {
  const activePlayers = state.players.filter((p) => !state.rankedFinish.includes(p.userId));
  if (activePlayers.length <= 1) {
    state.status = "FINISHED";
    return;
  }
  let next = (state.currentTurn + 1) % state.players.length;
  while (state.rankedFinish.includes(state.players[next].userId)) {
    next = (next + 1) % state.players.length;
  }
  state.currentTurn = next;
  state.diceValue = null;
  state.diceRolledThisTurn = false;
  state.consecutiveSixes = 0;
}
