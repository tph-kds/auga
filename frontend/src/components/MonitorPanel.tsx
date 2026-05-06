'use client';

import React from 'react';
import { Activity, Play, AlertCircle } from 'lucide-react';
import { ProgressBar } from './UI';
import { useApp } from '@/lib/context';



export default function MonitorPanel() {
  const { activeWorkflowId, workflowStatus, workflowDetails } = useApp();

  const controller = (workflowDetails as any)?.controller;
  const pipeline = (workflowDetails as any)?.pipeline;
  const resources = (workflowDetails as any)?.resources;
  const alerts: Array<{ severity: string; title: string; message: string }> = pipeline?.alerts ?? [];


  // Low-VRAM UX adaptation (visual only for now; backend resource controller already exists)
  const vramPercent = Number(controller?.vram_percent ?? 0);
  const ramPercent = Number(controller?.ram_percent ?? 0);
  const cpuPercent = Number(controller?.cpu_percent ?? 0);

  const isLowVram = vramPercent > 85;
  const isHighRam = ramPercent > 85;

  const stageFromController = (() => {
    if (!activeWorkflowId) return 'idle';
    if (workflowStatus === 'completed') return 'done';
    if (workflowStatus === 'failed') return 'error';
    return 'active';
  })();

  const progress = (() => {
    // Controller progress is currently episode-based; map to a rough 0-100 for UI
    const total = controller?.total_episodes_played;
    if (typeof total !== 'number') return 0;
    return Math.max(0, Math.min(100, Math.round((total / 50) * 100)));
  })();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-lg border">
      <div className="p-4 border-b font-semibold flex items-center justify-between">
        <div className="flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Live Monitor
        </div>
        {activeWorkflowId && (
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
            {workflowStatus}
          </span>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Pipeline stage / mission control card */}
        <div className="p-4 bg-gradient-to-br from-orange-50/70 to-transparent dark:from-orange-950/20 rounded-lg border border-orange-200/60 dark:border-orange-900/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                {stageFromController === 'idle' && 'Waiting for pipeline…'}
                {stageFromController === 'active' && 'Autonomous runtime in progress'}
                {stageFromController === 'done' && 'Pipeline completed'}
                {stageFromController === 'error' && 'Pipeline failed'}
              </p>
              <p className="text-xs text-orange-800/80 dark:text-orange-200/80 mt-1">
                Best: {controller?.best_score ?? '—'} • Mean: {controller?.mean_recent_score ?? '—'} • Retries: {controller?.retry_count ?? '—'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 dark:text-gray-400">Progress</div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{progress}%</div>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} />
          </div>

          {/* Low-VRAM adaptive UX */}
          {(isLowVram || isHighRam) && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Adaptive suggestions enabled
                </p>
              </div>
              <ul className="mt-2 text-[11px] text-amber-900/80 dark:text-amber-200/80 space-y-1">
                {isLowVram && <li>• VRAM pressure detected → UI will reduce chart density & show lightweight-mode hint.</li>}
                {isHighRam && <li>• RAM pressure detected → prefer smaller buffers / fewer parallel panels.</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Resource observability */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-800/30">
            <div className="text-[11px] text-gray-500 dark:text-gray-400">GPU VRAM</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">{vramPercent ? `${vramPercent.toFixed(1)}%` : '—'}</div>
          </div>
          <div className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-800/30">
            <div className="text-[11px] text-gray-500 dark:text-gray-400">CPU</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">{cpuPercent ? `${cpuPercent.toFixed(1)}%` : '—'}</div>
          </div>
          <div className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-800/30">
            <div className="text-[11px] text-gray-500 dark:text-gray-400">RAM</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">{ramPercent ? `${ramPercent.toFixed(1)}%` : '—'}</div>
          </div>
        </div>

        {/* Live play snapshot (if runtime/controller has it) */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/10 dark:to-transparent rounded-lg border border-green-200/70 dark:border-green-900/40">
          <div className="flex items-center">
            <Play className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-200">
                Episodes played: {controller?.total_episodes_played ?? '—'}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                State: {controller?.state ?? '—'} • Success rate: {controller?.success_rate != null ? `${(controller.success_rate * 100).toFixed(0)}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Low density log hint - keeps UX responsive */}
        <div className="p-3 rounded-xl border border-gray-200/70 dark:border-gray-800/50 bg-white dark:bg-gray-800/20">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Log stream</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Backend currently streams generic status. After we enrich workflow status with step-level logs and alerts,
            this panel will become fully real-time.
          </p>
        </div>
      </div>
    </div>
  );
}


