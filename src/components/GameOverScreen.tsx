import { useState } from 'react';
import { RotateCcw, Home, Skull, Crown, Ghost, Swords, Timer, Layers } from 'lucide-react';
import HighScoreTable from './HighScoreTable';
import type { ScoreEntry } from '../game/scores';
import type { FinalStats } from '../game/engine';
import { formatTime } from '../game/scores';

interface Props {
  stats: FinalStats;
  scores: ScoreEntry[];
  isNewBest: boolean;
  onSubmitScore: (name: string) => void;
  submitted: boolean;
  onRestart: () => void;
  onQuit: () => void;
}

const TAUNTS = [
  'The dark keeps what it catches.',
  'Your lantern gutters out…',
  'They whispered your name first.',
  'No dawn comes for the lost.',
  'The shadows wear your face now.',
];

export default function GameOverScreen({ stats, scores, isNewBest, onSubmitScore, submitted, onRestart, onQuit }: Props) {
  const [name, setName] = useState('');
  const taunt = TAUNTS[stats.score % TAUNTS.length];

  return (
    <div className="scroll-area absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0a0205]/95 via-[#05060d]/95 to-black/95 backdrop-blur-[2px] p-4">
      <div className="relative w-full max-w-md my-auto">
        <div className="text-center animate-rise">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center mb-2 animate-heartbeat">
            <Skull className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="font-horror text-5xl md:text-6xl text-red-500 leading-none" style={{ textShadow: '0 0 30px rgba(255,42,60,.6)' }}>
            CLAIMED
          </h2>
          <p className="text-slate-400 italic text-sm mt-1">“{taunt}”</p>
          {isNewBest && !submitted && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/50 text-amber-200 text-xs font-extrabold tracking-widest animate-blood">
              <Crown className="w-3.5 h-3.5" /> NEW BEST — {stats.score.toLocaleString()}
            </div>
          )}
        </div>

        <div className="animate-rise-1 mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-center font-mono2 font-bold text-4xl text-slate-50 tabular-nums">{stats.score.toLocaleString()}</div>
          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
            {[
              { icon: Timer, label: 'TIME', val: formatTime(stats.time) },
              { icon: Ghost, label: 'KILLS', val: `${stats.kills}` },
              { icon: Layers, label: 'WAVE', val: `${stats.wave}` },
              { icon: Swords, label: 'COMBO', val: `×${stats.bestCombo}` },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-black/40 border border-white/10 px-1 py-2">
                <s.icon className="w-4 h-4 mx-auto text-red-300/80 mb-1" />
                <div className="font-mono2 font-bold text-sm text-slate-100">{s.val}</div>
                <div className="text-[9px] tracking-widest text-slate-500 font-bold">{s.label}</div>
              </div>
            ))}
          </div>

          {!submitted ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitScore(name.trim() || 'LOST SOUL');
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 14))}
                placeholder="Carve your name…"
                className="flex-1 min-w-0 rounded-xl bg-black/50 border border-white/15 px-3 py-2.5 text-sm font-bold tracking-wide text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-400/60"
                maxLength={14}
                autoFocus={false}
              />
              <button type="submit" className="btn-horror rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 border border-amber-300/40 px-4 py-2.5 text-sm font-extrabold tracking-wider text-black">
                SAVE
              </button>
            </form>
          ) : (
            <div className="mt-3">
              <HighScoreTable scores={scores} compact />
            </div>
          )}
        </div>

        <div className="animate-rise-2 mt-3 flex gap-2">
          <button onClick={onRestart} className="btn-horror animate-pulse-glow flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-red-600 to-red-800 border border-red-400/50 px-5 py-4 font-extrabold tracking-widest text-white">
            <RotateCcw className="w-5 h-5" /> AGAIN!
          </button>
          <button onClick={onQuit} className="btn-horror flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-bold text-sm text-slate-200">
            <Home className="w-4 h-4" /> MENU
          </button>
        </div>
        <div className="text-center text-[11px] text-slate-500 font-mono2 mt-2">press <span className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-slate-300">R</span> / <span className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-slate-300">ENTER</span> for instant restart</div>
      </div>
    </div>
  );
}
