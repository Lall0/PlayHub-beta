export type Color = "RED" | "GREEN" | "YELLOW" | "BLUE";

export interface Piece {
  id: string;
  color: Color;
  position: number; // -1 base, 0-51 anel, 100-105 corredor final
  finished: boolean;
}

export interface LudoPlayer {
  userId: string;
  color: Color;
  order: number;
}

export interface LudoState {
  players: LudoPlayer[];
  pieces: Piece[];
  currentTurn: number;
  diceValue: number | null;
  diceRolledThisTurn: boolean;
  consecutiveSixes: number;
  status: "WAITING" | "PLAYING" | "PAUSED" | "FINISHED";
  winnerUserId?: string;
  rankedFinish: string[];
}

export interface RoomView {
  code: string;
  hostId: string;
  maxPlayers: number;
  status: "WAITING" | "PLAYING" | "PAUSED" | "FINISHED";
  players: { userId: string; username: string; color?: Color; order: number; connected: boolean }[];
  state?: LudoState;
}
