'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import AgentStream from '@/components/AgentStream';
import PipelineVisualizer from '@/components/PipelineVisualizer';
import { Activity, Brain, Zap, TrendingUp, Play, RotateCcw, Target } from 'lucide-react';

interface LearningPoint { episode:number; score:number; avgScore:number; pigs:number; label?:string }

export default function SimulationPage() {
  const { activeWorkflowId, workflowDetails } = useApp();
  const [history, setHistory] = useState<LearningPoint[]>([]);
  const chartRef = useRef<HTMLCanvasElement>(null);

  // Sync with real workflow data
  useEffect(() => {
    if (!activeWorkflowId || !workflowDetails?.controller) return;
    const ctrl = workflowDetails.controller as any;
    
    setHistory(prev => {
      const ep = ctrl.total_episodes_played;
      if (!ep || (prev.length > 0 && prev[prev.length - 1].episode === ep)) return prev;
      
      const score = ctrl.mean_recent_score || 0;
      const avgScore = prev.length > 0 
        ? Math.round((prev.reduce((a,b)=>a+b.score,0) + score) / (prev.length + 1)) 
        : score;
        
      return [...prev.slice(-49), { episode: ep, score, avgScore, pigs: 0, label: `Ep ${ep}` }];
    });
  }, [workflowDetails, activeWorkflowId]);

  // Draw learning curve
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width = canvas.offsetWidth * devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    const pad = { t:20, r:20, b:30, l:50 };

    ctx.clearRect(0,0,w,h);

    const scores = history.map(p=>p.score);
    const maxS = Math.max(...scores, 100);
    const xScale = (w-pad.l-pad.r) / (history.length-1);
    const yScale = (h-pad.t-pad.b) / maxS;

    // Grid
    ctx.strokeStyle='rgba(100,100,100,0.15)'; ctx.lineWidth=1;
    for (let i=0;i<=4;i++) {
      const y=pad.t+(h-pad.t-pad.b)*i/4;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
      ctx.fillStyle='rgba(150,150,150,0.6)'; ctx.font=`10px Inter`; ctx.textAlign='right';
      ctx.fillText(Math.round(maxS*(1-i/4)).toString(), pad.l-4, y+3);
    }

    // Area fill
    const grad = ctx.createLinearGradient(0,pad.t,0,h-pad.b);
    grad.addColorStop(0,'rgba(249,115,22,0.3)'); grad.addColorStop(1,'rgba(249,115,22,0.02)');
    ctx.beginPath();
    history.forEach((p,i) => {
      const x=pad.l+i*xScale, y=h-pad.b-p.score*yScale;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.lineTo(pad.l+(history.length-1)*xScale, h-pad.b);
    ctx.lineTo(pad.l, h-pad.b); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();

    // Score line
    ctx.strokeStyle='#f97316'; ctx.lineWidth=2.5; ctx.lineJoin='round';
    ctx.beginPath();
    history.forEach((p,i) => {
      const x=pad.l+i*xScale, y=h-pad.b-p.score*yScale;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();

    // Avg line
    ctx.strokeStyle='rgba(99,102,241,0.7)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
    ctx.beginPath();
    history.forEach((p,i) => {
      const x=pad.l+i*xScale, y=h-pad.b-p.avgScore*yScale;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke(); ctx.setLineDash([]);

    // Latest dot + value
    const last=history[history.length-1];
    const lx=pad.l+(history.length-1)*xScale, ly=h-pad.b-last.score*yScale;
    ctx.fillStyle='#f97316'; ctx.beginPath(); ctx.arc(lx,ly,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='white'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#f97316'; ctx.font='bold 11px Inter'; ctx.textAlign='left';
    ctx.fillText(last.score.toString(), lx+7, ly+4);

    // Milestone labels
    history.forEach((p,i) => {
      if (!p.label) return;
      const x=pad.l+i*xScale, y=h-pad.b-p.score*yScale;
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(x-2,y-22,Math.min(p.label.length*5.5+6,160),16);
      ctx.fillStyle='white'; ctx.font='9px Inter'; ctx.textAlign='left';
      ctx.fillText(p.label, x+3, y-11);
    });

    ctx.textAlign='left';
  }, [history]);

  const latest = history[history.length-1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            Simulation Lab
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">End-to-end RL pipeline — watch the agent learn and adapt in real time</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{setHistory([]);}} className="btn btn-ghost gap-2">
            <RotateCcw className="h-4 w-4"/> Reset Chart
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Target className="h-5 w-5 text-orange-500"/>
          End-to-End Pipeline Status
        </h3>
        <PipelineVisualizer />
      </div>

      {/* Game + Learning curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game */}
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700/30">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-lg">🎮</span> Angry Birds — Agent Vision
            </h3>
            <span className="badge-orange">
              {activeWorkflowId ? 'Agent Playing' : 'Idle'}
            </span>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
            <AgentStream />
          </div>
        </div>

        {/* Learning Curve */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500"/>
            Agent Learning Curve
          </h3>
          <div className="relative h-52 mb-4">
            <canvas ref={chartRef} className="w-full h-full" />
            {history.length < 2 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                Learning data will appear here...
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500 mb-4">
            <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-orange-500 rounded"/>Score</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-indigo-500 rounded opacity-70" style={{borderTop:'1px dashed'}}/>Avg Score</span>
          </div>

          {/* Latest milestone */}
          {latest?.label && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Latest Milestone</p>
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-0.5">🎯 {latest.label}</p>
              <p className="text-xs text-orange-500 mt-1">Episode {latest.episode} · Score {latest.score}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Episodes', value: history.length > 0 ? history[history.length - 1].episode : 0, icon:'🔄', color:'text-orange-500' },
          { label:'Best Score', value: Math.max(...history.map(h=>h.score),0), icon:'⭐', color:'text-yellow-500' },
          { label:'Avg Score', value: latest?.avgScore||0, icon:'📈', color:'text-blue-500' },
          { label:'Improvement', value: history.length>1 ? `${((history[history.length-1].score/Math.max(history[0].score,1)-1)*100).toFixed(0)}%` : '0%', icon:'🚀', color:'text-green-500' },
        ].map(s=>(
          <div key={s.label} className="card card-hover text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Event log */}
      {history.filter(h=>h.label).length>0 && (
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500"/> Agent Learning Events
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-thin">
            {history.filter(h=>h.label).slice().reverse().map((h,i)=>(
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 animate-float-in">
                <span className="text-lg flex-shrink-0">
                  {h.score>1000?'🏆':h.score>500?'⭐':'🔄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.label}</p>
                  <p className="text-xs text-gray-500">Episode {h.episode}</p>
                </div>
                <span className="font-mono text-sm font-bold text-orange-500">{h.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
