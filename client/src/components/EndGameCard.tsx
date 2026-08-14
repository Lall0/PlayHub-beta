interface Props {
  players: { userId: string; username: string }[];
  endVotes: string[];
  myUserId?: string;
  isHost: boolean;
  onConfirm: () => void;
  onCancelVote: () => void;
  onForceEnd: () => void;
  onClose: () => void;
}

export default function EndGameCard({ players, endVotes, myUserId, isHost, onConfirm, onCancelVote, onForceEnd, onClose }: Props) {
  const iVoted = endVotes.includes(myUserId || "");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full">
        <h3 className="text-white font-semibold mb-1">Encerrar partida</h3>
        <p className="text-white/50 text-sm mb-5">
          Todos os jogadores precisam confirmar para encerrar de comum acordo.
          {isHost && " Como anfitrião, você também pode forçar o encerramento imediatamente."}
        </p>

        <div className="space-y-2 mb-5">
          {players.map((p) => {
            const confirmed = endVotes.includes(p.userId);
            return (
              <div key={p.userId} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-surface-2 border border-border">
                <span className="text-white/80">{p.username}</span>
                {confirmed ? (
                  <span className="vote-check text-green-400 text-xs font-medium">✓ confirmou</span>
                ) : (
                  <span className="text-white/30 text-xs">aguardando</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {!iVoted ? (
            <button onClick={onConfirm} className="w-full bg-white text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-white/90 transition">
              Confirmar encerramento
            </button>
          ) : (
            <button onClick={onCancelVote} className="w-full border border-border text-white/70 rounded-lg py-2.5 text-sm hover:border-white/40 transition">
              Cancelar minha confirmação
            </button>
          )}
          {isHost && (
            <button onClick={onForceEnd} className="w-full text-red-400 text-xs py-2 hover:text-red-300 transition">
              Forçar encerramento agora (anfitrião)
            </button>
          )}
          <button onClick={onClose} className="w-full text-white/40 text-xs py-1 hover:text-white/60 transition">
            Voltar ao jogo
          </button>
        </div>
      </div>
    </div>
  );
}
