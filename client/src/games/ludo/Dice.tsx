import { useEffect, useState } from "react";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

export default function Dice({ value, rolling, canRoll, onRoll }: { value: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void }) {
  const [display, setDisplay] = useState(value || 1);

  useEffect(() => {
    if (value) {
      setDisplay(value);
    }
  }, [value]);

  return (
    <button
      onClick={onRoll}
      disabled={!canRoll}
      className={`w-16 h-16 rounded-xl bg-white flex-shrink-0 relative shadow-lg transition-transform
        ${canRoll ? "hover:scale-105 cursor-pointer" : "opacity-60 cursor-not-allowed"}
        ${rolling ? "animate-spin" : ""}`}
      style={{ animationDuration: rolling ? "0.4s" : undefined }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <rect x={2} y={2} width={96} height={96} rx={16} fill="#111" />
        {PIPS[display]?.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={8} fill="#fff" />
        ))}
      </svg>
    </button>
  );
}
