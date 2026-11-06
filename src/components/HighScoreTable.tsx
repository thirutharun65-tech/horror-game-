import { Trophy, Skull } from 'lucide-react';
import type { ScoreEntry } from '../game/scores';
import { formatTime } from '../game/scores';

export default function HighScoreTable({ scores, compact = false }: { scores: ScoreEntry[]; compact?: boolean }) {
  if (!scores.length) {
    return (
      <div className="flex items-center gap-2 justify-center text-slate-500 text-sm py-3">
        <Skull className="w-4 h-4" />
        <span>No souls claimed yet. Be the first legend.</span>
      </div>
    );
  }
  return (
    <div className={`score-scroll overflow-y-auto ${compact ? 'max-h-40' : 'max-h-56'} pr-1`}>
      {scores.map((s, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1.5 border ${
            i === 0
              ? 'bg-gradient-to-r from-amber-500/15 to-red-500/10 border-amber-500/30'
              : 'bg-white/[0.03] border-white/10'
          }`}
        >
          <div className={`font-mono2 text-sm w-6 text-center font-bold ${i === 0 ? 'text-amber-300' : i < 3 ? 'text-red-300' : 'text-slate-500'}`}>
            {i + 1}
          </div>
          {i === 0 && <Trophy className="w-4 h-4 text-amber-300 shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold tracking-wide truncate text-slate-100">{s.name}</div>
            <div className="text-[11px] text-slate-400 font-mono2">
              {formatTime(s.time)} · {s.kills} kills · W{s.wave}
            </div>
          </div>
          <div className={`font-mono2 font-bold text-sm ${i === 0 ? 'text-amber-200' : 'text-slate-200'}`}>
            {s.score.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
