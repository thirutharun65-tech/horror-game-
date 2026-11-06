import { useEffect, useRef, useState, useCallback } from 'react';
import { DreadlightEngine, type HudSnapshot, type FinalStats } from './game/engine';
import { audio } from './game/audio';
import { loadScores, saveScore, type ScoreEntry } from './game/scores';
import StartScreen from './components/StartScreen';
import HUD from './components/HUD';
import PauseOverlay from './components/PauseOverlay';
import GameOverScreen from './components/GameOverScreen';
import TouchControls from './components/TouchControls';

type Screen = 'menu' | 'playing' | 'paused' | 'gameover';

const DEFAULT_HUD: HudSnapshot = {
  score: 0, time: 0, kills: 0, hp: 3, maxHp: 3, fuel: 100, maxFuel: 100,
  wave: 1, combo: 0, mult: 1, pulseCd: 0, pulseMax: 1.1, enemies: 0,
  soulsCollected: 0, moved: false, pulsed: false,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DreadlightEngine | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  screenRef.current = screen;

  const [hud, setHud] = useState<HudSnapshot>(DEFAULT_HUD);
  const [stats, setStats] = useState<FinalStats | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [muted, setMuted] = useState(audio.muted);
  const [submitted, setSubmitted] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  // ---- engine lifecycle ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;
    const engine = new DreadlightEngine(canvas);
    engineRef.current = engine;
    engine.onHud = (h) => setHud(h);
    engine.onGameOver = (s) => {
      setStats(s);
      const best = loadScores()[0]?.score ?? 0;
      setIsNewBest(s.score > best && s.score > 0);
      setSubmitted(false);
      setScores(loadScores());
      setScreen('gameover');
    };
    engine.attach();
    engine.start();
    engine.setPaused(true); // idle behind menu
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      engine.stop();
      engine.detach();
      engineRef.current = null;
    };
  }, []);

  const startGame = useCallback(() => {
    audio.unlock();
    audio.uiClick();
    setStats(null);
    setSubmitted(false);
    setIsNewBest(false);
    setHud(DEFAULT_HUD);
    engineRef.current?.reset();
    engineRef.current?.setPaused(false);
    setScreen('playing');
  }, []);

  const pauseGame = useCallback(() => {
    if (screenRef.current !== 'playing') return;
    audio.uiClick();
    audio.setHeartbeat(false);
    engineRef.current?.setPaused(true);
    setScreen('paused');
  }, []);

  const resumeGame = useCallback(() => {
    audio.unlock();
    audio.uiClick();
    engineRef.current?.setPaused(false);
    setScreen('playing');
  }, []);

  const quitToMenu = useCallback(() => {
    audio.uiClick();
    audio.setHeartbeat(false);
    engineRef.current?.setPaused(true);
    setScores(loadScores());
    setScreen('menu');
  }, []);

  const toggleMute = useCallback(() => {
    const m = !audio.muted;
    audio.setMuted(m);
    setMuted(m);
  }, []);

  const submitScore = useCallback((name: string) => {
    if (!stats) return;
    audio.uiClick();
    const entry: ScoreEntry = {
      name: name.toUpperCase().slice(0, 14),
      score: stats.score,
      time: stats.time,
      kills: stats.kills,
      wave: stats.wave,
      date: Date.now(),
    };
    const top = saveScore(entry);
    setScores(top);
    setSubmitted(true);
  }, [stats]);

  // auto-pause when tab hidden / app backgrounded
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && screenRef.current === 'playing') {
        engineRef.current?.setPaused(true);
        setScreen('paused');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onVis);
    };
  }, []);

  // ---- global shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      const s = screenRef.current;
      if (k === 'enter') {
        if (s === 'menu') startGame();
        else if (s === 'gameover' && submitted) startGame();
        else if (s === 'paused') resumeGame();
      } else if (k === 'r') {
        if (s === 'gameover' || s === 'paused' || s === 'playing') startGame();
      } else if (k === 'p' || k === 'escape') {
        if (s === 'playing') pauseGame();
        else if (s === 'paused') resumeGame();
      } else if (k === 'm') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startGame, pauseGame, resumeGame, toggleMute, submitted]);

  // keep submitted gameover restart via Enter even when typing name? input handles its own Enter (submit). Guard: if typing, skip.
  const best = scores[0]?.score ?? 0;

  return (
    <div className="fixed inset-0 bg-[#05060d] overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      {/* game canvas */}
      <canvas ref={canvasRef} className="game-canvas absolute inset-0" />

      {/* film grain + vignette + scanlines (cheap CSS juice) */}
      <div className="grain-overlay z-10" />
      <div className="vignette-overlay z-10" />
      <div className="scanlines z-10" />

      {(screen === 'playing' || screen === 'paused') && (
        <HUD hud={hud} best={best} muted={muted} onPause={pauseGame} onToggleMute={toggleMute} />
      )}

      {screen === 'playing' && (
        <TouchControls
          engineRef={engineRef}
          pulseReady={hud.pulseCd <= 0}
          pulsePct={1 - hud.pulseCd / hud.pulseMax}
        />
      )}

      {screen === 'menu' && (
        <StartScreen scores={scores} muted={muted} onToggleMute={toggleMute} onStart={startGame} />
      )}

      {screen === 'paused' && (
        <PauseOverlay score={hud.score} onResume={resumeGame} onRestart={startGame} onQuit={quitToMenu} />
      )}

      {screen === 'gameover' && stats && (
        <GameOverScreen
          stats={stats}
          scores={scores}
          isNewBest={isNewBest}
          onSubmitScore={submitScore}
          submitted={submitted}
          onRestart={startGame}
          onQuit={quitToMenu}
        />
      )}
    </div>
  );
}
