import { useEffect, useState } from "react";

interface Props {
  clockMs: Record<string, number> | undefined;
  turnStartedAt: number | undefined;
  userId: string;
  isCurrentTurn: boolean;
  active: boolean; // false quando pausado
  label: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ClockDisplay({ clockMs, turnStartedAt, userId, isCurrentTurn, active, label }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active || !isCurrentTurn) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [active, isCurrentTurn]);

  const base = clockMs?.[userId] ?? 0;
  const elapsed = active && isCurrentTurn && turnStartedAt ? now - turnStartedAt : 0;
  const remaining = Math.max(0, base - elapsed);
  const isLow = remaining < 30_000;

  return (
    <div className={`text-center px-3 py-1.5 rounded-lg border ${isCurrentTurn ? "border-white/40 bg-white/5" : "border-border"}`}>
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={`font-mono text-sm font-medium ${isLow ? "text-red-400" : "text-white"}`}>{formatTime(remaining)}</div>
    </div>
  );
}
