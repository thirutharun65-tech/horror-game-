export interface ScoreEntry {
  name: string;
  score: number;
  time: number;
  kills: number;
  wave: number;
  date: number;
}

const KEY = 'dreadlight_highscores_v1';

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 8);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* noop */ }
  return top;
}

export function bestScore(): number {
  const l = loadScores();
  return l.length ? l[0].score : 0;
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
