'use client';

import { useApp } from '@/lib/context';
import { StatCard, Card, Badge, ProgressBar } from '@/components/UI';
import AgentStream from '@/components/AgentStream';
import PipelineVisualizer from '@/components/PipelineVisualizer';
import {
  TrendingUp,
  Target,
  Zap,
  CheckCircle,
  AlertCircle,
  Activity,
  Brain,
  Gamepad2,
  Database,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';

const PIPELINE_STAGES = [
  { id: 'collect',  label: 'Data Collect',  icon: '🎮' },
  { id: 'filter',   label: 'Filter',        icon: '🔍' },
  { id: 'train',    label: 'Train',         icon: '🧠' },
  { id: 'evaluate', label: 'Evaluate',      icon: '📊' },
  { id: 'infer',    label: 'Inference',     icon: '🚀' },
];

export default function AgentDashboard() {
  const { workflowDetails, activeWorkflowId, workflowStatus, isConnected, recentPlans, models } = useApp();

  const stats = {
    totalRuns:    recentPlans?.length || 0,
    activeAgents: activeWorkflowId ? 1 : 0,
    totalModels:  models?.length || 0,
    successRate:  recentPlans?.filter(p => p.success).length / Math.max(recentPlans?.length || 1, 1) * 100 || 0,
  };

  type StageStatus = 'pending' | 'active' | 'done' | 'error';

  const getPipelineStages = () => {
    if (!activeWorkflowId) return undefined;

    const stages: Array<{ id: string; label: string; icon: string; status: StageStatus }> =
      PIPELINE_STAGES.map(s => ({ ...s, status: 'pending' as StageStatus }));

    if (workflowStatus === 'running') {
      stages[0].status = 'done';
      stages[1].status = 'done';
      stages[2].status = 'active';
    } else if (workflowStatus === 'completed') {
      stages.forEach(s => { s.status = 'done'; });
    } else if (workflowStatus === 'failed') {
      stages[0].status = 'done';
      stages[1].status = 'done';
      stages[2].status = 'error';
    }

    return stages;
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNCIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Auga RLAI</h1>
            <p className="text-white/80 text-lg max-w-xl">
              Autonomous AI Engineer — Automatically trains and deploys RL agents from data collection to inference
            </p>
            <div className="flex items-center mt-5 space-x-3 flex-wrap gap-y-2">
              <Link href="/train">
                <button className="px-6 py-2.5 bg-white text-orange-600 rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center space-x-2">
                  <Brain className="h-5 w-5" />
                  <span>Training Pipeline</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link href="/inference">
                <button className="px-6 py-2.5 bg-white/20 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/30 transition-all duration-200 backdrop-blur-sm flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Run Agent</span>
                </button>
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl backdrop-blur-sm ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm text-white font-medium">
                {isConnected ? 'Backend Online' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Flow Banner */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 rounded-2xl p-5 shadow-xl border border-white/5">
        <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-3">Automated Pipeline</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: '🎮', label: 'Launch Game' },
            { icon: '🔄', label: 'Auto-Play' },
            { icon: '🔍', label: 'Filter Data' },
            { icon: '🧠', label: 'Train Model' },
            { icon: '📊', label: 'Evaluate' },
            { icon: '🚀', label: 'Deploy' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span>{step.icon}</span>
                <span className="text-xs text-gray-300 font-medium">{step.label}</span>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-gray-600 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Pipeline */}
      {activeWorkflowId && (
        <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/20 dark:to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                <Activity className="h-5 w-5 mr-2 text-orange-500" />
                Active Pipeline
              </h2>
              <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">{activeWorkflowId}</p>
            </div>
            <Badge variant={
              workflowStatus === 'running'   ? 'info' :
              workflowStatus === 'completed' ? 'success' :
              workflowStatus === 'failed'    ? 'error' : 'default'
            }>
              {workflowStatus === 'running'   && <span className="flex items-center"><span className="h-2 w-2 bg-current rounded-full mr-2 animate-pulse" />Running</span>}
              {workflowStatus === 'completed' && '✓ Complete'}
              {workflowStatus === 'failed'    && '✗ Failed'}
              {workflowStatus === 'not_found' && 'Not Found'}
            </Badge>
          </div>
          <PipelineVisualizer stages={getPipelineStages()} />
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Training Runs"  value={stats.totalRuns.toString()}    icon={<Brain    className="h-6 w-6 text-orange-500" />} />
        <StatCard title="Saved Models"   value={stats.totalModels.toString()}   icon={<Database className="h-6 w-6 text-blue-500"   />} />
        <StatCard title="Success Rate"   value={`${stats.successRate.toFixed(0)}%`} change={5.2} trend="up" icon={<CheckCircle className="h-6 w-6 text-green-500"  />} />
        <StatCard title="Active Agents"  value={stats.activeAgents.toString()}  icon={<Gamepad2 className="h-6 w-6 text-purple-500" />} />
      </div>

      {/* Main Grid: Game Preview + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Game Simulation Preview */}
        <div className="lg:col-span-3">
          <Card className="p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <Gamepad2 className="h-5 w-5 mr-2 text-red-500" />
                Angry Birds — Agent Gameplay
              </h3>
              <Badge variant="info">Live View</Badge>
            </div>
            <div className="px-4 pb-4">
              <AgentStream />
            </div>
          </Card>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-orange-500" />
              System Stats
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Training Runs</span>
                  <span className="font-mono font-medium">{stats.totalRuns}</span>
                </div>
                <ProgressBar value={stats.totalRuns} max={100} color="primary" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
                  <span className="font-mono font-medium">{stats.successRate.toFixed(0)}%</span>
                </div>
                <ProgressBar value={stats.successRate} max={100} color="success" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Models Saved</span>
                  <span className="font-mono font-medium">{stats.totalModels}</span>
                </div>
                <ProgressBar value={stats.totalModels} max={20} color="secondary" />
              </div>
            </div>
          </Card>

          {/* Recent Training Runs */}
          <Card>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-500" />
              Recent Runs
            </h3>
            <div className="space-y-2">
              {recentPlans && recentPlans.length > 0 ? (
                recentPlans.slice(0, 4).map((plan, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${plan.success ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <span className="text-sm truncate">{plan.user_input || plan.environment}</span>
                    </div>
                    <Badge variant={plan.success ? 'success' : 'default'} className="ml-2 flex-shrink-0">
                      {plan.algorithm}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No training runs yet</p>
                  <Link href="/train" className="text-sm text-orange-500 hover:underline mt-1 inline-block">
                    Start training →
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Status Alerts */}
          {workflowStatus === 'running' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-200 text-sm">Pipeline Running</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Check <Link href="/monitor" className="underline">Live Monitor</Link> for real-time progress
                  </p>
                </div>
              </div>
            </div>
          )}
          {workflowStatus === 'completed' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-200 text-sm">Training Complete!</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    View results in <Link href="/models" className="underline">Model Registry</Link> or{' '}
                    <Link href="/inference" className="underline">Run Agent</Link>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/train" className="block group">
          <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 hover:shadow-xl hover:border-orange-300 transition-all duration-300 cursor-pointer">
            <Brain className="h-10 w-10 mb-3 text-orange-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-lg mb-1">Training Pipeline</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure environment, algorithm, and launch full automated training
            </p>
          </div>
        </Link>
        <Link href="/inference" className="block group">
          <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 hover:shadow-xl hover:border-yellow-300 transition-all duration-300 cursor-pointer">
            <PlayCircle className="h-10 w-10 mb-3 text-yellow-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-lg mb-1">Run Agent</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Deploy best model and let it play until it meets your target
            </p>
          </div>
        </Link>
        <Link href="/monitor" className="block group">
          <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-xl hover:border-green-300 transition-all duration-300 cursor-pointer">
            <Activity className="h-10 w-10 mb-3 text-green-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-lg mb-1">Live Monitor</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Watch real-time training metrics, rewards, and pipeline progress
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
