import { LudoState, Color, Piece } from "../../types/ludo";
import {
  CELL,
  BOARD_SIZE,
  COLOR_HEX,
  COLOR_DARK,
  TRACK_CELLS,
  SAFE_TRACK_INDEXES,
  HOME_STRETCH,
  BASE_SPOTS,
} from "./boardGeometry";

interface Props {
  state: LudoState;
  myColor?: Color;
  movablePieces: string[];
  onMovePiece: (pieceId: string) => void;
}

function pieceScreenPos(piece: Piece, order: number): { x: number; y: number } {
  if (piece.position === -1) {
    const spot = BASE_SPOTS[piece.color][Number(piece.id.split("-")[1])];
    return { x: spot.x * CELL, y: spot.y * CELL };
  }
  if (piece.position >= 100) {
    const cell = HOME_STRETCH[piece.color][piece.position - 100];
    return { x: (cell.x + 0.5) * CELL, y: (cell.y + 0.5) * CELL };
  }
  const cell = TRACK_CELLS[piece.position];
  // pequeno deslocamento para não empilhar peças exatamente no centro da casa
  const offset = (order % 4) * 5 - 7;
  return { x: (cell.x + 0.5) * CELL + offset, y: (cell.y + 0.5) * CELL + offset };
}

export default function LudoBoard({ state, myColor, movablePieces, onMovePiece }: Props) {
  const corners: { color: Color; x: number; y: number }[] = [
    { color: "RED", x: 0, y: 0 },
    { color: "GREEN", x: 9, y: 0 },
    { color: "YELLOW", x: 9, y: 9 },
    { color: "BLUE", x: 0, y: 9 },
  ];

  return (
    <svg viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`} className="w-full h-full max-w-[560px] max-h-[560px] mx-auto select-none">
      <rect x={0} y={0} width={BOARD_SIZE} height={BOARD_SIZE} fill="#f5f0e6" rx={12} />

      {/* Quadrantes coloridos dos cantos, com 4 casas-base cada */}
      {corners.map((c) => (
        <g key={c.color}>
          <rect x={c.x * CELL} y={c.y * CELL} width={6 * CELL} height={6 * CELL} fill={COLOR_HEX[c.color]} opacity={0.18} />
          <rect x={(c.x + 1) * CELL} y={(c.y + 1) * CELL} width={4 * CELL} height={4 * CELL} rx={16} fill="#fff" stroke={COLOR_HEX[c.color]} strokeWidth={3} />
          {BASE_SPOTS[c.color].map((s, i) => (
            <circle key={i} cx={s.x * CELL} cy={s.y * CELL} r={CELL * 0.32} fill={COLOR_HEX[c.color]} opacity={0.25} />
          ))}
        </g>
      ))}

      {/* Caminho externo (52 células) */}
      {TRACK_CELLS.map((cell, i) => {
        const isSafe = SAFE_TRACK_INDEXES.includes(i);
        return (
          <rect
            key={i}
            x={cell.x * CELL}
            y={cell.y * CELL}
            width={CELL}
            height={CELL}
            fill={isSafe ? "#fff8e1" : "#ffffff"}
            stroke="#d8d2c4"
            strokeWidth={1}
          />
        );
      })}
      {SAFE_TRACK_INDEXES.map((i) => {
        const cell = TRACK_CELLS[i];
        return (
          <text key={i} x={(cell.x + 0.5) * CELL} y={(cell.y + 0.5) * CELL + 5} textAnchor="middle" fontSize={14} fill="#c9a227">
            ★
          </text>
        );
      })}

      {/* Corredores finais coloridos */}
      {(Object.keys(HOME_STRETCH) as Color[]).map((color) =>
        HOME_STRETCH[color].map((cell, i) => (
          <rect key={`${color}-${i}`} x={cell.x * CELL} y={cell.y * CELL} width={CELL} height={CELL} fill={COLOR_HEX[color]} opacity={0.55} stroke="#fff" strokeWidth={1} />
        ))
      )}

      {/* Centro (4 triângulos coloridos convergindo) */}
      <g transform={`translate(${6 * CELL},${6 * CELL})`}>
        <polygon points={`0,0 ${1.5 * CELL},${1.5 * CELL} 0,${3 * CELL}`} fill={COLOR_HEX.RED} />
        <polygon points={`0,0 ${1.5 * CELL},${1.5 * CELL} ${3 * CELL},0`} fill={COLOR_HEX.GREEN} />
        <polygon points={`${3 * CELL},0 ${1.5 * CELL},${1.5 * CELL} ${3 * CELL},${3 * CELL}`} fill={COLOR_HEX.YELLOW} />
        <polygon points={`0,${3 * CELL} ${1.5 * CELL},${1.5 * CELL} ${3 * CELL},${3 * CELL}`} fill={COLOR_HEX.BLUE} />
      </g>

      {/* Peças */}
      {state.pieces.map((piece, order) => {
        if (piece.finished) return null;
        const pos = pieceScreenPos(piece, order);
        const isMine = piece.color === myColor;
        const isMovable = movablePieces.includes(piece.id);
        return (
          <g
            key={piece.id}
            transform={`translate(${pos.x},${pos.y})`}
            onClick={() => isMovable && onMovePiece(piece.id)}
            style={{ cursor: isMovable ? "pointer" : "default" }}
          >
            {isMovable && <circle r={CELL * 0.42} fill="none" stroke={COLOR_HEX[piece.color]} strokeWidth={3} opacity={0.9}>
              <animate attributeName="r" values={`${CELL * 0.38};${CELL * 0.48};${CELL * 0.38}`} dur="1s" repeatCount="indefinite" />
            </circle>}
            <circle r={CELL * 0.33} fill={COLOR_HEX[piece.color]} stroke={COLOR_DARK[piece.color]} strokeWidth={2} />
            <circle r={CELL * 0.12} fill="#fff" opacity={0.5} cx={-3} cy={-3} />
            {isMine && <circle r={CELL * 0.42} fill="none" stroke="#fff" strokeWidth={1} opacity={0.6} />}
          </g>
        );
      })}
    </svg>
  );
}
