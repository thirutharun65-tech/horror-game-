import { Pause, Volume2, VolumeX, Zap, Flame, Heart } from 'lucide-react';
import type { HudSnapshot } from '../game/engine';
import { formatTime } from '../game/scores';

interface Props {
  hud: HudSnapshot;
  best: number;
  muted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

export default function HUD({ hud, best, muted, onPause, onToggleMute }: Props) {
  const fuelPct = Math.max(0, Math.min(1, hud.fuel / hud.maxFuel));
  const pulseReady = hud.pulseCd <= 0;
  const pulsePct = 1 - hud.pulseCd / hud.pulseMax;
  const fuelColor = fuelPct > 0.5 ? 'from-amber-400 to-orange-500' : fuelPct > 0.22 ? 'from-orange-500 to-red-500' : 'from-red-500 to-red-700';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none">
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 p-3 md:p-4 flex items-start justify-between gap-2" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {/* left: hearts + fuel */}
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <div className="flex items-center gap-1">
            {Array.from({ length: hud.maxHp }).map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 md:w-6 md:h-6 transition-all duration-200 ${i < hud.hp ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_6px_rgba(255,42,80,0.8)]' : 'text-slate-700 fill-slate-800 scale-90'}`}
              />
            ))}
            <span className="ml-1.5 text-[11px] font-mono2 text-slate-400">W{hud.wave}</span>
          </div>
          <div className="w-36 md:w-44">
            <div className="flex items-center gap-1 mb-0.5">
              <Flame className={`w-3.5 h-3.5 ${fuelPct < 0.22 ? 'text-red-400 animate-blood' : 'text-amber-300'}`} />
              <span className={`text-[10px] font-bold tracking-widest ${fuelPct < 0.22 ? 'text-red-300' : 'text-amber-200/80'}`}>
                {fuelPct < 0.22 ? 'OIL LOW!' : 'LANTERN'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-black/60 border border-white/15 overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${fuelColor} transition-[width] duration-200`} style={{ width: `${fuelPct * 100}%`, boxShadow: '0 0 10px rgba(255,150,40,0.7)' }} />
            </div>
          </div>
        </div>

        {/* center: score */}
        <div className="flex flex-col items-center -mt-0.5">
          <div className="font-mono2 font-bold text-2xl md:text-3xl text-slate-50 tabular-nums leading-none" style={{ textShadow: '0 0 18px rgba(255,42,60,0.4), 0 2px 8px black' }}>
            {hud.score.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono2 text-slate-300">
            <span className="tabular-nums">{formatTime(hud.time)}</span>
            <span className="text-slate-600">·</span>
            <span className="tabular-nums">{hud.kills} kills</span>
            {hud.score > 0 && best > 0 && <span className="hidden sm:inline text-slate-500">· BEST {Math.max(best, hud.score).toLocaleString()}</span>}
          </div>
          {hud.combo >= 2 && (
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs font-extrabold tracking-wider animate-heartbeat">
              ×{hud.mult.toFixed(1)} · {hud.combo} COMBO
            </div>
          )}
        </div>

        {/* right: buttons */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button onClick={onToggleMute} className="btn-horror w-9 h-9 rounded-xl border border-white/15 bg-black/50 backdrop-blur flex items-center justify-center text-slate-300" aria-label="mute">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button onClick={onPause} className="btn-horror w-9 h-9 rounded-xl border border-white/15 bg-black/50 backdrop-blur flex items-center justify-center text-slate-300" aria-label="pause">
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* pulse cooldown — desktop bottom center + mobile handled by touch button */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold tracking-widest transition-all ${pulseReady ? 'border-amber-300/60 bg-amber-400/10 text-amber-200 shadow-[0_0_16px_rgba(255,179,64,0.35)]' : 'border-white/10 bg-black/40 text-slate-500'}`}>
          <Zap className={`w-3.5 h-3.5 ${pulseReady ? 'fill-amber-300' : ''}`} />
          {pulseReady ? 'PULSE READY — SPACE' : 'CHARGING…'}
        </div>
        {!pulseReady && (
          <div className="w-28 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-amber-400/80" style={{ width: `${pulsePct * 100}%` }} />
          </div>
        )}
      </div>

      {/* tutorial hints — first 10 seconds */}
      {(!hud.moved || !hud.pulsed) && hud.time < 25 && (
        <div className="absolute bottom-20 md:bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-max max-w-[92vw]">
          {!hud.moved && (
            <div className="px-4 py-2 rounded-full bg-sky-500/15 border border-sky-300/40 text-sky-100 text-xs md:text-sm font-bold tracking-wide animate-bounce">
              👆 MOVE — WASD / Arrows / Drag
            </div>
          )}
          {hud.moved && !hud.pulsed && (
            <div className="px-4 py-2 rounded-full bg-amber-500/15 border border-amber-300/50 text-amber-100 text-xs md:text-sm font-bold tracking-wide animate-bounce">
              ⚡ PULSE — SPACE / Click / Tap bolt
            </div>
          )}
        </div>
      )}

      {/* wave banner flash handled in-canvas; low-hp edge warning */}
      {hud.hp === 1 && (
        <div className="absolute inset-0 pointer-events-none animate-blood" style={{ boxShadow: 'inset 0 0 90px 30px rgba(255,10,30,0.35)' }} />
      )}
    </div>
  );
}
