import { makeNebula, drawStars, drawPlanet, drawAsteroid, drawRocket, drawGhost, drawProjectile, drawPowerup, drawField, radialGlow } from './draw';

const P1 = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space', boost: 'ShiftLeft', rewind: 'KeyQ', magnet: 'KeyE', color: '#ff3344', glow: '255,70,90' };
const P2 = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'Enter', boost: 'ShiftRight', rewind: 'Slash', magnet: 'Period', color: '#44aaff', glow: '80,170,255' };

const PU = {
  rewind: { color: '#00e5ff', glow: '0,229,255', label: 'T' },
  health: { color: '#33ff66', glow: '51,255,102', label: '+' },
  fuel: { color: '#ffcc33', glow: '255,204,51', label: 'F' },
  ammo: { color: '#ff8844', glow: '255,136,68', label: 'A' },
  magnet: { color: '#aa55ff', glow: '170,85,255', label: 'M' },
  shield: { color: '#66ccff', glow: '102,204,255', label: 'S' },
  overcharge: { color: '#ff3388', glow: '255,51,136', label: 'O' },
  speed: { color: '#ffffff', glow: '255,255,255', label: '>' }
};
const PU_KEYS = Object.keys(PU);

export class GameEngine {
  constructor(container, onState) {
    this.container = container;
    this.onState = onState;
    this.keys = new Set();
    this.phase = 'start';
    this.round = 1;
    this.scores = { p1: 0, p2: 0 };
    this.matchTime = 0;
    this.countdown = 0;
    this.timeScale = 1;
    this.shake = 0;
    this.flash = 0;
    this.lastTime = performance.now();
    this.disposed = false;
    this.t = 0;
    // dynamic camera (Sideswipe-style): zooms in when rockets close, out when far
    this.camScale = 1;
    this.camTargetScale = 1;
    this.camX = 0;
    this.camY = 0;

    this._initCanvas();
    this._initWorld();
    this._initRockets();
    this._initParticles();
    this._bindInput();
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
    this._emit();
  }

  _initCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    this.container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = h;
    this.nebula = makeNebula(w, h);
    if (this.stars) this._initStars();
    if (!this.camX) { this.camX = w / 2; this.camY = h / 2; }
  }

  _initWorld() {
    this._initStars();
    this.planets = [
      { x: this.W * 0.18, y: this.H * 0.22, r: 50, light: '#4466aa', dark: '#1a2a55', glow: '60,100,180', ring: '#88aadd', tilt: 0.4 },
      { x: this.W * 0.82, y: this.H * 0.78, r: 38, light: '#aa7744', dark: '#442211', glow: '180,120,70' }
    ];
    this.asteroids = [];
    for (let i = 0; i < 12; i++) this.asteroids.push(this._makeAsteroid());
    this.debris = [];
    for (let i = 0; i < 40; i++) this.debris.push({ x: Math.random() * this.W, y: Math.random() * this.H, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, size: Math.random() * 1.5 + 0.5, rot: Math.random() * 6 });
  }

  _initStars() {
    const layers = [
      { n: 120, size: 1, alpha: 0.5, drift: 0.005, col: '180,190,210' },
      { n: 80, size: 1.6, alpha: 0.7, drift: 0.01, col: '210,220,240' },
      { n: 40, size: 2.4, alpha: 0.9, drift: 0.02, col: '255,255,255' }
    ];
    this.stars = [];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        this.stars.push({ x: Math.random(), y: Math.random(), w: this.W, h: this.H, size: L.size, alpha: L.alpha, drift: L.drift, col: `rgb(${L.col})`, tw: Math.random() * 3 + 1, ph: Math.random() * 6 });
      }
    }
  }

  _makeAsteroid() {
    const r = 14 + Math.random() * 22;
    const pts = [];
    const n = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.7 + Math.random() * 0.5);
      pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }

    // Keep asteroids centered away from spawn zones
    const x = this.W * (0.35 + Math.random() * 0.3);
    const y = 100 + Math.random() * (this.H - 200);

    return {
      x, y,
      vx: 0, // Set initial velocity to zero
      vy: 0,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.2, // Small tumble rotation
      r, pts
    };
  }

  _initRockets() {
    this.p1 = this._makeRocket(P1, this.W * 0.2, this.H * 0.5, 0);
    this.p2 = this._makeRocket(P2, this.W * 0.8, this.H * 0.5, Math.PI);
    this.rockets = [this.p1, this.p2];
    this.projectiles = [];
    this.powerups = [];
    this.fields = [];
    this.powerupTimer = 2;
  }

  _makeRocket(def, x, y, angle) {
    return {
      def, color: def.color, glow: def.glow,
      x, y, angle, vx: 0, vy: 0,
      health: 100, maxHealth: 100, fuel: 100, maxFuel: 100, ammo: 24, maxAmmo: 24,
      magnet: 0, magnetMax: 100, magnetActive: 0, magnetCd: 0,
      rewindCharges: 1, rewindCd: 0, rewinding: 0,
      shieldT: 0, overchargeT: 0, speedT: 0, disruptT: 0,
      fireCd: 0, thrusting: false, flame: 0, dead: false,
      history: [], buffs: []
    };
  }

  _initParticles() {
    this.particles = [];
    const POOL = 600;
    for (let i = 0; i < POOL; i++) this.particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, glow: '255,255,255', drag: 0.94 });
    this.pIdx = 0;
  }

  _spawn(x, y, vx, vy, glow, size, life, drag = 0.94) {
    const p = this.particles[this.pIdx];
    this.pIdx = (this.pIdx + 1) % this.particles.length;
    p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.glow = glow;
    p.size = size; p.maxLife = life; p.life = life; p.drag = drag;
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Period', 'Enter'].includes(e.code)) e.preventDefault();
      if (this.phase !== 'playing') return;
      this._tryAction(this.p1);
      this._tryAction(this.p2);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _tryAction(r) {
    if (r.dead) return;
    if (this.keys.has(r.def.rewind) && r.rewindCharges > 0 && r.rewindCd <= 0) this._activateRewind(r);
    if (this.keys.has(r.def.magnet) && r.magnet >= r.magnetMax && r.magnetCd <= 0) this._activateMagnet(r);
  }

  // ---- Public ----
  startMatch() { this._reset(); this.phase = 'countdown'; this.countdown = 3.2; this.matchTime = 0; this.timeScale = 1; this._emit(); }
  rematch() { this.round += 1; this.startMatch(); }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }

  _reset() {
    for (const r of this.rockets) {
      Object.assign(r, this._makeRocket(r.def, r.def === P1 ? this.W * 0.2 : this.W * 0.8, this.H * 0.5, r.def === P1 ? 0 : Math.PI));
    }

    // Reset asteroids to rest and initial positions
    this.asteroids = [];
    for (let i = 0; i < 12; i++) this.asteroids.push(this._makeAsteroid());

    this.projectiles = [];
    this.fields = [];
    this.powerups = [];
    this.powerupTimer = 2;
    for (const p of this.particles) p.alive = false;
  }

  // ---- Loop ----
  _loop() {
    if (this.disposed) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const sdt = dt * this.timeScale;

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = 'playing';
    } else if (this.phase === 'playing') {
      this.matchTime += dt;
      this._updatePlay(sdt);
    }
    if (this.timeScale < 1) this.timeScale = Math.min(1, this.timeScale + dt * 1.0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);

    this._updateParticles(sdt);
    this._updateAsteroids(sdt);
    this._updateDebris(sdt);
    this._updateCamera(dt);
    this._render();
    this._emit();
    this.raf = requestAnimationFrame(this._loop);
  }

  _updatePlay(dt) {
    for (const r of this.rockets) this._updateRocket(r, dt);
    this._updateProjectiles(dt);
    this._updateFields(dt);
    this._updatePowerups(dt);
  }

  _updateCamera(dt) {
    // frame both rockets: zoom in when close, out when far, centered on midpoint
    const a = this.p1, b = this.p2;
    const ax = a.dead ? this.camX : a.x;
    const ay = a.dead ? this.camY : a.y;
    const bx = b.dead ? this.camX : b.x;
    const by = b.dead ? this.camY : b.y;
    const dist = Math.hypot(ax - bx, ay - by);
    const diag = Math.hypot(this.W, this.H);
    // map distance to scale: close (~0) -> 1.5, far (~0.6*diag) -> 0.62
    const farRef = diag * 0.55;
    let target = 1.5 - (dist / farRef) * (1.5 - 0.62);
    target = Math.max(0.62, Math.min(1.5, target));
    // ease toward target
    const k = 1 - Math.pow(0.0008, dt);
    this.camScale += (target - this.camScale) * k;
    // center on midpoint, eased
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    this.camX += (mx - this.camX) * (1 - Math.pow(0.02, dt));
    this.camY += (my - this.camY) * (1 - Math.pow(0.02, dt));
  }

  _inputFor(r) {
    const k = this.keys, c = r.def;
    let i = { up: k.has(c.up), down: k.has(c.down), left: k.has(c.left), right: k.has(c.right), fire: k.has(c.fire), boost: k.has(c.boost) };
    if (r.disruptT > 0) {
      if (Math.random() < 0.4) { i.left = !i.left; i.right = !i.right; }
      if (Math.random() < 0.4) { i.up = !i.up; i.down = !i.down; }
      i.fire = false;
    }
    return i;
  }

  _updateRocket(r, dt) {
    if (r.dead) return;
    if (r.rewinding > 0) {
      r.rewinding -= dt;
      if (r.history.length > 1) {
        const snap = r.history.pop();
        r.x = snap.x; r.y = snap.y; r.angle = snap.angle; r.vx = snap.vx; r.vy = snap.vy;
        r.health = snap.health; r.fuel = snap.fuel; r.ammo = snap.ammo;
      }
      if (Math.random() < 0.7) this._spawn(r.x, r.y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, '120,230,255', 3, 0.6);
      r.shieldT = Math.max(0, r.shieldT - dt); r.overchargeT = Math.max(0, r.overchargeT - dt);
      r.speedT = Math.max(0, r.speedT - dt); r.disruptT = Math.max(0, r.disruptT - dt);
      r.magnetActive = Math.max(0, r.magnetActive - dt);
      r.buffs = ['◀ REWINDING'];
      return;
    }
    const i = this._inputFor(r);
    const rotSpeed = 3.4;
    if (i.left) r.angle -= rotSpeed * dt;
    if (i.right) r.angle += rotSpeed * dt;

    const boosting = i.boost && r.fuel > 0;
    const speedMul = r.speedT > 0 ? 1.5 : 1;
    const accel = (boosting ? 360 : 220) * speedMul;
    r.thrusting = i.up;
    r.flame = boosting ? 1 : (i.up ? 0.5 : 0);
    if (i.up) {
      r.vx += Math.cos(r.angle) * accel * dt;
      r.vy += Math.sin(r.angle) * accel * dt;
      r.fuel = Math.max(0, r.fuel - (boosting ? 16 : 5) * dt);
    }
    if (i.down) { // brake
      r.vx *= Math.pow(0.5, dt * 4);
      r.vy *= Math.pow(0.5, dt * 4);
    }
    // drag
    //r.vx *= Math.pow(0.99, dt * 60);
    //r.vy *= Math.pow(0.99, dt * 60);
    const maxS = (boosting ? 320 : 210) * speedMul;
    const sp = Math.hypot(r.vx, r.vy);
    if (sp > maxS) { r.vx = r.vx / sp * maxS; r.vy = r.vy / sp * maxS; }
    if (!i.up) r.fuel = Math.min(r.maxFuel, r.fuel + 6 * dt);

    r.x += r.vx * dt; r.y += r.vy * dt;
    // boundaries
    const m = 24;
    if (r.x < m) { r.x = m; r.vx = Math.abs(r.vx) * 0.4; this._damage(r, 2); }
    if (r.x > this.W - m) { r.x = this.W - m; r.vx = -Math.abs(r.vx) * 0.4; this._damage(r, 2); }
    if (r.y < m) { r.y = m; r.vy = Math.abs(r.vy) * 0.4; this._damage(r, 2); }
    if (r.y > this.H - m) { r.y = this.H - m; r.vy = -Math.abs(r.vy) * 0.4; this._damage(r, 2); }

    // asteroid collision
    for (const a of this.asteroids) {
      const dx = r.x - a.x, dy = r.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + 12;
      if (d < minD) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        r.x = a.x + nx * minD; r.y = a.y + ny * minD;
        const dot = r.vx * nx + r.vy * ny;
        r.vx -= 2 * dot * nx * 0.5; r.vy -= 2 * dot * ny * 0.5;
        this._damage(r, 4);
        this._explode(r.x, r.y, r.glow, 6);
      }
    }

    // rocket vs rocket
    const other = r === this.p1 ? this.p2 : this.p1;
    if (!other.dead) {
      const dx = r.x - other.x, dy = r.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < 30 && d > 0) {
        const nx = dx / d, ny = dy / d;
        r.x += nx * (30 - d) / 2; r.y += ny * (30 - d) / 2;
        r.vx += nx * 60; r.vy += ny * 60;
        this._damage(r, 3);
      }
    }

    // exhaust particles
    if (r.thrusting && Math.random() < 0.9) {
      const bx = r.x - Math.cos(r.angle) * 12;
      const by = r.y - Math.sin(r.angle) * 12;
      const spread = (Math.random() - 0.5) * 1.2;
      const ev = -Math.cos(r.angle) * (boosting ? 160 : 90) + r.vx * 0.3;
      const evy = -Math.sin(r.angle) * (boosting ? 160 : 90) + r.vy * 0.3;
      this._spawn(bx, by, ev + spread, evy + spread, boosting ? '255,200,120' : r.glow, 3 + Math.random() * 2, 0.4);
    }

    // timers
    r.fireCd -= dt; r.magnetCd = Math.max(0, r.magnetCd - dt);
    r.rewindCd = Math.max(0, r.rewindCd - dt);
    r.shieldT = Math.max(0, r.shieldT - dt); r.overchargeT = Math.max(0, r.overchargeT - dt);
    r.speedT = Math.max(0, r.speedT - dt); r.disruptT = Math.max(0, r.disruptT - dt);
    r.magnetActive = Math.max(0, r.magnetActive - dt);

    r.buffs = [];
    if (r.shieldT > 0) r.buffs.push('SHIELD');
    if (r.overchargeT > 0) r.buffs.push('OVERCHARGE');
    if (r.speedT > 0) r.buffs.push('SPEED');
    if (r.disruptT > 0) r.buffs.push('DISRUPTED');
    if (r.magnetActive > 0) r.buffs.push('EMP');

    // history
    r.history.push({ x: r.x, y: r.y, angle: r.angle, vx: r.vx, vy: r.vy, health: r.health, fuel: r.fuel, ammo: r.ammo });
    if (r.history.length > 180) r.history.shift();

    // fire
    if (i.fire && r.fireCd <= 0 && r.ammo > 0 && r.disruptT <= 0) {
      this._fire(r);
      r.fireCd = r.overchargeT > 0 ? 0.09 : 0.18;
      r.ammo--;
    }
  }

  _fire(r) {
  const sp = 460;
  const vx = Math.cos(r.angle) * sp + r.vx * 0.4;
  const vy = Math.sin(r.angle) * sp + r.vy * 0.4;
  const x = r.x + Math.cos(r.angle) * 18;
  const y = r.y + Math.sin(r.angle) * 18;

  // Find the target rocket (opponent)
  const target = r === this.p1 ? this.p2 : this.p1;

  this.projectiles.push({
    x, y, vx, vy,
    owner: r,
    target: target,            // Track target reference
    homingTime: 2.0,          // Follow target for 2 seconds
    life: 2.5,                // Increased total life so it lives after homing ends
    damage: r.overchargeT > 0 ? 14 : 8,
    glow: r.glow,
    trail: []
  });
  this._spawn(x, y, 0, 0, r.glow, 4, 0.18);
}

  _updateProjectiles(dt) {
    for (let k = this.projectiles.length - 1; k >= 0; k--) {
      const p = this.projectiles[k];

      // --- HOMING LOGIC (Follows target for 2s, then goes straight) ---
      if (p.homingTime > 0 && p.target && !p.target.dead) {
        p.homingTime -= dt;

        // Vector to target rocket
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Maintain constant projectile speed while steering
        const speed = Math.hypot(p.vx, p.vy) || 460;
        const desiredVx = (dx / dist) * speed;
        const desiredVy = (dy / dist) * speed;

        // Turn rate (adjust to change tracking sharpness)
        const turnRate = 4.0;
        p.vx += (desiredVx - p.vx) * turnRate * dt;
        p.vy += (desiredVy - p.vy) * turnRate * dt;

        // Re-normalize speed after steering adjustment
        const newSpeed = Math.hypot(p.vx, p.vy) || 1;
        p.vx = (p.vx / newSpeed) * speed;
        p.vy = (p.vy / newSpeed) * speed;

        // Tracking spark particles
        if (Math.random() < 0.4) {
          this._spawn(p.x, p.y, 0, 0, '255,180,80', 2, 0.2);
        }
      }

      // --- MAGNET FIELD CURVE ---
      for (const f of this.fields) {
        if (f.owner === p.owner) continue;
        const dx = f.x - p.x, dy = f.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < f.radius) {
          const force = 900 * (1 - d / f.radius);
          p.vx += (dx / d) * force * dt;
          p.vy += (dy / d) * force * dt;
        }
      }

      p.x += p.vx * dt; 
      p.y += p.vy * dt;
      p.life -= dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 10) p.trail.shift();
      if (Math.random() < 0.5) this._spawn(p.x, p.y, 0, 0, p.glow, 2, 0.3);

      let hit = false;

      // --- ASTEROID COLLISION (With Bullet Impact Knockback) ---
      for (const a of this.asteroids) {
        if (Math.hypot(p.x - a.x, p.y - a.y) < a.r) { 
          a.vx += p.vx * 0.06; // Transfer momentum to asteroid
          a.vy += p.vy * 0.06;
          this._explode(p.x, p.y, p.glow, 8); 
          hit = true; 
          break; 
        }
      }

      // --- ROCKET COLLISION (With Bullet Impact Knockback) ---
      if (!hit) {
        for (const r of this.rockets) {
          if (r === p.owner || r.dead) continue;
          if (Math.hypot(p.x - r.x, p.y - r.y) < 16) {
            if (r.shieldT > 0) {
              const nx = (p.x - r.x) / 16, ny = (p.y - r.y) / 16;
              const dot = p.vx * nx + p.vy * ny;
              p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny;
              this._spawn(p.x, p.y, 0, 0, r.glow, 3, 0.3);
              hit = true; 
              break;
            }

            // Transfer momentum to rocket
            r.vx += p.vx * 0.05;
            r.vy += p.vy * 0.05;

            this._damage(r, p.damage);
            this._explode(p.x, p.y, r.glow, 14);
            this.shake = Math.max(this.shake, 0.4);
            p.owner.magnet = Math.min(p.owner.magnetMax, p.owner.magnet + 6);
            hit = true; 
            break;
          }
        }
      }

      // --- BOUNDS & DESPAWN ---
      if (p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) hit = true;
      if (hit || p.life <= 0) this.projectiles.splice(k, 1);
    }
  }

  _damage(r, amt) {
    if (r.dead || r.shieldT > 0) return;
    r.health -= amt;
    if (r.health <= 0) { r.health = 0; this._kill(r); }
  }

  _kill(r) {
    r.dead = true;
    this._explode(r.x, r.y, r.glow, 50);
    this._explode(r.x, r.y, '255,255,255', 30);
    this.shake = 1; this.flash = 0.8;
    const winner = r === this.p1 ? 'p2' : 'p1';
    this.scores[winner]++;
    this.phase = 'ended';
    this.winner = winner;
  }

  _explode(x, y, glow, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 200;
      this._spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, glow, 2 + Math.random() * 3, 0.4 + Math.random() * 0.5);
    }
    this._spawn(x, y, 0, 0, glow, 10, 0.4);
    this._spawn(x, y, 0, 0, '255,255,255', 6, 0.25);
  }

  // ---- Magnet ----
  _activateMagnet(r) {
    r.magnet = 0; r.magnetActive = 2.6; r.magnetCd = 6;
    this.shake = 0.7; this.flash = 0.5;
    this.fields.push({ owner: r, x: r.x, y: r.y, radius: 160, life: 2.6, shock: 0 });
  }

  _updateFields(dt) {
    for (let k = this.fields.length - 1; k >= 0; k--) {
      const f = this.fields[k];
      f.life -= dt;
      f.x = f.owner.x; f.y = f.owner.y;
      f.shock = Math.min(1, f.shock + dt * 2.5);
      const opp = f.owner === this.p1 ? this.p2 : this.p1;
      if (!opp.dead) {
        const dx = f.x - opp.x, dy = f.y - opp.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < f.radius) {
          const force = 280 * (1 - d / f.radius);
          opp.vx += (dx / d) * force * dt;
          opp.vy += (dy / d) * force * dt;
          opp.disruptT = Math.max(opp.disruptT, 0.25);
          this._damage(opp, 16 * dt);
        }
      }
      // field particles spiraling
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        const rr = f.radius * (0.6 + Math.random() * 0.4);
        const px = f.x + Math.cos(a) * rr, py = f.y + Math.sin(a) * rr;
        this._spawn(px, py, -Math.cos(a) * 80, -Math.sin(a) * 80, '180,120,255', 2, 0.5);
      }
      if (f.life <= 0) this.fields.splice(k, 1);
    }
  }

  // ---- Rewind ----
  _activateRewind(r) {
    if (r.history.length < 20) return;
    r.rewindCharges--; r.rewindCd = 8; r.rewinding = 1.2;
    this.timeScale = 0.35;
  }

  // ---- Power-ups ----
  _updatePowerups(dt) {
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0 && this.powerups.length < 7) {
      this.powerupTimer = 2.5 + Math.random() * 2;
      this._spawnPowerup();
    }
    for (let k = this.powerups.length - 1; k >= 0; k--) {
      const p = this.powerups[k];
      p.life -= dt;
      if (p.life <= 0) { this.powerups.splice(k, 1); continue; }
      for (const r of this.rockets) {
        if (r.dead) continue;
        if (Math.hypot(r.x - p.x, r.y - p.y) < 22) {
          this._collect(r, p.type);
          this._explode(p.x, p.y, PU[p.type].glow, 14);
          this.powerups.splice(k, 1);
          break;
        }
      }
    }
  }

  _spawnPowerup() {
    const type = PU_KEYS[Math.floor(Math.random() * PU_KEYS.length)];
    this.powerups.push({
      type, def: PU[type], x: 60 + Math.random() * (this.W - 120),
      y: 60 + Math.random() * (this.H - 120), life: 12, ph: Math.random() * 6
    });
  }

  _collect(r, type) {
    switch (type) {
      case 'health': r.health = Math.min(r.maxHealth, r.health + 35); break;
      case 'fuel': r.fuel = Math.min(r.maxFuel, r.fuel + 50); break;
      case 'ammo': r.ammo = Math.min(r.maxAmmo, r.ammo + 12); break;
      case 'magnet': r.magnet = Math.min(r.magnetMax, r.magnet + 35); break;
      case 'shield': r.shieldT = 8; break;
      case 'overcharge': r.overchargeT = 8; break;
      case 'speed': r.speedT = 8; break;
      case 'rewind': r.rewindCharges = Math.min(2, r.rewindCharges + 1); break;
    }
  }

  // ---- Particles / asteroids / debris ----
  _updateParticles(dt) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
    }
  }

  _updateAsteroids(dt) {
    // 1. Move asteroids & bounce off screen borders
    for (const a of this.asteroids) {
      a.x += a.vx * dt; 
      a.y += a.vy * dt; 
      a.rot += a.vr * dt;
      if (a.x < 40 || a.x > this.W - 40) a.vx *= -1;
      if (a.y < 40 || a.y > this.H - 40) a.vy *= -1;
    }

    // 2. Asteroid vs Asteroid collisions
    for (let i = 0; i < this.asteroids.length; i++) {
      for (let j = i + 1; j < this.asteroids.length; j++) {
        const a1 = this.asteroids[i];
        const a2 = this.asteroids[j];

        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = a1.r + a2.r;

        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart to prevent overlap
          const overlap = minDist - dist;
          a1.x -= nx * overlap * 0.5;
          a1.y -= ny * overlap * 0.5;
          a2.x += nx * overlap * 0.5;
          a2.y += ny * overlap * 0.5;

          // Momentum exchange based on size (mass)
          const kx = a1.vx - a2.vx;
          const ky = a1.vy - a2.vy;
          const p = 2 * (nx * kx + ny * ky) / (a1.r + a2.r);

          a1.vx -= p * a2.r * nx;
          a1.vy -= p * a2.r * ny;
          a2.vx += p * a1.r * nx;
          a2.vy += p * a1.r * ny;

          this._spawn((a1.x + a2.x) / 2, (a1.y + a2.y) / 2, 0, 0, '200,200,200', 2, 0.2);
        }
      }
    }

    // 3. Asteroid vs Rocket collisions
    for (const a of this.asteroids) {
      for (const r of this.rockets) {
        if (r.dead) continue;
        const dx = r.x - a.x;
        const dy = r.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = a.r + 14;

        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist;
          r.x += nx * overlap * 0.5;
          r.y += ny * overlap * 0.5;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;

          // Bounce impulse
          const kx = r.vx - a.vx;
          const ky = r.vy - a.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          r.vx -= p * nx * 0.8;
          r.vy -= p * ny * 0.8;
          a.vx += p * nx * 0.8;
          a.vy += p * ny * 0.8;

          this._damage(r, 5);
          this.shake = Math.max(this.shake, 0.3);
          this._spawn(r.x, r.y, 0, 0, '255,200,100', 4, 0.3);
        }
      }
    }
  }

  _updateDebris(dt) {
    for (const d of this.debris) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.rot += dt;
      if (d.x < 0) d.x = this.W; if (d.x > this.W) d.x = 0;
      if (d.y < 0) d.y = this.H; if (d.y > this.H) d.y = 0;
    }
  }

  // ---- Render ----
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    // fixed background — not affected by camera zoom/pan
    ctx.drawImage(this.nebula, 0, 0, this.W, this.H);
    drawStars(ctx, this.stars, this.t);

    // world layer: dynamic camera frames both rockets (Sideswipe-style)
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14);
    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(this.camScale, this.camScale);
    ctx.translate(-this.camX, -this.camY);

    for (const p of this.planets) drawPlanet(ctx, p, this.t);
    for (const a of this.asteroids) drawAsteroid(ctx, a);
    // debris
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.debris) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#8899bb';
      ctx.fillRect(d.x, d.y, d.size, d.size);
    }
    ctx.restore();

    // powerups
    for (const p of this.powerups) drawPowerup(ctx, p, this.t);
    // fields
    for (const f of this.fields) drawField(ctx, f, this.t);
    // projectiles (trail + glow)
    for (const p of this.projectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${p.glow},0.4)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        if (i === 0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y);
      }
      ctx.stroke();
      ctx.restore();
      drawProjectile(ctx, p, this.t);
    }
    // particles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      if (!p.alive) continue;
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      radialGlow(ctx, p.x, p.y, p.size * 2, p.glow, a);
    }
    ctx.restore();
    // rewind ghosts
    for (const r of this.rockets) {
      if (r.rewinding > 0 && r.history.length > 1) {
        for (let i = 0; i < Math.min(5, r.history.length - 1); i++) {
          const g = r.history[r.history.length - 1 - i * 3];
          if (g) drawGhost(ctx, { x: g.x, y: g.y, angle: g.angle }, 0.3 - i * 0.05);
        }
      }
    }
    // rockets
    for (const r of this.rockets) if (!r.dead) drawRocket(ctx, r, this.t);

    // boundary glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(80,120,200,0.25)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, this.W - 16, this.H - 16);
    ctx.restore();

    ctx.restore();

    // screen flash
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.3})`;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
    // rewind tint
    if (this.timeScale < 0.9) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(this.W / 2, this.H / 2, 0, this.W / 2, this.H / 2, Math.max(this.W, this.H) / 2);
      g.addColorStop(0, 'rgba(0,180,255,0)');
      g.addColorStop(1, 'rgba(0,180,255,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
    // vignette
    const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.3, this.W / 2, this.H / 2, this.H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  _emit() {
    if (!this.onState) return;
    this.onState({
      phase: this.phase, countdown: Math.ceil(this.countdown), matchTime: this.matchTime,
      round: this.round, scores: this.scores, winner: this.winner, timeScale: this.timeScale,
      p1: this._rs(this.p1), p2: this._rs(this.p2)
    });
  }

  _rs(r) {
    return {
      health: Math.round(r.health), maxHealth: r.maxHealth,
      fuel: Math.round(r.fuel), maxFuel: r.maxFuel,
      ammo: r.ammo, maxAmmo: r.maxAmmo,
      magnet: Math.round(r.magnet), magnetMax: r.magnetMax,
      magnetReady: r.magnet >= r.magnetMax && r.magnetCd <= 0, magnetCooldown: Math.ceil(r.magnetCd),
      rewindCharges: r.rewindCharges, rewindCooldown: Math.ceil(r.rewindCd),
      rewindReady: r.rewindCharges > 0 && r.rewindCd <= 0,
      buffs: r.buffs, dead: r.dead
    };
  }
}