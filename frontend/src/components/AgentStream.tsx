'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/lib/context';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const CANVAS_W = 560;
const CANVAS_H = 420;

/* ── Game state types ─────────────────────────────────────────────────────── */
interface Vec2 { x: number; y: number; }
interface Bird  { pos: Vec2; vel: Vec2; radius: number; type: string; active: boolean; }
interface Pig   { pos: Vec2; radius: number; alive: boolean; health: number; }
interface Block { x: number; y: number; w: number; h: number; material: string; hp: number; }
interface GameState {
  bird: Bird; pigs: Pig[]; blocks: Block[]; score: number;
  phase: 'idle'|'launch'|'flight'|'explode'|'reset';
  t: number; birdQ: string[]; trail: Vec2[]; angle: number; power: number;
}

/* ── Palette ──────────────────────────────────────────────────────────────── */
const BIRD_COLORS: Record<string, string>  = { red:'#ef4444', yellow:'#facc15', blue:'#3b82f6', black:'#1f2937' };
const BLOCK_COLORS: Record<string, string> = { wood:'#92400e', stone:'#6b7280', ice:'#bae6fd' };

/* ── Sine easing ─────────────────────────────────────────────────────────── */
function ease(t: number) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }

/* ── Simulate a simple Angry Birds round for demo purposes ─────────────────  */
function buildLevel(): { pigs: Pig[]; blocks: Block[] } {
  return {
    pigs: [
      { pos:{x:440,y:310}, radius:16, alive:true, health:100 },
      { pos:{x:490,y:260}, radius:14, alive:true, health:100 },
    ],
    blocks: [
      { x:410, y:330, w:24, h:24, material:'wood', hp:100 },
      { x:460, y:280, w:24, h:24, material:'stone', hp:150 },
      { x:435, y:280, w:10, h:60, material:'wood', hp:80  },
    ],
  };
}

function makeBird(type='red'): Bird {
  return { pos:{x:85,y:285}, vel:{x:0,y:0}, radius:12, type, active:false };
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function AgentStream() {
  const { backendOnline } = useApp();
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const frameRef    = useRef<number>(0);
  const stateRef    = useRef<GameState>({
    bird:    makeBird('red'),
    pigs:    buildLevel().pigs,
    blocks:  buildLevel().blocks,
    score:   0,
    phase:   'idle' as 'idle'|'launch'|'flight'|'explode'|'reset',
    t:       0,       // phase timer 0→1
    birdQ:   ['yellow','blue','black','red'] as string[],
    trail:   [] as Vec2[],
    angle:   38,      // degrees
    power:   0.88,
  });

  /* ── Try to pull a real backend frame first ─────────────────────────────── */
  const [liveFrame,   setLiveFrame]   = useState<string|null>(null);
  const [usingLive,   setUsingLive]   = useState(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    if (!backendOnline) return;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/latest-frame?t=${Date.now()}`, { method:'HEAD' });
        if (r.ok) { setLiveFrame(`${API}/latest-frame?t=${Date.now()}`); setUsingLive(true); }
        else       { setUsingLive(false); }
      } catch { setUsingLive(false); }
    };
    liveIntervalRef.current = setInterval(poll, 500);
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, [backendOnline]);

  /* ── Canvas animation ─────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    /* ── Sky gradient ─────────────────────────────────────────────────── */
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0,   '#0ea5e9');
    sky.addColorStop(0.7, '#7dd3fc');
    sky.addColorStop(1,   '#bae6fd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    /* ── Ground ─────────────────────────────────────────────────────────── */
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(0, CANVAS_H - 55, CANVAS_W, 55);
    ctx.fillStyle = '#4d7c0f';
    ctx.fillRect(0, CANVAS_H - 55, CANVAS_W, 8);

    /* ── Clouds ─────────────────────────────────────────────────────────── */
    const cloudX = (Date.now() / 30000 * CANVAS_W) % (CANVAS_W + 120) - 60;
    drawCloud(ctx, cloudX, 40, 80);
    drawCloud(ctx, (cloudX + 250) % (CANVAS_W + 120) - 60, 70, 60);

    /* ── Slingshot ─────────────────────────────────────────────────────── */
    drawSlingshot(ctx, 80, CANVAS_H - 55);

    /* ── Trajectory dots ─────────────────────────────────────────────────── */
    if (s.phase === 'idle' || s.phase === 'reset') {
      // Show aim guide
      const speedX = Math.cos(s.angle * Math.PI / 180) * s.power * 280;
      const speedY = -Math.sin(s.angle * Math.PI / 180) * s.power * 280;
      ctx.save();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let tx = 85, ty = 285, tvx = speedX, tvy = speedY;
      ctx.moveTo(tx, ty);
      for (let i = 0; i < 20; i++) {
        tvy += 0.5 * 16; tvx *= 0.995;
        tx += tvx / 16; ty += tvy / 16;
        if (ty > CANVAS_H - 55) break;
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* ── Trail ─────────────────────────────────────────────────────────── */
    if (s.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.trail[0].x, s.trail[0].y);
      for (const p of s.trail) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }

    /* ── Blocks ─────────────────────────────────────────────────────────── */
    for (const b of s.blocks) {
      if (b.hp <= 0) continue;
      const alpha = b.hp / 150;
      ctx.fillStyle = BLOCK_COLORS[b.material] || '#888';
      ctx.globalAlpha = 0.5 + 0.5 * alpha;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
    }

    /* ── Pigs ─────────────────────────────────────────────────────────── */
    for (const pig of s.pigs) {
      if (!pig.alive) continue;
      // Body
      ctx.beginPath();
      ctx.arc(pig.pos.x, pig.pos.y, pig.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(pig.pos.x - 5, pig.pos.y - 4, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(pig.pos.x + 5, pig.pos.y - 4, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(pig.pos.x - 4, pig.pos.y - 4, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(pig.pos.x + 6, pig.pos.y - 4, 2, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = '#86efac';
      ctx.beginPath(); ctx.ellipse(pig.pos.x, pig.pos.y + 3, 5, 3, 0, 0, Math.PI*2); ctx.fill();
    }

    /* ── Bird ─────────────────────────────────────────────────────────── */
    const b = s.bird;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = BIRD_COLORS[b.type] || '#ef4444';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Beak
    const beakDir = b.active
      ? Math.atan2(b.vel.y, b.vel.x)
      : -0.4;
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(beakDir);
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(b.radius - 2, 0);
    ctx.lineTo(b.radius + 8, 4);
    ctx.lineTo(b.radius + 8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Eye
    const ex = b.pos.x + Math.cos(beakDir - 0.6) * 6;
    const ey = b.pos.y + Math.sin(beakDir - 0.6) * 6;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex+1, ey, 2, 0, Math.PI*2); ctx.fill();

    /* ── HUD ─────────────────────────────────────────────────────────── */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 140, 56, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter,sans-serif';
    ctx.fillText(`Score: ${s.score}`, 18, 28);
    ctx.font = '11px Inter,sans-serif';
    ctx.fillStyle = '#fde68a';
    const alive = s.pigs.filter(p=>p.alive).length;
    ctx.fillText(`Pigs remaining: ${alive}`, 18, 46);
    ctx.fillText(`Bird: ${s.bird.type}`, 18, 60);

    /* ── AGENT badge ─────────────────────────────────────────────────── */
    ctx.fillStyle = 'rgba(239,68,68,0.85)';
    ctx.beginPath(); ctx.roundRect(CANVAS_W-110, 10, 100, 22, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Inter,sans-serif';
    ctx.fillText('● AGENT PLAYING', CANVAS_W-104, 25);

    /* ── Physics step ─────────────────────────────────────────────────── */
    updatePhysics(s);

    frameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-700 shadow-2xl bg-black">
      {usingLive && liveFrame
        ? /* Live backend frame takes priority */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={liveFrame} alt="Live Agent" className="w-full object-contain" />
        : /* Canvas simulation */
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full"
            style={{ display: 'block' }}
          />
      }
      <div className="absolute bottom-2 right-2 text-[10px] text-white/40 font-mono">
        {usingLive ? 'backend stream' : 'canvas sim'}
      </div>
    </div>
  );
}

/* ── Physics update (runs every frame) ──────────────────────────────────── */
function updatePhysics(s: GameState) {
  const GRAVITY = 0.38;
  const GROUND  = CANVAS_H - 55;

  if (s.phase === 'idle') {
    s.t += 0.008;
    if (s.t >= 1) {
      s.t = 0;
      s.phase = 'launch';
      const speedX = Math.cos(s.angle * Math.PI / 180) * s.power * 280;
      const speedY = -Math.sin(s.angle * Math.PI / 180) * s.power * 280;
      s.bird.vel = { x: speedX / 60, y: speedY / 60 };
      s.bird.active = true;
      s.trail = [];
    }
  }

  else if (s.phase === 'launch' || s.phase === 'flight') {
    s.phase = 'flight';
    s.bird.vel.y += GRAVITY / 60;
    s.bird.vel.x *= 0.998;
    s.bird.pos.x += s.bird.vel.x * 2.2;
    s.bird.pos.y += s.bird.vel.y * 2.2;

    if (s.trail.length === 0 || dist(s.bird.pos, s.trail[s.trail.length-1]) > 12) {
      s.trail.push({ ...s.bird.pos });
      if (s.trail.length > 35) s.trail.shift();
    }

    // Ground collision
    if (s.bird.pos.y >= GROUND - s.bird.radius) {
      s.bird.pos.y = GROUND - s.bird.radius;
      s.phase = 'explode';
      s.t = 0;
    }

    // Block collisions
    for (const blk of s.blocks) {
      if (blk.hp <= 0) continue;
      if (
        s.bird.pos.x + s.bird.radius > blk.x &&
        s.bird.pos.x - s.bird.radius < blk.x + blk.w &&
        s.bird.pos.y + s.bird.radius > blk.y &&
        s.bird.pos.y - s.bird.radius < blk.y + blk.h
      ) {
        const spd = Math.hypot(s.bird.vel.x, s.bird.vel.y);
        blk.hp -= spd * 40;
        s.score += Math.round(spd * 10);
        s.bird.vel.x *= -0.4; s.bird.vel.y *= -0.4;
      }
    }

    // Pig collisions
    for (const pig of s.pigs) {
      if (!pig.alive) continue;
      if (dist(s.bird.pos, pig.pos) < s.bird.radius + pig.radius) {
        const spd = Math.hypot(s.bird.vel.x, s.bird.vel.y);
        pig.health -= spd * 80;
        if (pig.health <= 0) {
          pig.alive = false;
          s.score += 500;
        }
        s.phase = 'explode'; s.t = 0;
      }
    }

    // Out of bounds
    if (s.bird.pos.x > CANVAS_W + 30 || s.bird.pos.y > GROUND + 30) {
      s.phase = 'explode'; s.t = 0;
    }
  }

  else if (s.phase === 'explode') {
    s.t += 0.06;
    if (s.t >= 1) s.phase = 'reset';
  }

  else if (s.phase === 'reset') {
    s.t += 0.015;
    if (s.t >= 1) {
      s.t = 0;
      // All pigs dead → new level
      if (s.pigs.every(p => !p.alive)) {
        const lvl = buildLevel();
        s.pigs   = lvl.pigs;
        s.blocks = lvl.blocks;
        s.score  = 0;
      }
      const nextType = s.birdQ.shift() || 'red';
      s.birdQ.push(nextType);
      s.bird = makeBird(nextType);
      s.trail = [];
      s.phase = 'idle';
      // Slightly randomise angle/power each shot
      s.angle = 28 + Math.random() * 30;
      s.power = 0.70 + Math.random() * 0.25;
    }
  }
}

function dist(a: Vec2, b: Vec2) { return Math.hypot(a.x-b.x, a.y-b.y); }

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r*0.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+r*0.4, y, r*0.4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+r*0.8, y, r*0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x-r*0.3, y, r*0.35, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawSlingshot(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  // Main pole
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY-60); ctx.stroke();
  // Left fork
  ctx.beginPath(); ctx.moveTo(x, groundY-45); ctx.lineTo(x-12, groundY-70); ctx.stroke();
  // Right fork
  ctx.beginPath(); ctx.moveTo(x, groundY-45); ctx.lineTo(x+12, groundY-70); ctx.stroke();
  // Rubber bands
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x-12, groundY-70); ctx.lineTo(85, 285); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+12, groundY-70); ctx.lineTo(85, 285); ctx.stroke();
}
