import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/game2d/GameEngine';

function Bar({ value, max, color, glow }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
      <div className="h-full rounded-full transition-all duration-150" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${glow}` }} />
    </div>
  );
}

function PlayerHUD({ side, accent, label, s }) {
  return (
    <div className={`flex flex-col gap-1.5 font-serif ${side === 'right' ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2" style={{ flexDirection: side === 'right' ? 'row-reverse' : 'row' }}>
        <span className="text-[11px] font-semibold tracking-[0.2em] text-white/60">{label}</span>
        {s.buffs.map((b) => (
          <span key={b} className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: accent, color: accent, boxShadow: `0 0 8px ${accent}` }}>{b}</span>
        ))}
      </div>
      <div className="w-56 max-w-[44vw]">
        <div className="flex justify-between text-[9px] text-white/50 mb-0.5"><span>HULL</span><span>{s.health}</span></div>
        <Bar value={s.health} max={s.maxHealth} color={accent} glow={accent} />
      </div>
      <div className="grid grid-cols-2 gap-2 w-56 max-w-[44vw]">
        <div>
          <div className="flex justify-between text-[9px] text-white/50 mb-0.5"><span>FUEL</span><span>{s.fuel}</span></div>
          <Bar value={s.fuel} max={s.maxFuel} color="#ffcc33" glow="#ffcc33" />
        </div>
        <div>
          <div className="flex justify-between text-[9px] text-white/50 mb-0.5"><span>AMMO</span><span>{s.ammo}</span></div>
          <Bar value={s.ammo} max={s.maxAmmo} color="#ff8844" glow="#ff8844" />
        </div>
      </div>
      <div className="w-56 max-w-[44vw]">
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-white/50">MAGNET</span>
          <span style={{ color: s.magnetReady ? '#cc88ff' : 'rgba(255,255,255,0.5)' }}>{s.magnetReady ? 'READY [E]' : s.magnetCooldown > 0 ? `${s.magnetCooldown}s` : `${s.magnet}%`}</span>
        </div>
        <Bar value={s.magnet} max={s.magnetMax} color={s.magnetReady ? '#cc88ff' : '#6644aa'} glow={s.magnetReady ? '#cc88ff' : 'transparent'} />
      </div>
      <div className="flex gap-2 text-[9px]" style={{ flexDirection: side === 'right' ? 'row-reverse' : 'row' }}>
        <span className={`px-1.5 py-0.5 rounded-full border ${s.rewindReady ? 'border-cyan-400 text-cyan-300' : 'border-white/15 text-white/30'}`} style={s.rewindReady ? { boxShadow: '0 0 8px #00e5ff' } : {}}>
          ⟲ REWIND {s.rewindReady ? '✓' : s.rewindCooldown > 0 ? `${s.rewindCooldown}s` : `x${s.rewindCharges}`}
        </span>
      </div>
    </div>
  );
}

export default function Game() {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!mountRef.current || engineRef.current) return;
    const engine = new GameEngine(mountRef.current, setState);
    engineRef.current = engine;
    return () => { engine.dispose(); engineRef.current = null; };
  }, []);

  const start = () => engineRef.current?.startMatch();
  const rematch = () => engineRef.current?.rematch();

  const phase = state?.phase ?? 'start';
  const mins = state ? Math.floor(state.matchTime / 60) : 0;
  const secs = state ? Math.floor(state.matchTime % 60) : 0;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none font-serif">
      <div ref={mountRef} className="absolute inset-0" />

      {phase !== 'start' && state && (
        <>
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <PlayerHUD side="left" accent="#ff4455" label="PLAYER 1 · RED" s={state.p1} />
          </div>
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <PlayerHUD side="right" accent="#44aaff" label="PLAYER 2 · BLUE" s={state.p2} />
          </div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center font-serif">
            <div className="text-[10px] tracking-[0.3em] text-white/50">ROUND {state.round}</div>
            <div className="text-2xl text-white/90 tabular-nums">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
            <div className="text-[10px] tracking-[0.2em] text-white/40 mt-0.5">RED {state.scores.p1} · {state.scores.p2} BLUE</div>
          </div>
          {state.timeScale < 0.9 && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-cyan-300 text-2xl tracking-[0.4em] font-serif opacity-70" style={{ textShadow: '0 0 20px #00e5ff' }}>
              ◀◀ TIME REWIND ▶▶
            </div>
          )}
        </>
      )}

      {phase === 'start' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6 bg-black/90 font-serif">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-red-500 via-fuchsia-400 to-blue-500 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 24px rgba(170,85,255,0.6))' }}>
            Vector Duel
          </h1>
          <p className="text-white/70 mt-3 max-w-xl text-sm md:text-base">
            Two rockets duel in deep space. Rewind time to undo mistakes. Charge the electromagnetic super-attack to bend projectiles and crush your enemy.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 text-left max-w-3xl">
            <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4" style={{ boxShadow: '0 0 24px rgba(255,68,85,0.15)' }}>
              <div className="text-red-400 font-bold tracking-widest text-sm mb-2">PLAYER 1 — RED</div>
              <ul className="text-white/70 text-xs space-y-1">
                <li>W — thrust forward</li>
                <li>S — counter-thrust</li>
                <li>A / D — rotate left / right</li>
                <li>SPACE — fire</li>
                <li>SHIFT — boost</li>
                <li>Q — Time Rewind</li>
                <li>E — Magnet Super-Attack</li>
              </ul>
            </div>
            <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4" style={{ boxShadow: '0 0 24px rgba(68,170,255,0.15)' }}>
              <div className="text-blue-400 font-bold tracking-widest text-sm mb-2">PLAYER 2 — BLUE</div>
              <ul className="text-white/70 text-xs space-y-1">
                <li>↑ — thrust forward</li>
                <li>↓ — counter-thrust</li>
                <li>← / → — rotate left / right</li>
                <li>ENTER — fire</li>
                <li>RIGHT SHIFT — boost</li>
                <li>/ — Time Rewind</li>
                <li>. — Magnet Super-Attack</li>
              </ul>
            </div>
          </div>
          <button onClick={start} className="mt-8 px-10 py-3 rounded-full bg-white text-black font-bold tracking-widest text-sm hover:scale-105 transition-transform" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.4)' }}>
            Start Duel
          </button>
          <p className="text-white/40 text-[10px] mt-4 tracking-widest">Collect glowing power-ups · Charge MAGNET to 100% · Rewind restores hull, fuel & ammo</p>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none font-serif">
          <div className="text-8xl font-bold text-white" style={{ filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.6))' }}>
            {state?.countdown > 0 ? state.countdown : 'GO!'}
          </div>
        </div>
      )}

      {phase === 'ended' && state && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-black/80 font-serif">
          <div className="text-sm tracking-[0.4em] text-white/40">ROUND {state.round} COMPLETE</div>
          <h2 className="text-6xl font-bold mt-2" style={{ color: state.winner === 'p1' ? '#ff4455' : '#44aaff', filter: `drop-shadow(0 0 24px ${state.winner === 'p1' ? '#ff4455' : '#44aaff'})` }}>
            {state.winner === 'p1' ? 'RED' : 'BLUE'} VICTORY
          </h2>
          <div className="text-white/70 mt-3">RED {state.scores.p1} — {state.scores.p2} BLUE</div>
          <button onClick={rematch} className="mt-8 px-10 py-3 rounded-full bg-white text-black font-bold tracking-widest text-sm hover:scale-105 transition-transform" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.4)' }}>
            REMATCH
          </button>
        </div>
      )}
    </div>
  );
}