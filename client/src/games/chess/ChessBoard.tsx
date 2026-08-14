type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
type PieceColor = "WHITE" | "BLACK";
interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

const GLYPHS: Record<PieceColor, Record<PieceType, string>> = {
  WHITE: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  BLACK: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

interface Props {
  board: (ChessPiece | null)[][];
  myColor?: PieceColor;
  selected: { row: number; col: number } | null;
  legalDestinations: { row: number; col: number }[];
  lastMove?: { from: { row: number; col: number }; to: { row: number; col: number } };
  inCheckColor?: PieceColor | null;
  onSelect: (row: number, col: number) => void;
  onMoveTo: (row: number, col: number) => void;
}

const CELL = 56;
const SIZE = CELL * 8;

export default function ChessBoard({ board, myColor, selected, legalDestinations, lastMove, inCheckColor, onSelect, onMoveTo }: Props) {
  // Se o jogador é preto, inverte a exibição para ele ver o tabuleiro do seu lado
  const flip = myColor === "BLACK";
  const displayRow = (r: number) => (flip ? 7 - r : r);
  const displayCol = (c: number) => (flip ? 7 - c : c);

  const destSet = new Set(legalDestinations.map((d) => `${d.row}-${d.col}`));
  const lastMoveSet = new Set(lastMove ? [`${lastMove.from.row}-${lastMove.from.col}`, `${lastMove.to.row}-${lastMove.to.col}`] : []);

  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const dark = (row + col) % 2 === 1;
      const isLastMove = lastMoveSet.has(`${row}-${col}`);
      squares.push(
        <rect
          key={`sq-${row}-${col}`}
          x={displayCol(col) * CELL}
          y={displayRow(row) * CELL}
          width={CELL}
          height={CELL}
          fill={isLastMove ? (dark ? "#7a6a2e" : "#c9b76b") : dark ? "#3a3a3a" : "#eae7e0"}
          onClick={() => (selected ? onMoveTo(row, col) : onSelect(row, col))}
          style={{ cursor: "pointer" }}
        />
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full max-w-[520px] max-h-[520px] mx-auto select-none">
      {squares}

      {legalDestinations.map((d, i) => (
        <circle
          key={i}
          cx={displayCol(d.col) * CELL + CELL / 2}
          cy={displayRow(d.row) * CELL + CELL / 2}
          r={CELL * 0.14}
          fill="#22c55e"
          opacity={0.75}
          onClick={() => onMoveTo(d.row, d.col)}
          style={{ cursor: "pointer" }}
        />
      ))}

      {selected && (
        <rect
          x={displayCol(selected.col) * CELL}
          y={displayRow(selected.row) * CELL}
          width={CELL}
          height={CELL}
          fill="none"
          stroke="#22c55e"
          strokeWidth={3}
        />
      )}

      {board.map((row, r) =>
        row.map((piece, c) => {
          if (!piece) return null;
          const isKingInCheck = piece.type === "K" && piece.color === inCheckColor;
          return (
            <text
              key={`${r}-${c}`}
              x={displayCol(c) * CELL + CELL / 2}
              y={displayRow(r) * CELL + CELL / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={CELL * 0.72}
              fill={isKingInCheck ? "#ef4444" : piece.color === "WHITE" ? "#f5f5f0" : "#0a0a0a"}
              stroke={piece.color === "WHITE" ? "#333" : "none"}
              strokeWidth={piece.color === "WHITE" ? 1 : 0}
              onClick={() => (selected ? onMoveTo(r, c) : onSelect(r, c))}
              style={{ cursor: "pointer" }}
            >
              {GLYPHS[piece.color][piece.type]}
            </text>
          );
        })
      )}
    </svg>
  );
}
