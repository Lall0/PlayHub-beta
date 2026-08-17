interface Piece {
  id: string;
  color: "LIGHT" | "DARK";
  row: number;
  col: number;
  king: boolean;
}

interface Destination {
  row: number;
  col: number;
  captured?: string[];
}

interface Props {
  pieces: Piece[];
  myColor?: "LIGHT" | "DARK";
  selectedPieceId: string | null;
  legalDestinations: Destination[];
  onSelectPiece: (pieceId: string) => void;
  onMoveTo: (row: number, col: number) => void;
}

const CELL = 56;
const SIZE = CELL * 8;

export default function CheckersBoard({ pieces, myColor, selectedPieceId, legalDestinations, onSelectPiece, onMoveTo }: Props) {
  const shouldRotate = myColor === "DARK";
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const dark = (row + col) % 2 === 1;
      squares.push(
        <rect
          key={`sq-${row}-${col}`}
          x={col * CELL}
          y={row * CELL}
          width={CELL}
          height={CELL}
          fill={dark ? "#2b2b2b" : "#f2f0ea"}
        />
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full h-full max-w-[520px] max-h-[520px] mx-auto select-none"
      style={{ transform: shouldRotate ? "rotate(180deg)" : undefined }}
    >
      {squares}

      {/* destinos legais: captura em destaque diferente (vermelho) de movimento simples (verde) */}
      {legalDestinations.map((d, i) => {
        const isCapture = !!d.captured?.length;
        return (
          <g key={i} onClick={() => onMoveTo(d.row, d.col)} style={{ cursor: "pointer" }}>
            {isCapture && (
              <circle cx={d.col * CELL + CELL / 2} cy={d.row * CELL + CELL / 2} r={CELL * 0.4} fill="none" stroke="#ef4444" strokeWidth={2.5} opacity={0.85}>
                <animate attributeName="r" values={`${CELL * 0.32};${CELL * 0.42};${CELL * 0.32}`} dur="1s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={d.col * CELL + CELL / 2}
              cy={d.row * CELL + CELL / 2}
              r={CELL * 0.15}
              fill={isCapture ? "#ef4444" : "#22c55e"}
              opacity={0.8}
            />
          </g>
        );
      })}

      {pieces.map((p) => {
        const isSelected = p.id === selectedPieceId;
        const isMine = p.color === myColor;
        const pieceTransform = `translate(${p.col * CELL + CELL / 2},${p.row * CELL + CELL / 2}) ${shouldRotate ? "rotate(-180)" : ""}`;
        return (
          <g
            key={p.id}
            transform={pieceTransform}
            onClick={() => isMine && onSelectPiece(p.id)}
            style={{ cursor: isMine ? "pointer" : "default" }}
          >
            <circle
              r={CELL * 0.38}
              fill={p.color === "LIGHT" ? "#f2f0ea" : "#161616"}
              stroke={isSelected ? "#22c55e" : p.color === "LIGHT" ? "#999" : "#000"}
              strokeWidth={isSelected ? 3 : 1.5}
            />
            {p.king && (
              <text textAnchor="middle" dominantBaseline="central" fontSize={CELL * 0.32} fill={p.color === "LIGHT" ? "#161616" : "#f2f0ea"}>
                ♛
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
