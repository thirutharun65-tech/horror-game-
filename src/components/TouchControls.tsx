import { useRef, useState, useEffect, type RefObject } from 'react';
import { Zap } from 'lucide-react';
import type { DreadlightEngine } from '../game/engine';

interface Props {
  engineRef: RefObject<DreadlightEngine | null>;
  pulseReady: boolean;
  pulsePct: number;
}

export default function TouchControls({ engineRef, pulseReady, pulsePct }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ active: boolean; ox: number; oy: number; dx: number; dy: number }>({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 });
  const touchId = useRef<number | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const onTouch = () => setIsTouch(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    // also show on small screens with mouse? only touch/coarse pointers
    if (window.matchMedia?.('(pointer: coarse)').matches) setIsTouch(true);
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    const R = 52;
    const handleStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      touchId.current = t.identifier;
      const rect = zone.getBoundingClientRect();
      // origin where finger landed, clamped inside zone
      const ox = t.clientX - rect.left;
      const oy = t.clientY - rect.top;
      setStick({ active: true, ox, oy, dx: 0, dy: 0 });
      if (engineRef.current) {
        engineRef.current.input.joyActive = true;
        engineRef.current.input.joyX = 0;
        engineRef.current.input.joyY = 0;
      }
    };
    const handleMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== touchId.current) continue;
        const rect = zone.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        setStick((s) => {
          let dx = x - s.ox, dy = y - s.oy;
          const d = Math.hypot(dx, dy);
          const max = R * 1.6;
          if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
          const nx = dx / max, ny = dy / max;
          if (engineRef.current) {
            engineRef.current.input.joyActive = true;
            // deadzone
            const m = Math.hypot(nx, ny);
            if (m < 0.14) {
              engineRef.current.input.joyX = 0;
              engineRef.current.input.joyY = 0;
            } else {
              engineRef.current.input.joyX = nx;
              engineRef.current.input.joyY = ny;
            }
          }
          return { ...s, dx, dy };
        });
        e.preventDefault();
      }
    };
    const handleEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== touchId.current) continue;
        touchId.current = null;
        setStick((s) => ({ ...s, active: false, dx: 0, dy: 0 }));
        if (engineRef.current) {
          engineRef.current.input.joyActive = false;
          engineRef.current.input.joyX = 0;
          engineRef.current.input.joyY = 0;
        }
      }
    };

    zone.addEventListener('touchstart', handleStart, { passive: true });
    zone.addEventListener('touchmove', handleMove, { passive: false });
    zone.addEventListener('touchend', handleEnd);
    zone.addEventListener('touchcancel', handleEnd);
    return () => {
      zone.removeEventListener('touchstart', handleStart);
      zone.removeEventListener('touchmove', handleMove);
      zone.removeEventListener('touchend', handleEnd);
      zone.removeEventListener('touchcancel', handleEnd);
    };
  }, [engineRef]);

  if (!isTouch) return null;

  return (
    <>
      {/* joystick zone — left half bottom */}
      <div ref={zoneRef} className="absolute left-0 bottom-0 w-[55%] h-[62%] z-20" style={{ touchAction: 'none' }}>
        {stick.active ? (
          <div
            className="joystick-base absolute w-28 h-28 rounded-full"
            style={{ left: stick.ox - 56, top: stick.oy - 56 }}
          >
            <div
              className="joystick-knob absolute w-12 h-12 rounded-full"
              style={{
                left: 56 - 24 + stick.dx * 0.62,
                top: 56 - 24 + stick.dy * 0.62,
              }}
            />
          </div>
        ) : (
          <div className="absolute left-6 bottom-8 w-24 h-24 rounded-full border border-dashed border-white/20 flex items-center justify-center">
            <span className="text-white/30 text-[10px] font-bold tracking-widest">DRAG</span>
          </div>
        )}
      </div>

      {/* pulse button */}
      <div className="absolute right-4 bottom-8 z-20 flex flex-col items-center gap-1.5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            engineRef.current?.queuePulse();
          }}
          onMouseDown={() => engineRef.current?.queuePulse()}
          className={`relative w-20 h-20 rounded-full border-2 font-extrabold active:scale-90 transition-transform ${
            pulseReady
              ? 'border-amber-200 bg-gradient-to-b from-amber-400 to-red-600 text-white shadow-[0_0_30px_rgba(255,179,64,0.7)]'
              : 'border-white/20 bg-black/50 text-slate-500'
          }`}
          style={{ touchAction: 'none' }}
          aria-label="pulse"
        >
          {!pulseReady && (
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
              <circle
                cx="40" cy="40" r="35" fill="none" stroke="#ffb340" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${pulsePct * 220} 220`}
              />
            </svg>
          )}
          <Zap className={`w-8 h-8 mx-auto ${pulseReady ? 'fill-white' : ''}`} />
          <span className="text-[9px] tracking-widest block -mt-0.5">PULSE</span>
        </button>
      </div>
    </>
  );
}
