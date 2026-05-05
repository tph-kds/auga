'use client';
import { useEffect, useRef, useCallback, useState } from 'react';

/* ── types ── */
type BirdType = 'red'|'yellow'|'blue'|'black';
interface Bird { x:number;y:number;vx:number;vy:number;type:BirdType;r:number;launched:boolean;dead:boolean;splits?:Bird[] }
interface Block { x:number;y:number;w:number;h:number;mat:'wood'|'stone'|'ice';hp:number;maxHp:number;vx:number;vy:number;angle:number;av:number }
interface Pig  { x:number;y:number;r:number;hp:number;maxHp:number;vx:number;vy:number;dead:boolean;score:number }
interface Particle { x:number;y:number;vx:number;vy:number;life:number;maxLife:number;color:string;r:number }

/* ── level definitions ── */
const LEVELS = [
  { birds:['red','red','yellow'] as BirdType[], pigs:[{x:600,y:450}], blocks:[{x:580,y:470,w:20,h:40,mat:'wood' as const},{x:620,y:470,w:20,h:40,mat:'wood' as const},{x:600,y:430,w:60,h:20,mat:'wood' as const}] },
  { birds:['red','blue','black','yellow'] as BirdType[], pigs:[{x:580,y:448},{x:680,y:448}], blocks:[{x:560,y:470,w:20,h:40,mat:'stone' as const},{x:660,y:470,w:20,h:40,mat:'ice' as const},{x:580,y:430,w:20,h:40,mat:'wood' as const},{x:680,y:430,w:20,h:40,mat:'wood' as const},{x:630,y:380,w:60,h:20,mat:'stone' as const}] },
  { birds:['black','blue','yellow','red','red'] as BirdType[], pigs:[{x:560,y:448},{x:630,y:448},{x:700,y:448},{x:660,y:390}], blocks:[{x:540,y:470,w:20,h:40,mat:'stone' as const},{x:540,y:420,w:20,h:40,mat:'stone' as const},{x:610,y:470,w:20,h:40,mat:'wood' as const},{x:680,y:470,w:20,h:40,mat:'stone' as const},{x:720,y:470,w:20,h:40,mat:'stone' as const},{x:650,y:410,w:80,h:20,mat:'ice' as const},{x:660,y:370,w:40,h:20,mat:'wood' as const}] },
];

const MAT_COLOR = { wood:'#92400e', stone:'#6b7280', ice:'#7dd3fc' };
const BIRD_COLOR:Record<BirdType,string> = { red:'#ef4444', yellow:'#eab308', blue:'#3b82f6', black:'#1f2937' };
const GRAVITY = 0.4;

function mkBird(type:BirdType): Bird {
  return { x:120, y:430, vx:0, vy:0, type, r: type==='black'?16:type==='blue'?9:12, launched:false, dead:false };
}

function mkParticles(x:number,y:number,color:string,n=8): Particle[] {
  return Array.from({length:n},()=>({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6-2,life:40,maxLife:40,color,r:Math.random()*4+2}));
}

export default function GameCanvas({ className='', onScoreUpdate }: { className?:string; onScoreUpdate?:(s:number,ep:number)=>void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{
    birds:Bird[]; queue:BirdType[]; blocks:Block[]; pigs:Pig[]; particles:Particle[];
    score:number; level:number; phase:'aim'|'fly'|'dead'|'win'|'lose'; frame:number;
    drag:boolean; dragX:number; dragY:number; aimAngle:number; aimPower:number;
    birdIdx:number; episodes:number; bestScore:number;
  }>({birds:[],queue:[],blocks:[],pigs:[],particles:[],score:0,level:0,phase:'aim',frame:0,drag:false,dragX:0,dragY:0,aimAngle:0,aimPower:12,birdIdx:0,episodes:0,bestScore:0});
  const animRef = useRef(0);
  const [ui, setUi] = useState({ score:0,level:1,birds:0,pigs:0,episode:0,phase:'aim' as string,bestScore:0 });

  const loadLevel = useCallback((lvl:number) => {
    const def = LEVELS[lvl % LEVELS.length];
    const s = state.current;
    s.level = lvl; s.score = 0; s.phase = 'aim'; s.frame = 0; s.birdIdx = 0;
    s.queue = [...def.birds];
    s.birds = [mkBird(s.queue[0])];
    s.pigs = def.pigs.map(p=>({...p,r:14,hp:60,maxHp:60,vx:0,vy:0,dead:false,score:500}));
    s.blocks = def.blocks.map(b=>({...b,hp:b.mat==='stone'?120:b.mat==='ice'?50:80,maxHp:b.mat==='stone'?120:b.mat==='ice'?50:80,vx:0,vy:0,angle:0,av:0}));
    s.particles = [];
  }, []);

  const launch = useCallback(() => {
    const s = state.current;
    if (s.phase!=='aim') return;
    const bird = s.birds[0];
    if (!bird || bird.launched) return;
    const power = s.aimPower;
    const angle = s.aimAngle;
    bird.launched = true;
    bird.vx = Math.cos(angle)*power;
    bird.vy = Math.sin(angle)*power;
    s.phase = 'fly';
  }, []);

  useEffect(() => {
    loadLevel(0);
    const canvas = ref.current!;

    const onDown = (e:MouseEvent) => {
      const s = state.current;
      if (s.phase!=='aim') return;
      const r=canvas.getBoundingClientRect();
      const mx=(e.clientX-r.left)*(canvas.width/r.width);
      const my=(e.clientY-r.top)*(canvas.height/r.height);
      const bx=120*canvas.width/800, by=430*canvas.height/600;
      if (Math.hypot(mx-bx,my-by)<30) { s.drag=true; s.dragX=mx; s.dragY=my; }
    };
    const onMove = (e:MouseEvent) => {
      const s = state.current;
      if (!s.drag) return;
      const r=canvas.getBoundingClientRect();
      const mx=(e.clientX-r.left)*(canvas.width/r.width);
      const my=(e.clientY-r.top)*(canvas.height/r.height);
      const bx=120*canvas.width/800, by=430*canvas.height/600;
      const dx=mx-bx, dy=my-by;
      s.aimAngle = Math.atan2(-dy,-dx);
      s.aimPower = Math.min(20,Math.hypot(dx,dy)/10+8);
    };
    const onUp = () => { const s=state.current; if(s.drag){s.drag=false;launch();} };

    canvas.addEventListener('mousedown',onDown);
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);

    const tick = () => {
      const s = state.current;
      const canvas = ref.current!;
      if (!canvas) { animRef.current=requestAnimationFrame(tick); return; }
      const ctx = canvas.getContext('2d')!;
      const W=canvas.width=canvas.offsetWidth*devicePixelRatio;
      const H=canvas.height=canvas.offsetHeight*devicePixelRatio;
      const sx=W/800, sy=H/600;

      s.frame++;

      /* ── physics ── */
      if (s.phase==='fly') {
        { // physics bird scope
        const bird = s.birds[0];
        if (bird && bird.launched && !bird.dead) {
          bird.vx*=0.999; bird.vy+=GRAVITY;
          bird.x+=bird.vx; bird.y+=bird.vy;

          // yellow speed boost at peak
          if (bird.type==='yellow' && bird.vy>0 && s.frame%3===0) { bird.vx*=1.02; }

          // blue splits once on click — handled separately; here auto-split at apex
          if (bird.type==='blue' && bird.vy>0 && !bird.splits) {
            bird.splits = [
              {...bird,vy:bird.vy-3,vx:bird.vx-1},
              {...bird,vy:bird.vy+3,vx:bird.vx-1},
            ];
          }

          // ground
          if (bird.y>550*sy/sy) { bird.dead=true; s.particles.push(...mkParticles(bird.x/sx,550,BIRD_COLOR[bird.type])); }

          // pig collision
          for (const pig of s.pigs) {
            if (pig.dead) continue;
            if (Math.hypot(bird.x/sx-pig.x,bird.y/sy-pig.y)<bird.r+pig.r) {
              const dmg = Math.hypot(bird.vx,bird.vy)*4;
              pig.hp -= dmg;
              pig.vx = bird.vx*0.5; pig.vy = bird.vy*0.3-2;
              s.particles.push(...mkParticles(pig.x,pig.y,'#4ade80',12));
              bird.vx*=0.3; bird.vy*=0.3;
              if (pig.hp<=0){ pig.dead=true; s.score+=pig.score; s.particles.push(...mkParticles(pig.x,pig.y,'#fbbf24',20)); }
            }
          }

          // block collision
          for (const blk of s.blocks) {
            if (blk.hp<=0) continue;
            const bx=blk.x-blk.w/2, by2=blk.y-blk.h/2;
            const cx=Math.max(bx,Math.min(bird.x/sx,bx+blk.w));
            const cy=Math.max(by2,Math.min(bird.y/sy,by2+blk.h));
            const dist=Math.hypot(bird.x/sx-cx,bird.y/sy-cy);
            if (dist<bird.r) {
              const speed=Math.hypot(bird.vx,bird.vy);
              const dmg=speed*(bird.type==='black'?8:4);
              blk.hp-=dmg;
              blk.vx+=bird.vx*0.4; blk.vy+=bird.vy*0.2;
              s.particles.push(...mkParticles(blk.x,blk.y,MAT_COLOR[blk.mat],6));
              bird.vx*=0.4; bird.vy*=-0.3;
              if (blk.hp<=0) s.score+=50;
              // black bird explosion
              if (bird.type==='black' && speed>8) {
                for (const b2 of s.blocks) {
                  const d=Math.hypot(b2.x-blk.x,b2.y-blk.y);
                  if (d<80) b2.hp-=200;
                }
                for (const p of s.pigs) {
                  if (Math.hypot(p.x-blk.x,p.y-blk.y)<100) { p.hp-=150; if(p.hp<=0){p.dead=true;s.score+=p.score;} }
                }
              }
            }
          }
        }
        } // end physics bird scope

        // block physics
        for (const blk of s.blocks) {
          if (blk.hp<=0) continue;
          blk.vy+=GRAVITY*0.5; blk.vx*=0.95; blk.vy*=0.85;
          blk.x+=blk.vx; blk.y+=blk.vy; blk.angle+=blk.av; blk.av*=0.9;
          if (blk.y>565) { blk.y=565; blk.vy=-blk.vy*0.2; blk.vx*=0.7; }
        }
        // pig physics
        for (const pig of s.pigs) {
          if (pig.dead) continue;
          pig.vy+=GRAVITY*0.3; pig.vx*=0.9;
          pig.x+=pig.vx; pig.y+=pig.vy;
          if (pig.y>548) { pig.y=548; pig.vy=-pig.vy*0.3; }
        }

        // check next bird
        const currentBird = s.birds[0];
        if (currentBird && (currentBird.dead || (currentBird.launched && Math.abs(currentBird.vx)<0.3 && Math.abs(currentBird.vy)<0.3 && s.frame>60))) {
          s.birdIdx++;
          if (s.birdIdx<s.queue.length) {
            s.birds[0]=mkBird(s.queue[s.birdIdx]);
            s.phase='aim'; s.frame=0;
          } else {
            s.phase='lose';
          }
        }

        // win check
        if (s.pigs.every(p=>p.dead)) {
          s.score += s.queue.slice(s.birdIdx+1).length*1000;
          s.phase='win'; s.episodes++;
          if (s.score>s.bestScore) s.bestScore=s.score;
          onScoreUpdate?.(s.score, s.episodes);
        }
        if (s.pigs.every(p=>p.dead)===false && s.phase==='lose') {
          s.episodes++;
          onScoreUpdate?.(s.score, s.episodes);
        }
      }

      // particles
      s.particles = s.particles.filter(p=>p.life>0);
      for (const p of s.particles) { p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.vx*=0.95; p.life--; }

      // restart after delay
      if ((s.phase==='win'||s.phase==='lose') && s.frame%180===0) {
        loadLevel(s.phase==='win' ? (s.level+1) : s.level);
      }

      /* ── render ── */
      ctx.save(); ctx.scale(sx,sy);

      // sky gradient
      const sky=ctx.createLinearGradient(0,0,0,560);
      sky.addColorStop(0,'#0ea5e9'); sky.addColorStop(0.5,'#7dd3fc'); sky.addColorStop(1,'#bfdbfe');
      ctx.fillStyle=sky; ctx.fillRect(0,0,800,600);

      // clouds
      ctx.fillStyle='rgba(255,255,255,0.75)';
      [[80+s.frame*0.15%900,60,40],[300+s.frame*0.1%900,90,30],[550+s.frame*0.2%900,50,50]].forEach(([cx,cy,cr])=>{
        ctx.beginPath(); ctx.arc(cx as number,(cy as number),cr as number,0,Math.PI*2);
        ctx.arc((cx as number)+cr*0.8,(cy as number)-cr*0.3,cr*0.7,0,Math.PI*2);
        ctx.arc((cx as number)+cr*1.6,(cy as number),cr*0.8,0,Math.PI*2); ctx.fill();
      });

      // hills
      ctx.fillStyle='#16a34a';
      ctx.beginPath(); ctx.ellipse(200,560,180,60,0,Math.PI,2*Math.PI); ctx.fill();
      ctx.beginPath(); ctx.ellipse(650,560,200,70,0,Math.PI,2*Math.PI); ctx.fill();

      // ground
      const gnd=ctx.createLinearGradient(0,545,0,600);
      gnd.addColorStop(0,'#4ade80'); gnd.addColorStop(0.2,'#15803d'); gnd.addColorStop(0.3,'#713f12'); gnd.addColorStop(1,'#451a03');
      ctx.fillStyle=gnd; ctx.fillRect(0,545,800,60);

      // slingshot
      ctx.fillStyle='#78350f'; ctx.fillRect(108,490,8,70); ctx.fillRect(95,463,10,18); ctx.fillRect(113,463,10,18);
      ctx.strokeStyle='#1c1917'; ctx.lineWidth=3;
      const renderBird = s.birds[0];
      if (renderBird && !renderBird.launched) {
        ctx.beginPath(); ctx.moveTo(100,470); ctx.lineTo(renderBird.x,renderBird.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(118,470); ctx.lineTo(renderBird.x,renderBird.y); ctx.stroke();
      }

      // aim line
      if (s.phase==='aim' && renderBird && !renderBird.launched) {
        ctx.setLineDash([5,8]); ctx.strokeStyle='rgba(255,220,0,0.5)'; ctx.lineWidth=2;
        ctx.beginPath();
        let px=renderBird.x, py=renderBird.y;
        const pvx=Math.cos(s.aimAngle)*s.aimPower, pvy=Math.sin(s.aimAngle)*s.aimPower;
        ctx.moveTo(px,py);
        for (let t=0;t<40;t++) {
          px+=pvx*(1-t*0.01); py+=pvy*(1-t*0.01)+GRAVITY*(t*t*0.02);
          ctx.lineTo(px,py); if (py>560) break;
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      // queued birds
      for (let i=s.birdIdx+1;i<s.queue.length;i++) {
        const qx=40+(i-s.birdIdx-1)*28, qy=540;
        ctx.fillStyle=BIRD_COLOR[s.queue[i]];
        ctx.beginPath(); ctx.arc(qx,qy,10,0,Math.PI*2); ctx.fill();
      }

      // blocks
      for (const blk of s.blocks) {
        if (blk.hp<=0) continue;
        ctx.save(); ctx.translate(blk.x,blk.y); ctx.rotate(blk.angle);
        const alpha=Math.min(1,blk.hp/blk.maxHp*0.4+0.6);
        ctx.fillStyle=MAT_COLOR[blk.mat]; ctx.globalAlpha=alpha;
        ctx.fillRect(-blk.w/2,-blk.h/2,blk.w,blk.h);
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1.5;
        ctx.strokeRect(-blk.w/2,-blk.h/2,blk.w,blk.h);
        if (blk.hp<blk.maxHp*0.5) {
          ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(-blk.w*0.3,-blk.h*0.2); ctx.lineTo(blk.w*0.2,blk.h*0.3); ctx.stroke();
        }
        ctx.globalAlpha=1; ctx.restore();
      }

      // pigs
      for (const pig of s.pigs) {
        if (pig.dead) continue;
        const hpRatio=pig.hp/pig.maxHp;
        ctx.fillStyle=hpRatio>0.5?'#4ade80':'#a3e635';
        ctx.beginPath(); ctx.arc(pig.x,pig.y,pig.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#166534'; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle='#22c55e';
        ctx.beginPath(); ctx.ellipse(pig.x,pig.y+2,6,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='white';
        ctx.beginPath(); ctx.arc(pig.x-5,pig.y-4,3.5,0,Math.PI*2); ctx.arc(pig.x+5,pig.y-4,3.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1f2937';
        ctx.beginPath(); ctx.arc(pig.x-4,pig.y-4,2,0,Math.PI*2); ctx.arc(pig.x+6,pig.y-4,2,0,Math.PI*2); ctx.fill();
        // hp bar
        ctx.fillStyle='#dc2626'; ctx.fillRect(pig.x-pig.r,pig.y-pig.r-6,pig.r*2,4);
        ctx.fillStyle='#16a34a'; ctx.fillRect(pig.x-pig.r,pig.y-pig.r-6,pig.r*2*hpRatio,4);
      }

      // bird
      if (renderBird) {
        const bc=BIRD_COLOR[renderBird.type];
        ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(renderBird.x+2,renderBird.y+renderBird.r*0.9,renderBird.r,renderBird.r*0.35,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=bc; ctx.beginPath(); ctx.arc(renderBird.x,renderBird.y,renderBird.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(renderBird.x-renderBird.r*0.3,renderBird.y-renderBird.r*0.3,renderBird.r*0.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(renderBird.x+renderBird.r*0.35,renderBird.y-renderBird.r*0.2,3.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1f2937'; ctx.beginPath(); ctx.arc(renderBird.x+renderBird.r*0.45,renderBird.y-renderBird.r*0.2,2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#f59e0b';
        ctx.beginPath(); ctx.moveTo(renderBird.x+renderBird.r*0.7,renderBird.y); ctx.lineTo(renderBird.x+renderBird.r*1.4,renderBird.y+2); ctx.lineTo(renderBird.x+renderBird.r*0.7,renderBird.y+4); ctx.closePath(); ctx.fill();
        if (renderBird.type==='black') { ctx.fillStyle='#f97316'; ctx.fillRect(renderBird.x-2,renderBird.y-renderBird.r-6,4,8); }
      }

      // blue bird splits
      for (const sp of s.birds[0]?.splits||[]) {
        ctx.fillStyle=BIRD_COLOR.blue; ctx.beginPath(); ctx.arc(sp.x,sp.y,9,0,Math.PI*2); ctx.fill();
        sp.vx*=0.999; sp.vy+=GRAVITY; sp.x+=sp.vx; sp.y+=sp.vy;
      }

      // particles
      for (const p of s.particles) {
        ctx.globalAlpha=p.life/p.maxLife;
        ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(p.life/p.maxLife),0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;

      // HUD bar
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,800,38);
      ctx.fillStyle='#fcd34d'; ctx.font='bold 18px Inter,sans-serif'; ctx.textAlign='left'; ctx.fillText(`Score: ${s.score}`,14,26);
      ctx.fillStyle='#fff'; ctx.font='14px Inter,sans-serif'; ctx.fillText(`Lvl ${s.level%LEVELS.length+1}`,200,26);
      const alive=s.pigs.filter(p=>!p.dead).length;
      ctx.fillStyle='#4ade80'; ctx.fillText(`Pigs: ${alive}/${s.pigs.length}`,280,26);
      ctx.fillStyle='#a78bfa'; ctx.fillText(`Best: ${s.bestScore}`,380,26);
      ctx.fillStyle='#fb923c'; ctx.fillText(`Ep: ${s.episodes}`,480,26);
      ctx.fillStyle='#e2e8f0'; ctx.textAlign='right'; ctx.fillText(s.phase.toUpperCase(),788,26);
      ctx.textAlign='left';

      // win/lose overlay
      if (s.phase==='win'||s.phase==='lose') {
        ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,800,600);
        ctx.font='bold 52px Inter,sans-serif'; ctx.textAlign='center';
        ctx.fillStyle=s.phase==='win'?'#fcd34d':'#f87171';
        ctx.fillText(s.phase==='win'?'LEVEL CLEAR!':'TRY AGAIN',400,270);
        ctx.font='22px Inter,sans-serif'; ctx.fillStyle='#e2e8f0';
        ctx.fillText(`Score: ${s.score}  |  Best: ${s.bestScore}`,400,320);
        ctx.font='14px Inter,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.fillText('Next level loading...',400,360);
        ctx.textAlign='left';
      }

      ctx.restore();

      setUi({ score:s.score, level:s.level%LEVELS.length+1, birds:s.queue.length-s.birdIdx, pigs:s.pigs.filter(p=>!p.dead).length, episode:s.episodes, phase:s.phase, bestScore:s.bestScore });
      animRef.current=requestAnimationFrame(tick);
    };

    animRef.current=requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousedown',onDown);
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };
  }, [loadLevel, launch, onScoreUpdate]);

  return (
    <div className={`game-container ${className}`}>
      <canvas ref={ref} className="w-full aspect-[4/3] block cursor-crosshair" />
      <div className="absolute bottom-2 left-2 flex gap-2 pointer-events-none">
        <span className="badge-orange text-[10px]">🎮 Drag bird to aim • Release to launch</span>
        {(ui.phase==='win'||ui.phase==='lose') && <span className="badge-blue text-[10px] animate-pulse">Loading next...</span>}
      </div>
    </div>
  );
}
