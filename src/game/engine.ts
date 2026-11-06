import { audio } from './audio';

export interface HudSnapshot {
  score: number;
  time: number;
  kills: number;
  hp: number;
  maxHp: number;
  fuel: number;
  maxFuel: number;
  wave: number;
  combo: number;
  mult: number;
  pulseCd: number;
  pulseMax: number;
  enemies: number;
  soulsCollected: number;
  moved: boolean;
  pulsed: boolean;
}

export interface FinalStats {
  score: number;
  time: number;
  kills: number;
  wave: number;
  souls: number;
  bestCombo: number;
}

interface Enemy {
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number;
  type: 0 | 1 | 2 | 3; // 0 stalker, 1 crawler, 2 brute, 3 wraith
  speed: number; radius: number;
  phase: number; flash: number; burn: number;
  kx: number; ky: number;
  spawnT: number; teleCd: number; zig: number;
  dead: boolean;
}

interface Particle {
  alive: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: string; drag: number; grav: number; glow: boolean; shrink: boolean;
}

interface FloatText {
  alive: boolean; x: number; y: number; vy: number;
  life: number; maxLife: number; text: string; color: string; size: number;
}

interface Pickup {
  alive: boolean; kind: 'oil' | 'soul' | 'heart' | 'page';
  x: number; y: number; phase: number; vx: number; vy: number; life: number;
}

interface PulseRing { alive: boolean; x: number; y: number; r: number; maxR: number; life: number; maxLife: number; }

interface Decor { x: number; y: number; kind: number; s: number; rot: number }

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLD = 2400;
const TAU = Math.PI * 2;

export class DreadlightEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  running = false;
  paused = false;
  private raf = 0;
  private last = 0;
  private w = 0; private h = 0; private dpr = 1;

  input = { up: false, down: false, left: false, right: false, sprint: false, joyX: 0, joyY: 0, joyActive: false };
  private pulseQueued = false;

  // state
  px = WORLD / 2; py = WORLD / 2; pvx = 0; pvy = 0;
  hp = 3; maxHp = 3;
  fuel = 100; maxFuel = 100;
  face = 0; moving = false; moveMag = 0;
  invuln = 0; pulseCd = 0; pulseMax = 1.1; pulseAnim = 0;
  flicker = 1; flickerT = 0;
  score = 0; time = 0; kills = 0; soulsCollected = 0;
  combo = 0; comboT = 0; bestCombo = 0; mult = 1;
  wave = 1; waveT = 0; spawnT = 0.6; oilT = 4; heartT = 0; pageT = 12;
  survivalTick = 0;

  enemies: Enemy[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  pickups: Pickup[] = [];
  rings: PulseRing[] = [];
  decor: Decor[] = [];

  camX = WORLD / 2; camY = WORLD / 2;
  trauma = 0; hitstop = 0; flashRed = 0; flashWhite = 0; lightning = 0; lightningT = 8;
  lowFuelWarned = false;

  moved = false; pulsed = false;

  onHud: ((h: HudSnapshot) => void) | null = null;
  onGameOver: ((s: FinalStats) => void) | null = null;
  private hudT = 0;
  private over = false;
  private keys = new Set<string>();

  private keyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    this.syncKeys();
    if (k === ' ' || k === 'f' || k === 'j') this.pulseQueued = true;
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
    this.syncKeys();
  };
  private onPointerDown = (e: PointerEvent) => {
    // mouse click on canvas = pulse (but ignore touch joystick area handled by React)
    if (e.pointerType === 'mouse') this.pulseQueued = true;
  };
  private onResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    // pools
    for (let i = 0; i < 420; i++) this.particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0, grav: 0, glow: false, shrink: true });
    for (let i = 0; i < 36; i++) this.texts.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 14 });
    for (let i = 0; i < 60; i++) this.pickups.push({ alive: false, kind: 'soul', x: 0, y: 0, phase: 0, vx: 0, vy: 0, life: 0 });
    for (let i = 0; i < 12; i++) this.rings.push({ alive: false, x: 0, y: 0, r: 0, maxR: 200, life: 0, maxLife: 0.5 });
    this.genDecor();
    this.resize();
  }

  private genDecor() {
    const rnd = mulberry32(1337);
    this.decor = [];
    for (let i = 0; i < 110; i++) {
      this.decor.push({ x: rnd() * WORLD, y: rnd() * WORLD, kind: 0, s: 0.7 + rnd() * 0.9, rot: rnd() * TAU });
    }
    for (let i = 0; i < 46; i++) {
      this.decor.push({ x: rnd() * WORLD, y: rnd() * WORLD, kind: 1, s: 0.7 + rnd() * 0.8, rot: (rnd() - 0.5) * 0.5 });
    }
    for (let i = 0; i < 34; i++) {
      this.decor.push({ x: rnd() * WORLD, y: rnd() * WORLD, kind: 2, s: 0.6 + rnd() * 1.0, rot: rnd() * TAU });
    }
  }

  private syncKeys() {
    const k = this.keys;
    this.input.up = k.has('w') || k.has('arrowup');
    this.input.down = k.has('s') || k.has('arrowdown');
    this.input.left = k.has('a') || k.has('arrowleft');
    this.input.right = k.has('d') || k.has('arrowright');
    this.input.sprint = k.has('shift');
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const vw = Math.max(1, Math.floor(rect.width));
    const vh = Math.max(1, Math.floor(rect.height));
    const isMobile = Math.min(vw, vh) < 700;
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2);
    this.w = vw; this.h = vh;
    this.canvas.width = Math.floor(vw * this.dpr);
    this.canvas.height = Math.floor(vh * this.dpr);
  }

  attach() {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }
  detach() {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
  }

  private pauseFrames = 0;

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.over = false;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (t - this.last) / 1000;
      this.last = t;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) return;
      if (!this.paused && !this.over) {
        if (this.hitstop > 0) {
          this.hitstop -= dt;
          this.render(0);
        } else {
          this.update(dt);
          this.render(dt);
        }
      } else if (this.over && !this.paused) {
        // death cinematic — world keeps burning while light dies
        this.updateAftermath(dt);
        this.render(dt);
      } else if (this.paused) {
        // throttled re-render while paused (~20fps) to save battery
        this.pauseFrames++;
        if (this.pauseFrames % 3 === 0) this.render(0);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.last = performance.now();
  }

  queuePulse() { this.pulseQueued = true; }

  reset() {
    this.pulseQueued = false;
    this.hudT = 0;
    this.px = WORLD / 2; this.py = WORLD / 2; this.pvx = 0; this.pvy = 0;
    this.hp = 3; this.fuel = 100;
    this.face = -Math.PI / 2; this.invuln = 0; this.pulseCd = 0; this.pulseAnim = 0;
    this.score = 0; this.time = 0; this.kills = 0; this.soulsCollected = 0;
    this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.mult = 1;
    this.wave = 1; this.waveT = 0; this.spawnT = 0.4; this.oilT = 5; this.pageT = 10;
    this.survivalTick = 0;
    this.enemies.length = 0;
    for (const p of this.particles) p.alive = false;
    for (const t of this.texts) t.alive = false;
    for (const p of this.pickups) p.alive = false;
    for (const r of this.rings) r.alive = false;
    this.camX = this.px; this.camY = this.py;
    this.trauma = 0; this.hitstop = 0; this.flashRed = 0; this.flashWhite = 0;
    this.over = false; this.paused = false;
    this.moved = false; this.pulsed = false;
    this.lowFuelWarned = false;
    this.lightning = 0; this.lightningT = 7;
    // opening burst — instant action in first seconds
    for (let i = 0; i < 3; i++) this.spawnEnemy(true);
    this.spawnPickup('oil', this.px + 140, this.py - 90);
    this.spawnPickup('soul', this.px - 120, this.py + 60);
    this.spawnPickup('soul', this.px - 90, this.py + 110);
    this.spawnPickup('page', this.px + 200, this.py + 160);
    this.burst(this.px, this.py, 26, '#ffb340', 120, 2.5, 0.9, true);
    this.emitHud(true);
  }

  // ---------- spawning ----------
  private lightRadius() {
    const f = this.fuel / this.maxFuel;
    const base = 235 * (0.42 + 0.58 * Math.min(1, Math.max(0, f)));
    return base * this.flicker + this.pulseAnim * 90;
  }

  private spawnEnemy(near = false) {
    if (this.enemies.length > 64) return;
    const w = this.wave;
    // pick type by wave
    const roll = Math.random();
    let type: 0 | 1 | 2 | 3 = 0;
    if (w >= 6 && roll < 0.14) type = 3;
    else if (w >= 3 && roll < 0.3) type = 2;
    else if (roll < 0.55) type = 1;
    else type = 0;

    const ang = Math.random() * TAU;
    const dist = near ? 420 + Math.random() * 160 : 560 + Math.random() * 320;
    let x = this.px + Math.cos(ang) * dist;
    let y = this.py + Math.sin(ang) * dist;
    x = Math.max(60, Math.min(WORLD - 60, x));
    y = Math.max(60, Math.min(WORLD - 60, y));

    const scale = 1 + (w - 1) * 0.06;
    let hp = 2, speed = 118, radius = 14;
    if (type === 0) { hp = 2; speed = 118 + Math.random() * 22; radius = 14; }
    if (type === 1) { hp = 1; speed = 178 + Math.random() * 30; radius = 10; }
    if (type === 2) { hp = 6 + Math.floor(w / 3); speed = 62 + Math.random() * 10; radius = 24; }
    if (type === 3) { hp = 3; speed = 152 + Math.random() * 20; radius = 13; }
    speed *= Math.min(scale, 1.9);
    if (this.fuel <= 0.5) speed *= 1.2;

    this.enemies.push({
      x, y, vx: 0, vy: 0, hp, maxHp: hp, type, speed, radius,
      phase: Math.random() * TAU, flash: 0, burn: 0, kx: 0, ky: 0,
      spawnT: 0.9, teleCd: 2 + Math.random() * 3, zig: Math.random() * TAU, dead: false,
    });
    // spawn puff
    this.burst(x, y, 10, '#3b0a12', 60, 1.6, 0.7, false);
  }

  private spawnPickup(kind: Pickup['kind'], x?: number, y?: number) {
    const p = this.pickups.find(p => !p.alive);
    if (!p) return;
    const ang = Math.random() * TAU;
    const d = 220 + Math.random() * 320;
    p.kind = kind;
    p.x = x ?? Math.max(80, Math.min(WORLD - 80, this.px + Math.cos(ang) * d));
    p.y = y ?? Math.max(80, Math.min(WORLD - 80, this.py + Math.sin(ang) * d));
    p.phase = Math.random() * TAU;
    p.vx = (Math.random() - 0.5) * 60; p.vy = (Math.random() - 0.5) * 60;
    p.life = kind === 'soul' ? 22 : 30;
    p.alive = true;
  }

  private burst(x: number, y: number, n: number, color: string, speed: number, size: number, life: number, glow: boolean) {
    let c = 0;
    for (const p of this.particles) {
      if (p.alive) continue;
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.9);
      p.alive = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = p.maxLife = life * (0.6 + Math.random() * 0.7);
      p.size = size * (0.6 + Math.random() * 0.9);
      p.color = color; p.drag = 3.2; p.grav = 0; p.glow = glow; p.shrink = true;
      if (++c >= n) break;
    }
  }

  private floatText(x: number, y: number, text: string, color: string, size = 15) {
    for (const t of this.texts) {
      if (t.alive) continue;
      t.alive = true; t.x = x + (Math.random() - 0.5) * 20; t.y = y - 14;
      t.vy = -66; t.life = t.maxLife = 0.9; t.text = text; t.color = color; t.size = size;
      return;
    }
  }

  private addRing(x: number, y: number, maxR: number, dur = 0.45) {
    for (const r of this.rings) {
      if (r.alive) continue;
      r.alive = true; r.x = x; r.y = y; r.r = 12; r.maxR = maxR; r.life = r.maxLife = dur;
      return;
    }
  }

  private shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // ---------- update ----------
  private update(dt: number) {
    this.time += dt;
    this.waveT += dt;

    // wave progression every 22s
    const newWave = 1 + Math.floor(this.waveT / 22);
    if (newWave !== this.wave) {
      this.wave = newWave;
      audio.wave();
      this.shake(0.35);
      this.floatText(this.px, this.py - 44, `WAVE ${this.wave}`, '#ff2a3c', 26);
      this.addRing(this.px, this.py, 420, 0.8);
      this.burst(this.px, this.py, 30, '#ff2a3c', 260, 2.4, 0.8, true);
      audio.setIntensity(Math.min(1, this.wave / 10));
    }

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.combo = 0; this.mult = 1; }
    }

    // survival score trickle
    this.survivalTick += dt;
    if (this.survivalTick >= 1) { this.survivalTick -= 1; this.score += 10 * this.mult; }

    // flicker
    this.flickerT += dt;
    const fuelF = this.fuel / this.maxFuel;
    const baseFlick = 0.94 + Math.sin(this.flickerT * 13) * 0.02 + Math.sin(this.flickerT * 31) * 0.015;
    const lowFlick = fuelF < 0.25 ? (Math.random() < 0.06 ? 0.72 : 1) : 1;
    this.flicker += ((baseFlick * lowFlick) - this.flicker) * Math.min(1, dt * 14);

    // lightning
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightning = 0.5 + Math.random() * 0.4;
      this.lightningT = 8 + Math.random() * 12;
      this.noiseRumble();
    }
    if (this.lightning > 0) this.lightning -= dt * 1.6;

    // ---- player movement ----
    let ix = 0, iy = 0;
    if (this.input.up) iy -= 1;
    if (this.input.down) iy += 1;
    if (this.input.left) ix -= 1;
    if (this.input.right) ix += 1;
    if (this.input.joyActive) { ix = this.input.joyX; iy = this.input.joyY; }
    const mag = Math.hypot(ix, iy);
    if (mag > 0.12) {
      this.moved = true;
      if (mag > 1) { ix /= mag; iy /= mag; }
      this.face = Math.atan2(iy, ix);
      this.moving = true;
      this.moveMag = Math.min(1, mag);
    } else { this.moving = false; this.moveMag = 0; }

    const sprinting = (this.input.sprint || (this.input.joyActive && mag > 0.92)) && this.moving && this.fuel > 1;
    const maxSpeed = (sprinting ? 348 : 258) * (this.fuel <= 0.5 ? 0.88 : 1);
    const accel = 2600;
    this.pvx += ix * accel * dt;
    this.pvy += iy * accel * dt;
    // friction
    const fr = this.moving ? 6.5 : 9.5;
    this.pvx -= this.pvx * Math.min(1, fr * dt);
    this.pvy -= this.pvy * Math.min(1, fr * dt);
    const sp = Math.hypot(this.pvx, this.pvy);
    if (sp > maxSpeed) { this.pvx = (this.pvx / sp) * maxSpeed; this.pvy = (this.pvy / sp) * maxSpeed; }
    this.px = Math.max(40, Math.min(WORLD - 40, this.px + this.pvx * dt));
    this.py = Math.max(40, Math.min(WORLD - 40, this.py + this.pvy * dt));

    // dust while moving
    if (this.moving && Math.random() < dt * (sprinting ? 26 : 12)) {
      this.burst(this.px - Math.cos(this.face) * 10, this.py + 12, 1, sprinting ? '#ffb340' : '#2a3350', 40, 1.6, 0.5, false);
    }

    // fuel drain
    this.fuel -= dt * (sprinting ? 2.6 : 1.05);
    if (this.fuel < 0) this.fuel = 0;
    if (this.fuel < 22 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      this.floatText(this.px, this.py - 36, 'LANTERN DYING — FIND OIL!', '#ffb340', 16);
      audio.oil();
    }
    if (this.fuel > 30) this.lowFuelWarned = false;

    // heartbeat when low hp or low fuel danger
    audio.setHeartbeat(this.hp === 1);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.pulseCd > 0) this.pulseCd -= dt;
    if (this.pulseAnim > 0) this.pulseAnim = Math.max(0, this.pulseAnim - dt * 2.6);
    if (this.flashRed > 0) this.flashRed -= dt * 2.2;
    if (this.flashWhite > 0) this.flashWhite -= dt * 3;

    // pulse
    if (this.pulseQueued) {
      this.pulseQueued = false;
      this.tryPulse();
    }

    // ---- spawning ----
    const interval = Math.max(0.28, 1.5 - this.wave * 0.13);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = interval * (0.7 + Math.random() * 0.6);
      this.spawnEnemy();
      if (this.wave >= 4 && Math.random() < 0.3) this.spawnEnemy();
      if (this.wave >= 7 && Math.random() < 0.25) this.spawnEnemy();
    }
    this.oilT -= dt;
    if (this.oilT <= 0) {
      this.oilT = 7 + Math.random() * 4 - Math.min(3, this.wave * 0.2);
      this.spawnPickup('oil');
    }
    this.pageT -= dt;
    if (this.pageT <= 0) {
      this.pageT = 11 + Math.random() * 6;
      this.spawnPickup(Math.random() < 0.72 ? 'soul' : 'page');
      if (Math.random() < 0.4) this.spawnPickup('soul');
    }

    const lightR = this.lightRadius();

    // ---- enemies ----
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      e.phase += dt * 4;
      if (e.flash > 0) e.flash -= dt;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }

      const dx = this.px - e.x, dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;

      // knockback decay
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx -= e.kx * Math.min(1, 7 * dt);
      e.ky -= e.ky * Math.min(1, 7 * dt);

      let mx = nx, my = ny;
      if (e.type === 1) {
        e.zig += dt * 5;
        const px = -ny, py = nx;
        const s = Math.sin(e.zig) * 0.7;
        mx = nx + px * s; my = ny + py * s;
        const m = Math.hypot(mx, my) || 1; mx /= m; my /= m;
      }
      if (e.type === 3) {
        e.teleCd -= dt;
        if (e.teleCd <= 0 && dist > 200) {
          // blink closer with puff
          this.burst(e.x, e.y, 12, '#7d2bff', 120, 2, 0.5, true);
          const a = Math.random() * TAU;
          e.x = this.px + Math.cos(a) * (170 + Math.random() * 90);
          e.y = this.py + Math.sin(a) * (170 + Math.random() * 90);
          e.x = Math.max(50, Math.min(WORLD - 50, e.x));
          e.y = Math.max(50, Math.min(WORLD - 50, e.y));
          this.burst(e.x, e.y, 12, '#7d2bff', 120, 2, 0.5, true);
          e.teleCd = 2.4 + Math.random() * 2.4;
        }
      }

      const slowed = dist < lightR ? 0.62 : 1;
      const jitter = e.type === 0 ? Math.sin(e.phase) * 0.12 : 0;
      e.vx = (mx + -my * jitter) * e.speed * slowed;
      e.vy = (my + mx * jitter) * e.speed * slowed;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.x = Math.max(30, Math.min(WORLD - 30, e.x));
      e.y = Math.max(30, Math.min(WORLD - 30, e.y));

      // burn in light
      const inLight = dist < lightR * 0.98;
      if (inLight) {
        e.burn = 0.25;
        e.hp -= dt * 2.4;
        if (Math.random() < dt * 14) {
          this.burst(e.x + (Math.random() - 0.5) * 14, e.y + (Math.random() - 0.5) * 14, 1, Math.random() < 0.5 ? '#ffb340' : '#ff6a2a', 70, 1.8, 0.45, true);
        }
        if (e.hp <= 0) { this.killEnemy(e, nx, ny, true); continue; }
      } else if (e.burn > 0) {
        e.burn -= dt;
        e.hp -= dt * 1.1;
        if (e.hp <= 0) { this.killEnemy(e, nx, ny, true); continue; }
      }

      // touch player
      const pr = 16;
      if (dist < e.radius + pr && this.invuln <= 0) {
        this.damagePlayer(nx, ny);
        // push enemy back a bit so it doesn't stick
        e.kx = -nx * 260; e.ky = -ny * 260;
        if (this.over) return;
      }
    }

    // ---- pickups ----
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.phase += dt * 3;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx -= p.vx * Math.min(1, 3 * dt); p.vy -= p.vy * Math.min(1, 3 * dt);
      const dx = this.px - p.x, dy = this.py - p.y;
      const d = Math.hypot(dx, dy);
      const magnetR = p.kind === 'soul' ? 150 : 110;
      if (d < magnetR && d > 1) {
        const pull = p.kind === 'soul' ? 620 : 420;
        p.x += (dx / d) * pull * dt;
        p.y += (dy / d) * pull * dt;
      }
      if (d < 26) {
        p.alive = false;
        this.collect(p.kind, p.x, p.y);
      }
    }

    // ---- particles ----
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx -= p.vx * Math.min(1, p.drag * dt);
      p.vy -= p.vy * Math.min(1, p.drag * dt);
      p.vy += p.grav * dt;
    }
    for (const t of this.texts) {
      if (!t.alive) continue;
      t.life -= dt;
      if (t.life <= 0) { t.alive = false; continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - Math.min(1, 2.4 * dt);
    }
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.life -= dt;
      if (r.life <= 0) { r.alive = false; continue; }
      const k = 1 - r.life / r.maxLife;
      r.r = 12 + (r.maxR - 12) * (1 - Math.pow(1 - k, 3));
    }

    // ambient motes
    if (Math.random() < dt * 8) {
      const a = Math.random() * TAU;
      this.burst(this.px + Math.cos(a) * lightR * 1.2, this.py + Math.sin(a) * lightR * 1.2, 1, '#3d4a6b', 12, 1.4, 2.2, false);
    }

    // camera
    const lookAhead = 0.12;
    const tx = this.px + this.pvx * lookAhead;
    const ty = this.py + this.pvy * lookAhead;
    this.camX += (tx - this.camX) * Math.min(1, dt * 6);
    this.camY += (ty - this.camY) * Math.min(1, dt * 6);
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - dt * 1.8);

    // hud
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.emitHud(); }
  }

  private tryPulse() {
    if (this.pulseCd > 0 || this.over) return;
    if (this.fuel < 3) {
      this.floatText(this.px, this.py - 30, 'NO OIL!', '#ff2a3c', 14);
      return;
    }
    this.pulsed = true;
    this.pulseCd = this.pulseMax;
    this.pulseAnim = 1;
    this.fuel = Math.max(0, this.fuel - 3.5);
    const R = this.lightRadius() * 1.05 + 40;
    audio.pulse();
    this.shake(0.42);
    this.flashWhite = 0.5;
    this.addRing(this.px, this.py, R, 0.42);
    this.burst(this.px, this.py, 34, '#ffd27d', 420, 2.6, 0.6, true);
    this.burst(this.px, this.py, 16, '#ff2a3c', 300, 2.2, 0.5, true);

    let hitAny = false;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - this.px, dy = e.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d < R + e.radius) {
        hitAny = true;
        const nx = d > 1 ? dx / d : 1, ny = d > 1 ? dy / d : 0;
        const dmg = e.type === 2 ? 3.2 : 3.6;
        e.hp -= dmg;
        e.flash = 0.25;
        e.kx = nx * 640; e.ky = ny * 640;
        this.burst(e.x, e.y, 10, '#ffe9b0', 240, 2.2, 0.5, true);
        if (e.hp <= 0) this.killEnemy(e, nx, ny, false);
      }
    }
    if (hitAny) this.hitstop = Math.max(this.hitstop, 0.045);
  }

  private killEnemy(e: Enemy, nx: number, ny: number, byBurn: boolean) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.combo++;
    this.comboT = 3;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.mult = 1 + Math.min(this.combo, 24) * 0.15;
    const base = e.type === 0 ? 50 : e.type === 1 ? 30 : e.type === 2 ? 150 : 100;
    const pts = Math.round(base * this.mult);
    this.score += pts;
    audio.kill(this.combo);

    const col = e.type === 3 ? '#b78bff' : e.type === 2 ? '#ff2a3c' : '#7df9ff';
    this.burst(e.x, e.y, e.type === 2 ? 30 : 18, col, 260, 2.4, 0.7, true);
    this.burst(e.x, e.y, 10, '#0a0a12', 140, 3, 0.6, false);
    this.floatText(e.x, e.y, `+${pts}`, col, e.type === 2 ? 20 : 15);
    if (this.combo >= 3) this.floatText(e.x, e.y - 22, `x${this.mult.toFixed(1)} COMBO ${this.combo}`, '#ffb340', 13);

    if (e.type === 2) {
      this.shake(0.5);
      this.hitstop = Math.max(this.hitstop, 0.07);
      this.flashWhite = Math.max(this.flashWhite, 0.35);
      // brute drops oil often
      if (Math.random() < 0.65) this.spawnPickup('oil', e.x, e.y);
    } else {
      this.shake(0.16);
    }
    // soul wisp drop
    const n = e.type === 2 ? 3 : e.type === 0 ? 1 : 1;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.85) this.spawnPickup('soul', e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40);
    }
    if (Math.random() < (e.type === 2 ? 0.2 : 0.03)) this.spawnPickup('heart', e.x, e.y);
    if (Math.random() < 0.12) this.spawnPickup('oil', e.x, e.y);

    void nx; void ny; void byBurn;
  }

  private collect(kind: Pickup['kind'], x: number, y: number) {
    if (kind === 'soul') {
      const pts = Math.round(25 * this.mult);
      this.score += pts;
      this.soulsCollected++;
      audio.pickup();
      this.burst(x, y, 8, '#7df9ff', 160, 1.8, 0.45, true);
      this.floatText(x, y, `+${pts}`, '#7df9ff', 13);
    } else if (kind === 'oil') {
      this.fuel = Math.min(this.maxFuel, this.fuel + 30);
      audio.oil();
      this.burst(x, y, 14, '#ffb340', 150, 2.2, 0.6, true);
      this.floatText(x, y, '+OIL', '#ffb340', 15);
    } else if (kind === 'heart') {
      if (this.hp < this.maxHp) this.hp++;
      else { this.score += 100; this.floatText(x, y, '+100', '#ff5d7a', 14); }
      audio.heart();
      this.burst(x, y, 16, '#ff5d7a', 170, 2.2, 0.6, true);
      this.floatText(x, y - 14, this.hp < this.maxHp ? '+HEART' : '+100', '#ff5d7a', 15);
    } else {
      // page — big score relic
      const pts = Math.round(150 * this.mult);
      this.score += pts;
      audio.heart();
      this.burst(x, y, 20, '#e8e6e3', 180, 2, 0.7, true);
      this.floatText(x, y, `PAGE +${pts}`, '#e8e6e3', 16);
    }
  }

  private damagePlayer(nx: number, ny: number) {
    this.hp--;
    this.invuln = 1.1;
    this.combo = 0; this.mult = 1; this.comboT = 0;
    audio.hit();
    this.shake(0.85);
    this.flashRed = 1;
    this.hitstop = Math.max(this.hitstop, 0.09);
    this.burst(this.px, this.py, 26, '#ff2a3c', 320, 2.6, 0.7, true);
    this.floatText(this.px, this.py - 30, 'HIT!', '#ff2a3c', 20);
    // knock player
    this.pvx = nx * 420; this.pvy = ny * 420;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  private die() {
    this.over = true;
    audio.gameOver();
    audio.setHeartbeat(false);
    this.shake(1);
    this.burst(this.px, this.py, 60, '#ff2a3c', 380, 3, 1.1, true);
    this.burst(this.px, this.py, 30, '#ffb340', 260, 2.4, 0.9, true);
    this.addRing(this.px, this.py, 500, 1);
    window.setTimeout(() => {
      this.onGameOver?.({
        score: Math.floor(this.score),
        time: this.time,
        kills: this.kills,
        wave: this.wave,
        souls: this.soulsCollected,
        bestCombo: this.bestCombo,
      });
    }, 900);
  }

  private noiseRumble() {
    // visual only; audio thunder handled via noise in kill? keep subtle
  }

  /** death cinematic: particles/rings/camera keep animating while lantern dies */
  private updateAftermath(dt: number) {
    this.fuel = Math.max(0, this.fuel - dt * 45);
    this.pulseAnim = Math.max(0, this.pulseAnim - dt * 2);
    if (this.flashRed > 0) this.flashRed -= dt * 1.4;
    if (this.flashWhite > 0) this.flashWhite -= dt * 2;
    if (this.lightning > 0) this.lightning -= dt * 1.6;
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx -= p.vx * Math.min(1, p.drag * dt);
      p.vy -= p.vy * Math.min(1, p.drag * dt);
    }
    for (const t of this.texts) {
      if (!t.alive) continue;
      t.life -= dt;
      if (t.life <= 0) { t.alive = false; continue; }
      t.y += t.vy * dt;
    }
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.life -= dt;
      if (r.life <= 0) { r.alive = false; continue; }
      const k = 1 - r.life / r.maxLife;
      r.r = 12 + (r.maxR - 12) * (1 - Math.pow(1 - k, 3));
    }
    // enemies close in on the corpse
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = this.px - e.x, dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.speed * 0.5 * dt;
      e.y += (dy / d) * e.speed * 0.5 * dt;
      e.phase += dt * 4;
    }
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - dt * 1.2);
  }

  private emitHud(force = false) {
    if (!this.onHud) return;
    void force;
    this.onHud({
      score: Math.floor(this.score),
      time: this.time,
      kills: this.kills,
      hp: this.hp,
      maxHp: this.maxHp,
      fuel: this.fuel,
      maxFuel: this.maxFuel,
      wave: this.wave,
      combo: this.combo,
      mult: this.mult,
      pulseCd: Math.max(0, this.pulseCd),
      pulseMax: this.pulseMax,
      enemies: this.enemies.length,
      soulsCollected: this.soulsCollected,
      moved: this.moved,
      pulsed: this.pulsed,
    });
  }

  // ---------- render ----------
  private render(dt: number) {
    const ctx = this.ctx;
    const { w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // shake
    const sh = this.trauma * this.trauma;
    const shX = (Math.random() * 2 - 1) * sh * 18;
    const shY = (Math.random() * 2 - 1) * sh * 18;
    const camX = this.camX - w / 2 + shX;
    const camY = this.camY - h / 2 + shY;

    // bg
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawGround(ctx, camX, camY, w, h);
    this.drawDecor(ctx, camX, camY, w, h);
    this.drawBounds(ctx);
    this.drawPickups(ctx, dt);
    this.drawEnemies(ctx, dt);
    this.drawPlayer(ctx, dt);
    this.drawParticles(ctx);
    this.drawRings(ctx);

    ctx.restore();

    // ---- lighting / darkness ----
    const px = this.px - camX, py = this.py - camY;
    const lightR = this.lightRadius();
    // scale light radius to screen (world == screen pixels)
    const lr = Math.max(60, lightR);

    // darkness gradient
    const g = ctx.createRadialGradient(px, py, lr * 0.12, px, py, lr * 2.1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.32, 'rgba(0,0,0,0.08)');
    g.addColorStop(0.58, 'rgba(2,4,10,0.72)');
    g.addColorStop(0.82, 'rgba(1,2,6,0.93)');
    g.addColorStop(1, 'rgba(0,0,0,0.97)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // warm lantern glow additive
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const wg = ctx.createRadialGradient(px, py, 4, px, py, lr * 1.05);
    const fuelA = 0.16 + 0.1 * (this.fuel / this.maxFuel);
    wg.addColorStop(0, `rgba(255,190,90,${fuelA + this.pulseAnim * 0.25})`);
    wg.addColorStop(0.4, `rgba(255,120,40,${0.07 + this.pulseAnim * 0.12})`);
    wg.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(px - lr * 1.2, py - lr * 1.2, lr * 2.4, lr * 2.4);
    ctx.restore();

    // lightning flash
    if (this.lightning > 0) {
      ctx.fillStyle = `rgba(180,200,255,${Math.min(0.28, this.lightning * 0.4)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // damage / heal flashes
    if (this.flashRed > 0) {
      const a = Math.min(0.5, this.flashRed * 0.5);
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
      rg.addColorStop(0, 'rgba(255,20,40,0)');
      rg.addColorStop(1, `rgba(255,20,40,${a})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.flashWhite > 0) {
      ctx.fillStyle = `rgba(255,240,210,${Math.min(0.22, this.flashWhite * 0.4)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // low fuel heartbeat vignette
    if (this.fuel < 22 && !this.over) {
      const a = 0.22 + Math.sin(performance.now() / 280) * 0.12;
      const lg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      lg.addColorStop(0, 'rgba(0,0,0,0)');
      lg.addColorStop(1, `rgba(120,20,10,${a})`);
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);
    }

    // floating texts (screen space conversion)
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      if (!t.alive) continue;
      const sx = t.x - camX, sy = t.y - camY;
      if (sx < -60 || sy < -40 || sx > w + 60 || sy > h + 40) continue;
      const k = t.life / t.maxLife;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `700 ${t.size}px 'JetBrains Mono', monospace`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.text, sx, sy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  private drawGround(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number) {
    // base
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(camX - 40, camY - 40, w + 80, h + 80);
    // subtle noise patches
    ctx.fillStyle = 'rgba(20,26,48,0.5)';
    const gs = 240;
    const x0 = Math.floor(camX / gs) * gs, y0 = Math.floor(camY / gs) * gs;
    for (let x = x0; x < camX + w + gs; x += gs) {
      for (let y = y0; y < camY + h + gs; y += gs) {
        const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (hsh % 3 === 0) {
          ctx.fillStyle = hsh % 6 === 0 ? 'rgba(24,20,36,0.55)' : 'rgba(14,22,40,0.5)';
          ctx.beginPath();
          ctx.ellipse(x + (hsh % 170), y + ((hsh >> 4) % 170), 90 + (hsh % 60), 70 + ((hsh >> 8) % 50), 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    // grid of cracked earth lines
    ctx.strokeStyle = 'rgba(60,70,110,0.14)';
    ctx.lineWidth = 1;
    const step = 120;
    const gx0 = Math.floor(camX / step) * step;
    const gy0 = Math.floor(camY / step) * step;
    ctx.beginPath();
    for (let x = gx0; x <= camX + w + step; x += step) { ctx.moveTo(x, camY - 20); ctx.lineTo(x, camY + h + 20); }
    for (let y = gy0; y <= camY + h + step; y += step) { ctx.moveTo(camX - 20, y); ctx.lineTo(camX + w + 20, y); }
    ctx.stroke();
  }

  private drawDecor(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number) {
    for (const d of this.decor) {
      if (d.x < camX - 80 || d.x > camX + w + 80 || d.y < camY - 80 || d.y > camY + h + 80) continue;
      if (d.kind === 0) this.drawDeadTree(ctx, d);
      else if (d.kind === 1) this.drawGrave(ctx, d);
      else this.drawRock(ctx, d);
    }
  }

  private drawDeadTree(ctx: CanvasRenderingContext2D, d: Decor) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot * 0.04);
    ctx.scale(d.s, d.s);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 6, 26, 10, 0, 0, TAU); ctx.fill();
    // trunk
    ctx.strokeStyle = '#151a2e';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(3, -18, -2, -44); ctx.stroke();
    ctx.strokeStyle = '#1e2542';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-1, -18); ctx.quadraticCurveTo(-16, -28, -22, -44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(14, -34, 16, -52); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-12, -32); ctx.lineTo(-20, -38); ctx.stroke();
    // faint red moss eyes? creepy hanging lantern? no
    ctx.restore();
  }

  private drawGrave(ctx: CanvasRenderingContext2D, d: Decor) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(d.s, d.s);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 8, 20, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#232a4a';
    ctx.strokeStyle = '#3a466e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, 8); ctx.lineTo(-11, -12); ctx.quadraticCurveTo(-11, -20, 0, -20); ctx.quadraticCurveTo(11, -20, 11, -12); ctx.lineTo(11, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,130,170,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -2); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.stroke();
    ctx.restore();
  }

  private drawRock(ctx: CanvasRenderingContext2D, d: Decor) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(d.s, d.s);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 6, 18, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2038';
    ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-8, -8); ctx.lineTo(4, -12); ctx.lineTo(13, -2); ctx.lineTo(10, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#252d52';
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(4, -12); ctx.lineTo(2, -4); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  private drawBounds(ctx: CanvasRenderingContext2D) {
    // thorny blood border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,42,60,0.35)';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(30, 30, WORLD - 60, WORLD - 60);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,42,60,0.12)';
    ctx.lineWidth = 22;
    ctx.strokeRect(30, 30, WORLD - 60, WORLD - 60);
    ctx.restore();
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    const c = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
    if (typeof c.roundRect === 'function') c.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  private drawPickups(ctx: CanvasRenderingContext2D, dt: number) {
    void dt;
    const t = performance.now() / 1000;
    const vx0 = this.camX - 60, vy0 = this.camY - 60;
    const vx1 = this.camX + this.w + 60, vy1 = this.camY + this.h + 60;
    for (const p of this.pickups) {
      if (!p.alive) continue;
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const bob = Math.sin(t * 3 + p.phase) * 4;
      const blink = p.life < 5 ? (Math.sin(t * 10) > 0 ? 1 : 0.35) : 1;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.globalAlpha = blink;
      if (p.kind === 'soul') {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
        g.addColorStop(0, 'rgba(125,249,255,0.9)');
        g.addColorStop(0.4, 'rgba(125,249,255,0.25)');
        g.addColorStop(1, 'rgba(125,249,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
        // wisp body
        ctx.fillStyle = '#d8feff';
        ctx.beginPath();
        const wob = Math.sin(t * 6 + p.phase) * 2;
        ctx.ellipse(wob, 0, 5, 7.5, wob * 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#7df9ff';
        ctx.beginPath(); ctx.arc(wob, -1, 2.4, 0, TAU); ctx.fill();
      } else if (p.kind === 'oil') {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
        g.addColorStop(0, 'rgba(255,179,64,0.55)');
        g.addColorStop(1, 'rgba(255,179,64,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
        // can
        ctx.fillStyle = '#3a2c12';
        ctx.strokeStyle = '#ffb340';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-8, -9, 16, 18, 3);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffb340';
        ctx.fillRect(-3, -13, 6, 5);
        // flame icon
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(5, 1, 0, 6);
        ctx.quadraticCurveTo(-5, 1, 0, -4);
        ctx.fill();
      } else if (p.kind === 'heart') {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
        g.addColorStop(0, 'rgba(255,60,90,0.6)');
        g.addColorStop(1, 'rgba(255,60,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff3b5c';
        const s = 1 + Math.sin(t * 5 + p.phase) * 0.1;
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.bezierCurveTo(-11, -2, -7, -10, 0, -4);
        ctx.bezierCurveTo(7, -10, 11, -2, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(-3, -4, 1.8, 0, TAU); ctx.fill();
      } else {
        // page relic
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
        g.addColorStop(0, 'rgba(232,230,227,0.4)');
        g.addColorStop(1, 'rgba(232,230,227,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
        ctx.rotate(Math.sin(t * 2 + p.phase) * 0.2);
        ctx.fillStyle = '#e8e2d5';
        ctx.strokeStyle = '#8a8474';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(-8, -11, 16, 22); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#4a453a';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.moveTo(-5, -5 + i * 5); ctx.lineTo(5, -5 + i * 5); }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, dt: number) {
    void dt;
    const t = performance.now() / 1000;
    const vx0 = this.camX - 90, vy0 = this.camY - 90;
    const vx1 = this.camX + this.w + 90, vy1 = this.camY + this.h + 90;
    for (const e of this.enemies) {
      if (e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
      if (e.spawnT > 0) {
        // spawning portal
        const k = 1 - e.spawnT / 0.9;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.globalAlpha = 0.3 + k * 0.6;
        ctx.strokeStyle = '#ff2a3c';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 8 + k * e.radius * 1.4, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,42,60,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, (8 + k * e.radius) * 0.6, 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }
      const wob = Math.sin(t * 6 + e.phase) * (e.type === 1 ? 3 : 1.6);
      ctx.save();
      ctx.translate(e.x, e.y + wob * 0.4);

      // shadow blob
      const r = e.radius * (e.type === 2 ? 1 + Math.sin(t * 3 + e.phase) * 0.04 : 1);
      // aura
      const aura = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
      const auraCol = e.type === 3 ? '125,80,255' : '255,30,50';
      aura.addColorStop(0, `rgba(${auraCol},${e.flash > 0 ? 0.5 : 0.22})`);
      aura.addColorStop(1, `rgba(${auraCol},0)`);
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.fill();

      // body
      ctx.fillStyle = e.flash > 0 ? '#5a1620' : '#0b0b14';
      ctx.strokeStyle = e.burn > 0 ? '#ff8a2a' : e.type === 3 ? '#7d4dff' : 'rgba(255,42,60,0.5)';
      ctx.lineWidth = e.burn > 0 ? 2.4 : 1.4;
      ctx.beginPath();
      if (e.type === 1) {
        ctx.ellipse(0, 0, r * 1.25, r * 0.8, Math.sin(e.phase) * 0.3, 0, TAU);
      } else if (e.type === 2) {
        // brute jagged
        ctx.moveTo(0, -r * 1.2);
        for (let i = 1; i <= 8; i++) {
          const a = (i / 8) * TAU;
          const rr = r * (i % 2 === 0 ? 1.15 : 0.85);
          ctx.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr);
        }
        ctx.closePath();
      } else {
        ctx.ellipse(wob * 0.3, 0, r, r * 1.12, 0, 0, TAU);
      }
      ctx.fill(); ctx.stroke();

      // smoky bottom tendrils
      ctx.strokeStyle = 'rgba(10,10,18,0.9)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * r * 0.5, r * 0.7);
        ctx.quadraticCurveTo(k * r * 0.5 + Math.sin(t * 5 + e.phase + k) * 5, r * 1.2, k * r * 0.4 + Math.sin(t * 4 + k * 2) * 6, r * 1.55);
        ctx.stroke();
      }

      // eyes
      const lookX = Math.cos(Math.atan2(this.py - e.y, this.px - e.x)) * 2;
      const eyeY = -r * 0.15;
      const eyeDX = e.type === 2 ? 8 : e.type === 1 ? 4.5 : 5.5;
      const eyeR = e.type === 2 ? 3.4 : 2.4;
      const glowC = e.burn > 0 ? '#ffcf6e' : e.type === 3 ? '#c9a6ff' : '#ff2038';
      ctx.save();
      ctx.shadowColor = glowC; ctx.shadowBlur = 10;
      ctx.fillStyle = glowC;
      ctx.beginPath(); ctx.arc(-eyeDX + lookX, eyeY, eyeR, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(eyeDX + lookX, eyeY, eyeR, 0, TAU); ctx.fill();
      // angry slit for brute
      if (e.type === 2) {
        ctx.fillStyle = '#0b0b14';
        ctx.fillRect(-eyeDX + lookX - eyeR, eyeY - 1, eyeR * 2, 1.4);
        ctx.fillRect(eyeDX + lookX - eyeR, eyeY - 1, eyeR * 2, 1.4);
      }
      ctx.restore();

      // burn flame crown
      if (e.burn > 0) {
        ctx.fillStyle = 'rgba(255,140,40,0.85)';
        for (let f = 0; f < 3; f++) {
          const fx = (f - 1) * r * 0.5 + Math.sin(t * 12 + f * 2 + e.phase) * 2;
          ctx.beginPath();
          ctx.moveTo(fx - 3, -r * 0.9);
          ctx.quadraticCurveTo(fx, -r * 1.5 - Math.random() * 4, fx + 3, -r * 0.9);
          ctx.fill();
        }
      }

      // brute hp pips
      if (e.type === 2 && e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-18, -r - 14, 36, 5);
        ctx.fillStyle = '#ff2a3c';
        ctx.fillRect(-18, -r - 14, 36 * Math.max(0, e.hp / e.maxHp), 5);
      }
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, dt: number) {
    void dt;
    const t = performance.now() / 1000;
    const bob = this.moving ? Math.sin(t * 11) * 2.2 : Math.sin(t * 2.4) * 1.2;
    const blinkInv = this.invuln > 0 && Math.sin(t * 30) > 0;

    // lantern light pool on ground
    const lr = this.lightRadius();
    const pool = ctx.createRadialGradient(this.px, this.py, 4, this.px, this.py, lr * 0.75);
    pool.addColorStop(0, 'rgba(255,180,80,0.14)');
    pool.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.arc(this.px, this.py, lr * 0.75, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(this.px, this.py + bob * 0.4);
    if (blinkInv) ctx.globalAlpha = 0.45;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.ellipse(0, 14 - bob * 0.4, 16, 6, 0, 0, TAU); ctx.fill();

    const fx = Math.cos(this.face), fy = Math.sin(this.face);

    // cloak (directional lean)
    ctx.save();
    ctx.rotate(fx * 0.08);
    const cloakGrad = ctx.createLinearGradient(0, -14, 0, 16);
    cloakGrad.addColorStop(0, '#2b3352');
    cloakGrad.addColorStop(0.6, '#1a2038');
    cloakGrad.addColorStop(1, '#0e1226');
    ctx.fillStyle = cloakGrad;
    ctx.strokeStyle = 'rgba(140,150,200,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, -8);
    ctx.quadraticCurveTo(-14 - fx * 4, 8, -9 - this.pvx * 0.012, 15);
    ctx.quadraticCurveTo(0, 18, 9 - this.pvx * 0.012, 15);
    ctx.quadraticCurveTo(14 - fx * 4, 8, 11, -8);
    ctx.quadraticCurveTo(0, -14, -11, -8);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // head / hood
    ctx.fillStyle = '#141a32';
    ctx.strokeStyle = 'rgba(160,170,220,0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -10, 9, 0, TAU); ctx.fill(); ctx.stroke();
    // face shadow with glowing eyes
    ctx.fillStyle = '#05060d';
    ctx.beginPath(); ctx.arc(fx * 2, -9 + fy * 1.5, 5.5, 0, TAU); ctx.fill();
    ctx.save();
    ctx.shadowColor = '#ffd27d'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffe2a8';
    ctx.beginPath(); ctx.arc(fx * 2.6 - 2.2, -9 + fy * 1.5, 1.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(fx * 2.6 + 2.2, -9 + fy * 1.5, 1.3, 0, TAU); ctx.fill();
    ctx.restore();

    // lantern arm — swings
    const swing = Math.sin(t * (this.moving ? 9 : 3)) * (this.moving ? 0.25 : 0.12);
    const lanAng = this.face + (fx >= 0 ? swing : -swing);
    const hx = Math.cos(lanAng) * 20, hy = Math.sin(lanAng) * 20 + 2;
    // arm
    ctx.strokeStyle = '#2b3352';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx * 0.7, hy * 0.7); ctx.stroke();
    // hand
    ctx.fillStyle = '#c9a37e';
    ctx.beginPath(); ctx.arc(hx * 0.7, hy * 0.7, 3, 0, TAU); ctx.fill();
    // chain + lantern
    const lx = hx, ly = hy + 6 + Math.sin(t * 7) * 1.2;
    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(hx * 0.7, hy * 0.7); ctx.lineTo(lx, ly - 6); ctx.stroke();
    // lantern glow
    const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26);
    lg.addColorStop(0, 'rgba(255,210,120,0.9)');
    lg.addColorStop(0.35, 'rgba(255,150,50,0.35)');
    lg.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, ly, 26, 0, TAU); ctx.fill();
    // lantern body
    ctx.fillStyle = '#201808';
    ctx.strokeStyle = '#ffb340';
    ctx.lineWidth = 1.6;
    this.rr(ctx, lx - 6, ly - 7, 12, 14, 2.5);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.shadowColor = '#ffcf6e'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffe6ad';
    ctx.beginPath(); ctx.ellipse(lx, ly, 3.4, 4.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffb340';
    ctx.fillRect(lx - 4, ly - 10, 8, 3);

    // pulse cooldown arc around player
    if (this.pulseCd > 0) {
      const k = 1 - this.pulseCd / this.pulseMax;
      ctx.strokeStyle = 'rgba(255,179,64,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
    } else {
      // ready shimmer
      ctx.strokeStyle = `rgba(255,210,120,${0.35 + Math.sin(t * 4) * 0.15})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(0, 0, 24, t * 0.8, t * 0.8 + TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      if (!p.alive) continue;
      const k = p.life / p.maxLife;
      const s = p.shrink ? p.size * k + 0.4 : p.size;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 2.2, 0, TAU); ctx.fill();
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.7, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.globalAlpha = Math.min(1, k * 1.2) * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawRings(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      if (!r.alive) continue;
      const k = 1 - r.life / r.maxLife;
      const a = (1 - k) * 0.9;
      ctx.strokeStyle = `rgba(255,210,130,${a})`;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,60,70,${a * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.86, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
