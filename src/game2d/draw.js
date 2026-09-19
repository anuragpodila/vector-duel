// Pure 2D canvas drawing helpers. All glow uses additive ('lighter') blending.

export function rgba(rgb, a) { return `rgba(${rgb},${a})`; }

export function makeNebula(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, w, h);
  const blobs = [
    { x: 0.25, y: 0.3, r: 0.5, col: '90,40,160' },
    { x: 0.75, y: 0.7, r: 0.55, col: '40,90,180' },
    { x: 0.6, y: 0.25, r: 0.4, col: '160,40,90' },
    { x: 0.2, y: 0.8, r: 0.45, col: '40,140,150' }
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const b of blobs) {
    const cx = b.x * w, cy = b.y * h, rad = b.r * Math.max(w, h);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${b.col},0.22)`);
    g.addColorStop(0.5, `rgba(${b.col},0.08)`);
    g.addColorStop(1, `rgba(${b.col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

export function radialGlow(ctx, x, y, r, rgb, alpha) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.4, `rgba(${rgb},${alpha * 0.5})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawStars(ctx, stars, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of stars) {
    const x = (s.x + t * s.drift) % 1;
    const px = (x < 0 ? x + 1 : x) * s.w;
    const py = (s.y + Math.sin(t * 0.05 + s.y) * 0.005) * s.h;
    ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(t * s.tw + s.ph));
    ctx.fillStyle = s.col;
    ctx.fillRect(px, py, s.size, s.size);
  }
  ctx.restore();
}

export function drawPlanet(ctx, p, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  radialGlow(ctx, p.x, p.y, p.r * 2.2, p.glow, 0.25);
  ctx.restore();
  ctx.save();
  const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
  g.addColorStop(0, p.light);
  g.addColorStop(1, p.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  if (p.ring) {
    ctx.strokeStyle = p.ring;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * 1.7, p.r * 0.5, p.tilt, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAsteroid(ctx, a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  ctx.fillStyle = '#3a342e';
  ctx.strokeStyle = '#5a4f44';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < a.pts.length; i++) {
    const p = a.pts[i];
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawRocket(ctx, r, t) {
  // afterimage ghosts handled separately
  // glow + flame (additive)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  radialGlow(ctx, r.x, r.y, 26, r.glow, r.thrusting ? 0.5 : 0.3);
  // engine flame
  if (r.thrusting) {
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    const fl = 14 + r.flame * 18 + Math.sin(t * 40) * 3;
    const g = ctx.createLinearGradient(-8, 0, -8 - fl, 0);
    g.addColorStop(0, `rgba(${r.glow},0.9)`);
    g.addColorStop(0.5, `rgba(255,220,150,0.6)`);
    g.addColorStop(1, `rgba(${r.glow},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-8 - fl, 0);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    // inner core flame
    ctx.fillStyle = `rgba(255,255,255,0.7)`;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-8 - fl * 0.5, 0);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // body
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle);
  // wings
  ctx.fillStyle = '#2a2e36';
  ctx.beginPath();
  ctx.moveTo(-2, -10); ctx.lineTo(-14, -14); ctx.lineTo(-14, -6); ctx.lineTo(-6, -6); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, 10); ctx.lineTo(-14, 14); ctx.lineTo(-14, 6); ctx.lineTo(-6, 6); ctx.closePath();
  ctx.fill();
  // accent stripes
  ctx.fillStyle = r.color;
  ctx.fillRect(-13, -13, 7, 1.5);
  ctx.fillRect(-13, 11.5, 7, 1.5);
  // fuselage
  ctx.fillStyle = '#3a3f48';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(6, -7);
  ctx.lineTo(-12, -6);
  ctx.lineTo(-12, 6);
  ctx.lineTo(6, 7);
  ctx.closePath();
  ctx.fill();
  // nose accent
  ctx.fillStyle = r.color;
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3); ctx.closePath();
  ctx.fill();
  // cockpit
  ctx.fillStyle = '#0a0c10';
  ctx.beginPath();
  ctx.ellipse(4, 0, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${r.glow},0.7)`;
  ctx.beginPath();
  ctx.ellipse(5, 0, 2.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // engine nacelles
  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(-12, -8, 5, 3);
  ctx.fillRect(-12, 5, 5, 3);
  ctx.restore();

  // shield
  if (r.shieldT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${r.glow},${0.4 + Math.sin(t * 8) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    radialGlow(ctx, r.x, r.y, 24, r.glow, 0.12);
    ctx.restore();
  }
  // disrupt flicker
  if (r.disruptT > 0 && Math.sin(t * 30) > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    radialGlow(ctx, r.x, r.y, 20, '180,120,255', 0.2);
    ctx.restore();
  }
}

export function drawGhost(ctx, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle);
  ctx.fillStyle = `rgba(120,230,255,1)`;
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(4, -6); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.lineTo(4, 6); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawProjectile(ctx, p, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  radialGlow(ctx, p.x, p.y, 9, p.glow, 0.8);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPowerup(ctx, p, t) {
  const def = p.def;
  const pulse = 1 + Math.sin(t * 4 + p.ph) * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  radialGlow(ctx, p.x, p.y, 22 * pulse, def.glow, 0.5);
  ctx.restore();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(t * 1.5);
  ctx.fillStyle = def.color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const s = 9 * pulse;
  ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // icon letter
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.label, p.x, p.y);
  ctx.restore();
}

export function drawField(ctx, f, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // pulsing waves
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.6 + i / 3) % 1;
    const rad = f.radius * phase;
    ctx.strokeStyle = `rgba(170,90,255,${0.4 * (1 - phase)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(f.x, f.y, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  radialGlow(ctx, f.x, f.y, f.radius, '150,80,255', 0.18);
  // field lines (rotating arcs)
  ctx.strokeStyle = `rgba(200,150,255,0.6)`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = t * 0.8 + i * (Math.PI / 3);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius * (0.4 + 0.5 * Math.abs(Math.sin(t + i))), a, a + 1.1);
    ctx.stroke();
  }
  // lightning arcs
  for (let i = 0; i < 8; i++) {
    if (Math.random() > 0.5) continue;
    const a = Math.random() * Math.PI * 2;
    const r1 = f.radius * 0.2, r2 = f.radius * (0.7 + Math.random() * 0.3);
    ctx.strokeStyle = `rgba(220,180,255,${0.4 + Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
    let px = f.x + Math.cos(a) * r1, py = f.y + Math.sin(a) * r1;
    const segs = 4;
    for (let s = 1; s <= segs; s++) {
      const tt = s / segs;
      const rr = r1 + (r2 - r1) * tt;
      const aa = a + (Math.random() - 0.5) * 0.5;
      px = f.x + Math.cos(aa) * rr; py = f.y + Math.sin(aa) * rr;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // shockwave
  if (f.shock < 1) {
    ctx.strokeStyle = `rgba(200,150,255,${0.9 * (1 - f.shock)})`;
    ctx.lineWidth = 4 * (1 - f.shock) + 1;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius * f.shock, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}