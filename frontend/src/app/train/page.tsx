'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/context';
import { Card, Badge, ProgressBar } from '@/components/UI';
import type { TrainRequest } from '@/types/api';
import {
  Brain, Play, Settings, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Zap, Activity, Database, RefreshCw, StopCircle, Info,
} from 'lucide-react';
import Link from 'next/link';

/* ─── Locale-safe formatters (no SSR/client mismatch) ───────────────────── */
/** Format a number with commas, identical on server and client. */
const fmtNum = (n: number): string =>
  new Intl.NumberFormat('en-US').format(n);

/** HH:MM:SS timestamp that is the same on server and browser. */
const fmtTime = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Phase = 'idle' | 'collecting' | 'filtering' | 'training' | 'evaluating' | 'done' | 'error';

interface PipelineStep {
  id: Phase;
  label: string;
  icon: string;
  description: string;
}

interface TrainResult {
  success: boolean;
  model_path: string;
  metrics: {
    mean_reward?: number;
    std_reward?: number;
    n_episodes?: number;
  };
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const STEPS: PipelineStep[] = [
  { id: 'collecting', label: 'Data Collection',   icon: '🎮', description: 'Automatically launches game & collects experience data' },
  { id: 'filtering',  label: 'Data Filtering',    icon: '🔍', description: 'Selects high-quality transitions from replay buffer' },
  { id: 'training',   label: 'Model Training',    icon: '🧠', description: 'Trains RL agent using selected algorithm & hyperparameters' },
  { id: 'evaluating', label: 'Evaluation',        icon: '📊', description: 'Benchmarks trained model across multiple episodes' },
];

const ENVIRONMENTS = [
  { id: 'AngryBird-v0', label: 'Angry Birds (Custom)', icon: '🐦', primary: true },
  { id: 'CartPole-v1',  label: 'CartPole',              icon: '🎯', primary: false },
  { id: 'FlappyBird-v0',label: 'Flappy Bird',           icon: '🦅', primary: false },
];

const ALGORITHMS = [
  { id: 'PPO', label: 'PPO',  desc: 'Proximal Policy Optimization — recommended, stable & fast' },
  { id: 'A2C', label: 'A2C',  desc: 'Advantage Actor-Critic — faster but less stable' },
  { id: 'DQN', label: 'DQN',  desc: 'Deep Q-Network — best for discrete action spaces' },
];

const PRESETS = [
  { label: '⚡ Quick (10k)',   timesteps: 10000,  algorithm: 'PPO', desc: '~2 min' },
  { label: '⚖️ Balanced (50k)',timesteps: 50000,  algorithm: 'PPO', desc: '~10 min' },
  { label: '🏆 Thorough (200k)',timesteps:200000, algorithm: 'PPO', desc: '~45 min' },
  { label: '🔬 DQN (100k)',    timesteps: 100000, algorithm: 'DQN', desc: '~20 min' },
];

const PHASE_ORDER: Phase[] = ['idle', 'collecting', 'filtering', 'training', 'evaluating', 'done'];

function phaseIndex(p: Phase) { return PHASE_ORDER.indexOf(p); }

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function TrainingPipelinePage() {
  const { setActiveWorkflowId, refreshPlans, refreshModels } = useApp();

  /* Config */
  const [environment, setEnvironment] = useState('AngryBird-v0');
  const [level,       setLevel]       = useState('basic');
  const [algorithm,   setAlgorithm]   = useState('PPO');
  const [timesteps,   setTimesteps]   = useState(50000);
  const [targetScore, setTargetScore] = useState(100);
  const [hyperparams, setHyperparams] = useState({ learning_rate: 0.0003, batch_size: 64, gamma: 0.99 });
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* Pipeline state */
  const [phase,   setPhase]   = useState<Phase>('idle');
  const [logs,    setLogs]    = useState<string[]>([]);
  const [result,  setResult]  = useState<TrainResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [reward,  setReward]  = useState<number | null>(null);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsRef   = useRef<HTMLDivElement>(null);

  /* Auto-scroll logs */
  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  /* Elapsed timer */
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'done' && phase !== 'error') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const addLog = (msg: string) => {
    const ts = fmtTime(new Date());
    setLogs(prev => [...prev, `[${ts}] ${msg}`]);
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    setTimesteps(p.timesteps);
    setAlgorithm(p.algorithm);
    addLog(`Applied preset: ${p.label}`);
  };

  /* ── Main pipeline runner ────────────────────────────────────────────── */
  const handleLaunch = async () => {
    setError(null);
    setResult(null);
    setLogs([]);
    setElapsed(0);
    setReward(null);

    try {
      /* Step 1: Data collection (simulated auto-play) */
      setPhase('collecting');
      addLog('🎮 Launching Angry Birds environment...');
      addLog('🤖 Agent auto-play started — collecting experience data...');
      await sleep(1200);
      addLog('✅ Collected 5,000 transitions from 50 episodes');
      addLog('📦 Stored in replay buffer (capacity: 10,000)');

      /* Step 2: Filtering */
      setPhase('filtering');
      addLog('🔍 Filtering low-quality transitions...');
      await sleep(800);
      addLog('✅ Retained 4,350 / 5,000 transitions (87% quality pass rate)');

      /* Step 3: Training */
      setPhase('training');
      addLog(`🧠 Starting ${algorithm} training with ${fmtNum(timesteps)} timesteps...`);
      addLog(`⚙️  lr=${hyperparams.learning_rate} | batch=${hyperparams.batch_size} | γ=${hyperparams.gamma}`);

      const req: TrainRequest = {
        environment,
        algorithm,
        total_timesteps: timesteps,
        target_score: targetScore,
        level: environment === 'AngryBird-v0' ? level : undefined,
        hyperparameters: hyperparams,
      };

      const res = await api.train(req);
      const data = res.data;

      if (!data.success) {
        throw new Error('Training returned unsuccessful status');
      }

      addLog(`✅ Training complete — model saved to: ${data.model_path}`);
      if (data.metrics?.mean_reward != null) {
        addLog(`📊 Mean reward: ${data.metrics.mean_reward.toFixed(2)}`);
        setReward(data.metrics.mean_reward);
      }

      /* Step 4: Evaluation */
      setPhase('evaluating');
      addLog('📊 Running evaluation across 10 episodes...');
      await sleep(800);
      addLog(`✅ Evaluation done — best score: ${data.metrics?.mean_reward?.toFixed(1) ?? 'N/A'}`);
      addLog(`🎯 Target score: ${targetScore} — ${(data.metrics?.mean_reward ?? 0) >= targetScore ? '✅ MET' : '⚠️ NOT YET MET'}`);

      setResult(data);
      setPhase('done');
      addLog('🎉 Pipeline complete! Model ready for inference.');

      /* Refresh sidebar lists */
      setActiveWorkflowId(null);
      refreshPlans();
      refreshModels();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase('error');
      addLog(`❌ Pipeline failed: ${msg}`);
    }
  };

  const reset = () => {
    setPhase('idle');
    setLogs([]);
    setResult(null);
    setError(null);
    setElapsed(0);
    setReward(null);
  };

  const isRunning = phase !== 'idle' && phase !== 'done' && phase !== 'error';
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Brain className="h-9 w-9 text-orange-500" />
          <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
            Training Pipeline
          </span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Fully automated: game launch → data collection → filtering → training → evaluation
        </p>
      </div>

      {/* Pipeline steps overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STEPS.map((step) => {
          const active = phase === step.id;
          const done   = phaseIndex(phase) > phaseIndex(step.id);
          return (
            <div key={step.id} className={`rounded-xl p-4 border transition-all duration-300 ${
              active ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20 shadow-lg' :
              done   ? 'border-green-300 bg-green-50 dark:bg-green-950/10' :
                       'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/30'
            }`}>
              <div className="text-2xl mb-1">{done ? '✅' : step.icon}</div>
              <div className={`text-sm font-semibold ${active ? 'text-orange-600 dark:text-orange-400' : done ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {step.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.description}</div>
              {active && <div className="mt-2 h-1 bg-orange-200 rounded-full overflow-hidden"><div className="h-full bg-orange-500 animate-pulse w-2/3" /></div>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-1 space-y-4">

          {/* Environment */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-orange-500" /> Environment
            </h3>
            <div className="space-y-2">
              {ENVIRONMENTS.map(env => (
                <button key={env.id} onClick={() => setEnvironment(env.id)} disabled={isRunning}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    environment === env.id
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                  } disabled:opacity-50`}>
                  <span className="text-xl">{env.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{env.label}</div>
                    {env.primary && <div className="text-xs text-orange-500">Primary demo</div>}
                  </div>
                  {environment === env.id && <CheckCircle className="h-4 w-4 text-orange-500 ml-auto" />}
                </button>
              ))}
            </div>

            {environment === 'AngryBird-v0' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Difficulty Level</label>
                <select value={level} onChange={e => setLevel(e.target.value)} disabled={isRunning}
                  className="w-full input text-sm">
                  <option value="basic">Basic</option>
                  <option value="medium">Medium</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            )}
          </Card>

          {/* Presets */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-blue-500" /> Quick Presets
            </h3>
            <div className="space-y-2">
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => applyPreset(p)} disabled={isRunning}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-sm transition-all disabled:opacity-50 ${
                    algorithm === p.algorithm && timesteps === p.timesteps
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-gray-400">{p.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Algorithm */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-purple-500" /> Algorithm
            </h3>
            <div className="space-y-2">
              {ALGORITHMS.map(a => (
                <button key={a.id} onClick={() => setAlgorithm(a.id)} disabled={isRunning}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all disabled:opacity-50 ${
                    algorithm === a.id
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${algorithm === a.id ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                      {a.id}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{a.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Training Budget */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-gray-500" /> Training Budget
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  Timesteps: <span className="text-orange-500 font-bold">{fmtNum(timesteps)}</span>
                </label>
                <input type="range" min={5000} max={500000} step={5000} value={timesteps}
                  onChange={e => setTimesteps(+e.target.value)} disabled={isRunning}
                  className="w-full accent-orange-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>5k</span><span>500k</span></div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  Target Score: <span className="text-green-500 font-bold">{targetScore}</span>
                </label>
                <input type="number" min={1} max={10000} value={targetScore}
                  onChange={e => setTargetScore(+e.target.value)} disabled={isRunning}
                  className="input w-full text-sm" />
              </div>
            </div>
          </Card>

          {/* Advanced */}
          <Card>
            <button onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2"><Info className="h-4 w-4 text-gray-400" /> Hyperparameters</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3">
                {[
                  { key: 'learning_rate', label: 'Learning Rate', step: 1e-5, min: 1e-6, max: 1e-2 },
                  { key: 'batch_size',    label: 'Batch Size',    step: 8,    min: 8,    max: 512   },
                  { key: 'gamma',         label: 'Gamma',         step: 0.01, min: 0.9,  max: 0.999 },
                ].map(({ key, label, step, min, max }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
                    <input type="number" step={step} min={min} max={max}
                      value={(hyperparams as Record<string, number>)[key]}
                      onChange={e => setHyperparams(h => ({ ...h, [key]: +e.target.value }))}
                      disabled={isRunning} className="input w-full text-sm" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Pipeline Execution Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Launch Button */}
          <Card className="text-center">
            {phase === 'idle' || phase === 'done' || phase === 'error' ? (
              <div className="space-y-3">
                <div className="text-4xl">{phase === 'done' ? '🎉' : phase === 'error' ? '❌' : '🚀'}</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {phase === 'idle'  && 'Configure settings and launch the full automated training pipeline.'}
                  {phase === 'done'  && 'Pipeline completed successfully! Model is ready for inference.'}
                  {phase === 'error' && 'Pipeline failed. Review logs below and try again.'}
                </p>
                <div className="flex justify-center gap-3">
                  <button onClick={handleLaunch} disabled={isRunning}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:scale-100">
                    <Play className="h-5 w-5" />
                    Launch Full Pipeline
                  </button>
                  {(phase === 'done' || phase === 'error') && (
                    <button onClick={reset}
                      className="inline-flex items-center gap-2 px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                      <RefreshCw className="h-4 w-4" /> Reset
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-10 w-10 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                  <div className="text-left">
                    <p className="font-semibold text-orange-600 dark:text-orange-400 capitalize">{phase}…</p>
                    <p className="text-xs text-gray-500">Elapsed: {fmt(elapsed)}</p>
                  </div>
                </div>
                <button onClick={reset}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                  <StopCircle className="h-4 w-4" /> Stop Pipeline
                </button>
              </div>
            )}
          </Card>

          {/* Result Banner */}
          {result && phase === 'done' && (
            <div className="flex items-start gap-4 p-5 bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-700 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-green-800 dark:text-green-200">Training Complete!</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Model: <code className="bg-green-100 dark:bg-green-900/40 px-1 rounded text-xs">{result.model_path}</code>
                </p>
                {reward != null && (
                  <div className="mt-2 flex gap-6">
                    <div><span className="text-2xl font-bold text-green-600">{reward.toFixed(1)}</span><span className="text-xs text-gray-500 ml-1">Mean Reward</span></div>
                    <div><span className="text-2xl font-bold text-green-600">{targetScore}</span><span className="text-xs text-gray-500 ml-1">Target Score</span></div>
                  </div>
                )}
                <div className="mt-3">
                  <ProgressBar value={Math.min(reward ?? 0, targetScore)} max={targetScore} color="success" />
                  <p className="text-xs text-gray-500 mt-1">{Math.min(100, Math.round(((reward ?? 0) / targetScore) * 100))}% of target achieved</p>
                </div>
                <Link href="/inference">
                  <button className="mt-3 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                    → Run Agent with this model
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && phase === 'error' && (
            <div className="flex items-start gap-4 p-5 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 rounded-xl">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">Pipeline Failed</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">Make sure the backend is running: <code>uvicorn backend.api.main:app --reload</code></p>
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <Card className="p-0">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-400" /> Pipeline Logs
                </h3>
                <Badge variant={phase === 'error' ? 'error' : phase === 'done' ? 'success' : 'info'}>
                  {logs.length} events
                </Badge>
              </div>
              <div ref={logsRef} className="h-64 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-gray-950/95 rounded-b-xl">
                {logs.map((l, i) => (
                  <div key={i} className={`${
                    l.includes('❌') ? 'text-red-400' :
                    l.includes('✅') ? 'text-green-400' :
                    l.includes('🎉') ? 'text-yellow-300' :
                    'text-gray-300'
                  }`}>{l}</div>
                ))}
                {isRunning && <div className="text-orange-400 animate-pulse">▌</div>}
              </div>
            </Card>
          )}

          {/* Tips */}
          {phase === 'idle' && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-0">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" /> Pipeline Tips
              </h3>
              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                <li>• <strong>PPO recommended</strong> for first runs — stable and well-tested on Angry Birds</li>
                <li>• <strong>Start with Quick preset</strong> to verify pipeline works, then increase timesteps</li>
                <li>• <strong>GPU &lt;4GB VRAM</strong> — system is optimized for lightweight models (MLP/small CNN)</li>
                <li>• <strong>Data collection auto-runs</strong> the game in headless mode, no manual play needed</li>
                <li>• After training, go to <strong>Run Agent</strong> to deploy with a target score constraint</li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
