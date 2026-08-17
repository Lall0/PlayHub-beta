interface Props {
  result: "CARA" | "COROA" | null;
  winnerName: string | null;
}

export default function CoinFlip({ result, winnerName }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="text-center">
        <div className={`text-7xl mb-4 ${result ? "" : "animate-spin"}`} style={{ animationDuration: "0.15s" }}>
          🪙
        </div>
        <p className="text-white/50 text-sm tracking-wide mb-1">CARA OU COROA</p>
        {result ? (
          <>
            <p className="text-2xl font-bold text-white">{result}</p>
            {winnerName && <p className="text-white/60 text-sm mt-2">{winnerName} começa!</p>}
          </>
        ) : (
          <p className="text-white/40 text-sm">girando...</p>
        )}
      </div>
    </div>
  );
}
