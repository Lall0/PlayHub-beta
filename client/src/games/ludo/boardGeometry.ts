import { Color } from "../../types/ludo";

// Tabuleiro clássico 15x15. Cada célula = 1 unidade.
export const CELL = 32;
export const BOARD_SIZE = 15 * CELL;

export const COLOR_HEX: Record<Color, string> = {
  RED: "#e74c3c",
  GREEN: "#27ae60",
  YELLOW: "#f1c40f",
  BLUE: "#2f80ed",
};
export const COLOR_DARK: Record<Color, string> = {
  RED: "#a93226",
  GREEN: "#1e8449",
  YELLOW: "#b7950b",
  BLUE: "#1c5aa8",
};

// Caminho externo: 52 células, coordenadas de grid (col,row) em unidades de 15x15.
// Gerado seguindo o padrão clássico Retro, começando na saída vermelha exata.
export function buildTrackCells(): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  // braço esquerdo indo para a direita (linha 6, colunas 1-5) - Começa no quadrado retro!
  for (let c = 1; c <= 5; c++) cells.push({ x: c, y: 6 });
  // sobe na coluna 6 (linhas 5 a 0)
  for (let r = 5; r >= 0; r--) cells.push({ x: 6, y: r });
  cells.push({ x: 7, y: 0 });
  // desce na coluna 8 (linhas 0 a 5)
  for (let r = 0; r <= 5; r++) cells.push({ x: 8, y: r });
  // braço direito (linha 6, colunas 9-14)
  for (let c = 9; c <= 14; c++) cells.push({ x: c, y: 6 });
  cells.push({ x: 14, y: 7 });
  // braço direito (linha 8, colunas 14-9)
  for (let c = 14; c >= 9; c--) cells.push({ x: c, y: 8 });
  // desce na coluna 8 (linhas 9 a 14)
  for (let r = 9; r <= 14; r++) cells.push({ x: 8, y: r });
  cells.push({ x: 7, y: 14 });
  // sobe na coluna 6 (linhas 14 a 9)
  for (let r = 14; r >= 9; r--) cells.push({ x: 6, y: r });
  // braço esquerdo (linha 8, colunas 5-0)
  for (let c = 5; c >= 0; c--) cells.push({ x: c, y: 8 });
  cells.push({ x: 0, y: 7 });
  // Finaliza o braço esquerdo conectando na quina para fechar o loop
  cells.push({ x: 0, y: 6 });
  return cells; // 52 células perfeitas
}

export const TRACK_CELLS = buildTrackCells();

// As posições matematicamente perfeitas do Ludo Retro para saídas e estrelas
export const SAFE_TRACK_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];

// Corredor final de cada cor: 5 células levando ao centro
export const HOME_STRETCH: Record<Color, { x: number; y: number }[]> = {
  RED: [1, 2, 3, 4, 5].map((c) => ({ x: c, y: 7 })),
  GREEN: [1, 2, 3, 4, 5].map((r) => ({ x: 7, y: r })),
  YELLOW: [13, 12, 11, 10, 9].map((c) => ({ x: c, y: 7 })),
  BLUE: [13, 12, 11, 10, 9].map((r) => ({ x: 7, y: r })),
};

// Casas-base (4 posições dentro do quadrado colorido de cada canto)
export const BASE_SPOTS: Record<Color, { x: number; y: number }[]> = {
  RED: [{ x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 1.5, y: 3.5 }, { x: 3.5, y: 3.5 }],
  GREEN: [{ x: 10.5, y: 1.5 }, { x: 12.5, y: 1.5 }, { x: 10.5, y: 3.5 }, { x: 12.5, y: 3.5 }],
  YELLOW: [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }, { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 }],
  BLUE: [{ x: 1.5, y: 10.5 }, { x: 3.5, y: 10.5 }, { x: 1.5, y: 12.5 }, { x: 3.5, y: 12.5 }],
};