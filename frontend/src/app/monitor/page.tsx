'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { api } from '@/lib/api';
import { Card, Badge, ProgressBar } from '@/components/UI';
import AgentStream from '@/components/AgentStream';
import PipelineVisualizer from '@/components/PipelineVisualizer';
import {
  Activity,
  TrendingUp,
  Timer,
  Target,
  Zap,
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface MetricPoint {
  step: number;
  value: number;
  timestamp: number;
}

export default function MonitorPage() {
  const { activeWorkflowId, workflowStatus, workflowDetails, isConnected } = useApp();

  const [rewardHistory, setRewardHistory] = useState<MetricPoint[]>([]);
  const [scoreHistory, setScoreHistory] = useState<MetricPoint[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const controllerData = workflowDetails?.controller;
  const trainerData = workflowDetails?.trainer;

  // SSE connection
  useEffect(() => {
    if (!activeWorkflowId) return;

    const es = api.followWorkflow(activeWorkflowId, (data) => {
      setSseConnected(true);
      setLastUpdate(new Date());

      if (data.details?.controller) {
        const ctrl = data.details.controller;
        setRewardHistory(prev => [
          ...prev.slice(-99),
          { step: ctrl.total_episodes_played, value: ctrl.mean_recent_score, timestamp: Date.now() },
        ]);
        setScoreHistory(prev => [
          ...prev.slice(-99),
          { step: ctrl.total_episodes_played, value: ctrl.best_score, timestamp: Date.now() },
        ]);
      }
    });

    eventSourceRef.current = es;

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [activeWorkflowId]);

  // Draw mini chart
  const drawChart = useCallback((
    canvas: HTMLCanvasElement,
    data: MetricPoint[],
    color: string,
    label: string,
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || data.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 24, right: 12, bottom: 20, left: 40 };

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    const values = data.map(d => d.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (h - padding.top - padding.bottom) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y labels
      const val = maxV - (range * i / 4);
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(0), padding.left - 4, y + 3);
    }

    // Title
    ctx.fillStyle = 'rgba(128,128,128,0.7)';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, padding.left, 14);

    // Line
    const xStep = (w - padding.left - padding.right) / (data.length - 1);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    data.forEach((point, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + (h - padding.top - padding.bottom) * (1 - (point.value - minV) / range);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Area fill
    const lastX = padding.left + (data.length - 1) * xStep;
    ctx.lineTo(lastX, h - padding.bottom);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad;
    ctx.fill();

    // Latest value dot
    if (data.length > 0) {
      const last = data[data.length - 1];
      const x = padding.left + (data.length - 1) * xStep;
      const y = padding.top + (h - padding.top - padding.bottom) * (1 - (last.value - minV) / range);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Value label
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(last.value.toFixed(1), w - padding.right, 14);
    }
  }, []);

  // Redraw charts when data changes
  useEffect(() => {
    if (!chartCanvasRef.current) return;

    // We'll use a parent ref approach — draw reward chart
    const canvas = chartCanvasRef.current;
    drawChart(canvas, rewardHistory, '#F97316', 'Mean Reward');
  }, [rewardHistory, drawChart]);

  // Only show real data, demo data generator removed to enforce accurate system monitoring.

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            Training Monitor
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Real-time training metrics and game visualization
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-sm font-medium ${
            sseConnected || !activeWorkflowId
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {sseConnected || !activeWorkflowId ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span>{activeWorkflowId ? (sseConnected ? 'Live' : 'Connecting...') : 'Demo Mode'}</span>
          </div>
          {lastUpdate && (
            <span className="text-xs text-gray-400" suppressHydrationWarning>
              Updated {[
                String(lastUpdate.getHours()).padStart(2,'0'),
                String(lastUpdate.getMinutes()).padStart(2,'0'),
                String(lastUpdate.getSeconds()).padStart(2,'0'),
              ].join(':')}
            </span>
          )}
        </div>
      </div>

      {/* Pipeline Status */}
      {activeWorkflowId && (
        <Card>
          <PipelineVisualizer />
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <Activity className="h-6 w-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{controllerData?.total_episodes_played || rewardHistory.length}</p>
          <p className="text-xs text-gray-500">Episodes</p>
        </Card>
        <Card className="text-center">
          <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{controllerData?.mean_recent_score?.toFixed(1) || (rewardHistory.length > 0 ? rewardHistory[rewardHistory.length - 1].value.toFixed(1) : '0')}</p>
          <p className="text-xs text-gray-500">Mean Reward</p>
        </Card>
        <Card className="text-center">
          <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{controllerData?.best_score?.toFixed(0) || (scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1].value.toFixed(0) : '0')}</p>
          <p className="text-xs text-gray-500">Best Score</p>
        </Card>
        <Card className="text-center">
          <Target className="h-6 w-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{((controllerData?.success_rate || 0) * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500">Success Rate</p>
        </Card>
      </div>

      {/* Charts + Game */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reward Chart */}
        <Card>
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-orange-500" />
            Reward History
          </h3>
          <div className="h-[250px] relative">
            <canvas
              ref={chartCanvasRef}
              className="w-full h-full"
            />
            {rewardHistory.length < 2 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                Waiting for data...
              </div>
            )}
          </div>
        </Card>

        {/* Game Visualization */}
        <Card className="p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <Target className="h-5 w-5 mr-2 text-red-500" />
              Game Simulation
            </h3>
            <Badge variant={activeWorkflowId ? 'info' : 'default'}>
              {activeWorkflowId ? 'Live' : 'Demo'}
            </Badge>
          </div>
          <div className="px-4 pb-4">
            <AgentStream />
          </div>
        </Card>
      </div>

      {/* Detailed Stats */}
      {controllerData && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Timer className="h-5 w-5 mr-2 text-purple-500" />
            Training Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Consecutive Successes</span>
                <span className="font-mono font-medium">{controllerData.consecutive_successes}/10</span>
              </div>
              <ProgressBar value={controllerData.consecutive_successes} max={10} color="success" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Success Rate</span>
                <span className="font-mono font-medium">{(controllerData.success_rate * 100).toFixed(1)}%</span>
              </div>
              <ProgressBar value={controllerData.success_rate * 100} max={100} color="primary" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Retries</span>
                <span className="font-mono font-medium">{controllerData.retry_count}/3</span>
              </div>
              <ProgressBar value={controllerData.retry_count} max={3} color="warning" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
