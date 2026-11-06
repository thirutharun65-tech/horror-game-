import { Play, Zap, Move, Trophy, Volume2, VolumeX, Droplet, Ghost, Heart, Sparkles } from 'lucide-react';
import HighScoreTable from './HighScoreTable';
import type { ScoreEntry } from '../game/scores';

interface Props {
  scores: ScoreEntry[];
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
}

export default function StartScreen({ scores, muted, onToggleMute, onStart }: Props) {
  return (
    <div className="scroll-area absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#05060d]/92 backdrop-blur-[2px] p-4">
      {/* fog layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-fog absolute -inset-10 opacity-40" style={{ background: 'radial-gradient(ellipse 60% 40% at 30% 60%, rgba(120,20,30,0.25), transparent 70%), radial-gradient(ellipse 50% 35% at 70% 30%, rgba(40,50,120,0.22), transparent 70%)' }} />
        <div className="animate-fog-slow absolute -inset-10 opacity-30" style={{ background: 'radial-gradient(ellipse 45% 30% at 60% 70%, rgba(255,150,40,0.12), transparent 70%)' }} />
        {/* floating embers */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 53 + 11) % 100}%`,
              bottom: '-10px',
              width: i % 3 === 0 ? 4 : 2.5,
              height: i % 3 === 0 ? 4 : 2.5,
              background: i % 4 === 0 ? '#7df9ff' : '#ffb340',
              boxShadow: i % 4 === 0 ? '0 0 8px #7df9ff' : '0 0 8px #ffb340',
              animation: `emberFloat ${5 + (i % 5) * 1.6}s linear ${i * 0.7}s infinite`,
            }}
          />
        ))}
        {/* blood moon */}
        <div className="absolute top-8 right-8 w-20 h-20 md:w-28 md:h-28 rounded-full opacity-80" style={{ background: 'radial-gradient(circle at 38% 35%, #ff8a7a, #c81e2e 55%, #4a0812 100%)', boxShadow: '0 0 60px rgba(255,42,60,0.5), 0 0 140px rgba(255,42,60,0.25)' }} />
        <div className="absolute top-10 right-10 w-20 h-20 md:w-28 md:h-28 rounded-full" style={{ background: 'radial-gradient(circle at 65% 60%, transparent 40%, rgba(5,6,13,0.55) 72%)' }} />
      </div>

      <div className="relative w-full max-w-lg my-auto">
        <div className="text-center mb-4 animate-rise">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-300 text-[11px] font-bold tracking-[0.25em] mb-3">
            <Ghost className="w-3.5 h-3.5" />
            A LANTERN-HORROR SURVIVAL
          </div>
          <h1 className="font-horror animate-title-flicker text-6xl md:text-7xl leading-none text-red-500" style={{ textShadow: '0 0 24px rgba(255,42,60,.55), 0 0 80px rgba(255,179,64,.25)' }}>
            DREADLIGHT
          </h1>
          <p className="mt-2 text-slate-300 text-sm md:text-[15px] font-medium tracking-wide">
            They fear the light. <span className="text-amber-300">Keep it burning.</span> Survive till dawn — there is no dawn.
          </p>
        </div>

        <div className="animate-rise-1 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-4 mb-3">
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            <div className="flex items-start gap-2 rounded-xl bg-black/30 border border-white/10 p-2.5">
              <Move className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
              <div><span className="font-bold text-slate-100">MOVE</span><br /><span className="text-slate-400">WASD / Arrows<br />or drag left side</span></div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-black/30 border border-amber-500/25 p-2.5">
              <Zap className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div><span className="font-bold text-amber-200">PULSE</span><br /><span className="text-slate-400">SPACE / Click<br />or tap ⚡ button</span></div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-black/30 border border-white/10 p-2.5">
              <Droplet className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div><span className="font-bold text-slate-100">OIL = LIFE</span><br /><span className="text-slate-400">Grab amber cans, light burns shadows</span></div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-black/30 border border-white/10 p-2.5">
              <Heart className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div><span className="font-bold text-slate-100">3 HEARTS</span><br /><span className="text-slate-400">Chain kills for <span className="text-amber-300 font-bold">combo ×4</span> score</span></div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-slate-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span><b className="text-amber-200">TIP:</b> hold <b className="text-slate-200">SHIFT</b> (or push stick to edge) to sprint — it drains oil faster. Pulse knocks back brutes.</span>
          </div>
        </div>

        <div className="animate-rise-2 flex gap-2 mb-3">
          <button
            onClick={onStart}
            className="btn-horror animate-pulse-glow flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-red-600 to-red-800 border border-red-400/50 px-6 py-4 font-extrabold text-lg tracking-widest text-white"
          >
            <Play className="w-5 h-5 fill-current" />
            ENTER THE DARK
          </button>
          <button
            onClick={onToggleMute}
            className="btn-horror rounded-2xl border border-white/15 bg-white/5 px-4 text-slate-300"
            aria-label="toggle sound"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-center text-[11px] text-slate-500 font-mono2 mb-3">press <span className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-slate-300">ENTER</span> to begin · <span className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-slate-300">P</span> pause · best on desktop + mobile</div>

        <div className="animate-rise-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Trophy className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-extrabold tracking-[0.2em] text-slate-300">HALL OF SURVIVORS · LOCAL</span>
          </div>
          <HighScoreTable scores={scores} compact />
        </div>
      </div>
    </div>
  );
}
