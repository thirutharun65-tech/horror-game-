import { Play, RotateCcw, Home, Moon } from 'lucide-react';

interface Props {
  score: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export default function PauseOverlay({ score, onResume, onRestart, onQuit }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="animate-rise w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0e1c]/95 p-6 text-center shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center mb-3">
          <Moon className="w-6 h-6 text-indigo-300" />
        </div>
        <h2 className="font-horror text-4xl text-slate-100 tracking-wide">PAUSED</h2>
        <p className="text-slate-400 text-sm mt-1">The shadows wait for you…</p>
        <div className="mt-3 inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 font-mono2 text-amber-200 font-bold">
          {score.toLocaleString()} pts
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onResume} className="btn-horror flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-red-600 to-red-800 border border-red-400/40 px-5 py-3.5 font-extrabold tracking-widest text-white">
            <Play className="w-5 h-5 fill-current" /> RESUME
          </button>
          <div className="flex gap-2">
            <button onClick={onRestart} className="btn-horror flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-sm text-slate-200">
              <RotateCcw className="w-4 h-4" /> RESTART
            </button>
            <button onClick={onQuit} className="btn-horror flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-sm text-slate-200">
              <Home className="w-4 h-4" /> MENU
            </button>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500 font-mono2">P / ESC resume · R restart</div>
      </div>
    </div>
  );
}
