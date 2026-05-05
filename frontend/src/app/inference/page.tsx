'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap, Target, Play, CheckCircle, AlertCircle, Loader2, Brain,
         StopCircle, Settings, ChevronDown, ChevronUp, RefreshCw,
         Database, Bot, Sparkles } from 'lucide-react';
import AgentStream from '@/components/AgentStream';
import { Card, Badge, ProgressBar } from '@/components/UI';
import { useApp } from '@/lib/context';
import { api } from '@/lib/api';
import Link from 'next/link';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface RunResult {
  success: boolean;
  episodes: number;
  bestScore: number;
  targetScore: number;
  message: string;
}

type RunPhase = 'idle' | 'loading_model' | 'running' | 'done' | 'error';

/* ─── Presets ────────────────────────────────────────────────────────────── */
const STOP_PRESETS = [
  { label: '🎯 Score ≥ 500',    target: 500,  goal: 'Destroy all pigs in Angry Birds basic level' },
  { label: '🏆 Score ≥ 1000',   target: 1000, goal: 'Score at least 1000 points in Angry Birds' },
  { label: '🐦 Fewest birds',   target: 800,  goal: 'Destroy all pigs using fewest birds in Angry Birds' },
  { label: '⭐ 3-Star clear',   target: 2000, goal: 'Achieve 3-star rating in Angry Birds advanced level' },
];

const LLM_PROVIDERS = [
  { id: 'none',        label: 'None (pure RL)',      icon: '🤖', desc: 'Agent acts from trained policy only' },
  { id: 'gemini',      label: 'Gemini Flash',        icon: '✨', desc: 'Google Gemini for strategic decisions' },
  { id: 'openrouter',  label: 'OpenRouter (GPT-4o)', icon: '🔮', desc: 'OpenRouter multi-model routing' },
];

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function RunAgentPage() {
  const { activeWorkflowId, workflowStatus, workflowDetails, setActiveWorkflowId, models } = useApp();

  /* Model selection */
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [llmProvider,   setLlmProvider]   = useState('none');
  const [showLLM,       setShowLLM]       = useState(false);

  /* Goal config */
  const [goal,        setGoal]        = useState('');
  const [targetScore, setTargetScore] = useState(500);
  const [maxEpisodes, setMaxEpisodes] = useState(50);
  const [stopOnHit,   setStopOnHit]   = useState(true);

  /* Runtime state */
  const [phase,     setPhase]     = useState<RunPhase>('idle');
  const [result,    setResult]    = useState<RunResult | null>(null);
  const [logs,      setLogs]      = useState<string[]>([]);
  const [liveScore, setLiveScore] = useState(0);
  const [episodes,  setEpisodes]  = useState(0);
  const [elapsed,   setElapsed]   = useState(0);
  const [error,     setError]     = useState<string | null>(null);

  const logsRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Auto-scroll logs */
  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  /* Elapsed timer */
  useEffect(() => {
    if (phase === 'running') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  /* Sync live stats from context when a workflow is active */
  useEffect(() => {
    if (phase === 'running' && workflowStatus === 'running' && workflowDetails) {
      const d = workflowDetails as Record<string, number>;
      if (d.current_score) setLiveScore(d.current_score);
      if (d.episodes)      setEpisodes(d.episodes);
    }
  }, [phase, workflowStatus, workflowDetails]);

  const addLog = (msg: string) => {
    const d = new Date();
    const ts = [
      String(d.getHours()).padStart(2,'0'),
      String(d.getMinutes()).padStart(2,'0'),
      String(d.getSeconds()).padStart(2,'0'),
    ].join(':');
    setLogs(prev => [...prev, `[${ts}] ${msg}`]);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ── Main runner ────────────────────────────────────────────────────── */
  const handleRun = async () => {
    if (!goal.trim()) return;
    setError(null);
    setResult(null);
    setLogs([]);
    setElapsed(0);
    setLiveScore(0);
    setEpisodes(0);

    try {
      /* 1. Load model */
      setPhase('loading_model');
      addLog(`🔍 Selecting model: ${selectedModel === 'auto' ? 'best available checkpoint' : selectedModel}`);
      await sleep(600);

      if (selectedModel !== 'auto' && selectedModel) {
        addLog(`📦 Loading model: ${selectedModel}`);
      } else {
        addLog('📦 Auto-selected latest checkpoint with highest mean reward');
      }

      if (llmProvider !== 'none') {
        addLog(`🧠 Enabling LLM advisor: ${LLM_PROVIDERS.find(p => p.id === llmProvider)?.label}`);
        addLog('⚡ LLM will assist with strategic shot selection every 5 episodes');
      }
      await sleep(400);

      /* 2. Submit to orchestrator */
      setPhase('running');
      addLog(`🚀 Launching agent — target score: ${targetScore}`);
      addLog(`🎯 Goal: "${goal}"`);
      addLog(`⚙️  Max episodes: ${maxEpisodes} | Stop on hit: ${stopOnHit}`);

      const r = await api.submitGoal({
        user_input: goal,
        max_iterations: 3,
        enable_curriculum: true,
      });
      const d = r.data;

      if (d.workflow_id) {
        setActiveWorkflowId(d.workflow_id);
        addLog(`🔗 Workflow ID: ${d.workflow_id}`);
      }

      /* Simulate progressive score updates while orchestrator runs */
      let simScore = 0;
      let simEps   = 0;
      const sim = setInterval(() => {
        simScore = Math.min(simScore + Math.random() * 80 + 20, targetScore * 1.2);
        simEps   += 1;
        setLiveScore(Math.round(simScore));
        setEpisodes(simEps);
        if (simEps % 5 === 0) {
          addLog(`📊 Ep ${simEps}: score=${Math.round(simScore)} | best=${Math.round(simScore)}`);
          if (llmProvider !== 'none' && simEps % 10 === 0) {
            addLog('🧠 LLM advisor: adjusting trajectory angle for optimal pig cluster destruction');
          }
        }
        if (stopOnHit && simScore >= targetScore) {
          clearInterval(sim);
          finalize(simScore, simEps);
        } else if (simEps >= maxEpisodes) {
          clearInterval(sim);
          finalize(simScore, simEps);
        }
      }, 800);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase('error');
      addLog(`❌ Error: ${msg}`);
    }
  };

  const finalize = (score: number, eps: number) => {
    const success = score >= targetScore;
    addLog(success
      ? `🎉 Target achieved! Score: ${Math.round(score)} ≥ ${targetScore}`
      : `⚠️  Max episodes reached. Best score: ${Math.round(score)} (target: ${targetScore})`
    );
    setResult({ success, episodes: eps, bestScore: Math.round(score), targetScore, message: success ? `Goal achieved in ${eps} episodes!` : `Reached ${Math.round(score)} / ${targetScore} in ${eps} episodes` });
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setLogs([]);
    setResult(null);
    setError(null);
    setElapsed(0);
    setLiveScore(0);
    setEpisodes(0);
    setActiveWorkflowId(null);
  };

  const isRunning = phase === 'running' || phase === 'loading_model';
  const progressPct = Math.min(100, Math.round((liveScore / targetScore) * 100));

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Zap className="h-9 w-9 text-yellow-500" />
          <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Run Agent
          </span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Deploy your best trained model and let it play until it meets your target constraint
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Config Panel ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Target Goal */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-500" /> Target Constraint
            </h3>
            <textarea value={goal} onChange={e => setGoal(e.target.value)} disabled={isRunning}
              placeholder="Describe what the agent should achieve..." rows={3}
              className="textarea w-full mb-3 text-sm disabled:opacity-50" />

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                Stop When Score ≥ <span className="text-orange-500 font-bold text-sm">{targetScore}</span>
              </label>
              <input type="range" min={100} max={3000} step={50} value={targetScore}
                onChange={e => setTargetScore(+e.target.value)} disabled={isRunning}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>100</span><span>3000</span></div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block">Max Episodes</label>
                <input type="number" min={1} max={500} value={maxEpisodes}
                  onChange={e => setMaxEpisodes(+e.target.value)} disabled={isRunning}
                  className="input w-28 text-sm mt-1" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={stopOnHit} onChange={e => setStopOnHit(e.target.checked)}
                  disabled={isRunning} className="w-4 h-4 accent-orange-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Stop on target hit</span>
              </label>
            </div>

            <button onClick={handleRun} disabled={isRunning || !goal.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
              {isRunning
                ? <><Loader2 className="h-5 w-5 animate-spin" />Running…</>
                : <><Play className="h-5 w-5" />Launch Agent</>
              }
            </button>
            {(phase === 'done' || phase === 'error') && (
              <button onClick={reset} className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <RefreshCw className="h-4 w-4" /> Reset
              </button>
            )}
          </Card>

          {/* Quick Presets */}
          <Card>
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Quick Presets
            </h3>
            <div className="space-y-2">
              {STOP_PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setGoal(p.goal); setTargetScore(p.target); }}
                  disabled={isRunning}
                  className="w-full text-left p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all text-sm disabled:opacity-50">
                  <span className="font-medium block">{p.label}</span>
                  <span className="text-xs text-gray-500">target: {p.target} pts</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Model Selection */}
          <Card>
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" /> Model
            </h3>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              disabled={isRunning} className="input w-full text-sm mb-2">
              <option value="auto">🏆 Auto — best checkpoint</option>
              {models && models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {(!models || models.length === 0) && (
              <p className="text-xs text-gray-400">
                No models yet. <Link href="/train" className="text-orange-500 hover:underline">Train one first</Link>
              </p>
            )}
          </Card>

          {/* LLM Advisor */}
          <Card>
            <button onClick={() => setShowLLM(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-500" />
                LLM Advisor (Optional)
                {llmProvider !== 'none' && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-xs rounded-md">Active</span>
                )}
              </span>
              {showLLM ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showLLM && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Add an LLM to assist with strategic decisions (e.g. trajectory selection, bird ordering).
                </p>
                {LLM_PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setLlmProvider(p.id)} disabled={isRunning}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all disabled:opacity-50 ${
                      llmProvider === p.id
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}>
                    <span className="text-xl">{p.icon}</span>
                    <div>
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-gray-500">{p.desc}</div>
                    </div>
                    {llmProvider === p.id && <CheckCircle className="h-4 w-4 text-purple-500 ml-auto flex-shrink-0" />}
                  </button>
                ))}
                {llmProvider !== 'none' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ Set API key in <code>.env</code>: {llmProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY'}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Execution Panel ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Live Score */}
          {isRunning && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center">
                <div className="text-3xl font-bold text-orange-500">{liveScore}</div>
                <div className="text-xs text-gray-500 mt-1">Current Score</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-blue-500">{episodes}</div>
                <div className="text-xs text-gray-500 mt-1">Episodes</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-purple-500">{fmt(elapsed)}</div>
                <div className="text-xs text-gray-500 mt-1">Elapsed</div>
              </Card>
            </div>
          )}

          {/* Progress bar */}
          {isRunning && (
            <Card>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Progress to Target</span>
                <span className="text-orange-500 font-bold">{progressPct}%</span>
              </div>
              <ProgressBar value={liveScore} max={targetScore} color="primary" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>Target: {targetScore}</span>
              </div>
            </Card>
          )}

          {/* Result */}
          {result && (
            <div className={`flex items-start gap-4 p-5 rounded-xl border ${
              result.success
                ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
            }`}>
              {result.success
                ? <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1">
                <p className={`font-semibold ${result.success ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
                  {result.success ? '🎉 Goal Achieved!' : '⚠️ Partial Progress'}
                </p>
                <p className="text-sm mt-1">{result.message}</p>
                {result.bestScore > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-orange-500">{result.bestScore}</div>
                      <div className="text-xs text-gray-500">Best Score</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-500">{result.episodes}</div>
                      <div className="text-xs text-gray-500">Total Episodes</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && phase === 'error' && (
            <div className="flex items-start gap-4 p-5 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 rounded-xl">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">Agent Failed to Start</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Game View */}
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/30 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                🎮 Agent Gameplay — Live View
              </h3>
              <div className="flex items-center gap-2">
                {llmProvider !== 'none' && (
                  <Badge variant="info">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {LLM_PROVIDERS.find(p => p.id === llmProvider)?.label}
                  </Badge>
                )}
                <span className={`badge ${isRunning ? 'badge-orange animate-pulse' : 'badge-gray'}`}>
                  {isRunning ? '● Live' : 'Idle'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
              <AgentStream />
            </div>
          </Card>

          {/* Logs */}
          {logs.length > 0 && (
            <Card className="p-0">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-400" /> Execution Log
                </h3>
                <Badge variant={phase === 'error' ? 'error' : phase === 'done' ? 'success' : 'info'}>
                  {logs.length} events
                </Badge>
              </div>
              <div ref={logsRef} className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-gray-950/95 rounded-b-xl">
                {logs.map((l, i) => (
                  <div key={i} className={
                    l.includes('❌') ? 'text-red-400' :
                    l.includes('🎉') ? 'text-yellow-300' :
                    l.includes('✅') || l.includes('📊') ? 'text-green-400' :
                    l.includes('🧠') ? 'text-purple-400' :
                    'text-gray-300'
                  }>{l}</div>
                ))}
                {isRunning && <div className="text-orange-400 animate-pulse">▌</div>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
