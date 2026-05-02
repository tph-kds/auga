'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { Card, Badge, ProgressBar, Button } from '@/components/UI';
import {
  Activity,
  Target,
  TrendingUp,
  Clock,
  Pause,
  Play,
  RotateCcw,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { formatDuration } from '@/lib/utils';

interface ProgressData {
  episode: number;
  total_reward: number;
  score: number;
  timestep: number;
}

export default function MonitorPage() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflow');
  const { setActiveWorkflowId, workflowStatus, workflowDetails, isConnected } = useApp();
  const [progressHistory, setProgressHistory] = useState<ProgressData[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Set active workflow from URL
  useEffect(() => {
    if (workflowId) {
      setActiveWorkflowId(workflowId);
    }
  }, [workflowId, setActiveWorkflowId]);

  // Simulate real-time progress updates (for demo)
  useEffect(() => {
    if (isPaused || !workflowId || workflowStatus !== 'running') return;

    const interval = setInterval(() => {
      setCurrentEpisode((prev) => {
        const next = prev + 1;
        // Simulate progress
        setProgressHistory((hist) => [
          ...hist.slice(-49), // Keep last 50 points
          {
            episode: next,
            total_reward: 100 + Math.sin(next / 10) * 50 + Math.random() * 20,
            score: Math.min(150, 50 + next * 0.5 + Math.random() * 5),
            timestep: next * 100,
          },
        ]);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [workflowId, workflowStatus, isPaused]);

  // Add log entries
  useEffect(() => {
    if (workflowStatus === 'running' && !isPaused) {
      const interval = setInterval(() => {
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Episode ${currentEpisode}: score=${(50 + Math.random()*30).toFixed(1)}`,
          ...prev.slice(0, 19), // Keep last 20 logs
        ]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [workflowStatus, isPaused, currentEpisode]);

  const stats = {
    totalEpisodes: workflowDetails.controller?.total_episodes_played || currentEpisode,
    bestScore: Math.max(workflowDetails.controller?.best_score || 0, ...progressHistory.map(h => h.score)),
    bestScoreReal: workflowDetails.controller?.best_score || 0,
    successRate: (workflowDetails.controller?.success_rate || 0) * 100,
    avgScore: progressHistory.length > 0
      ? progressHistory.reduce((sum, h) => sum + h.score, 0) / progressHistory.length
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            {workflowId && (
              <Link href="/" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
            <h1 className="text-3xl font-bold flex items-center">
              <Activity className="h-8 w-8 mr-3 text-primary-600" />
              Training Monitor
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time training progress and metrics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant={
            workflowStatus === 'running' ? 'info' :
            workflowStatus === 'completed' ? 'success' :
            workflowStatus === 'failed' ? 'error' : 'default'
          } className="capitalize">
            {workflowStatus}
          </Badge>
          {isConnected && (
            <div className="flex items-center text-sm text-green-600">
              <span className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* Workflow ID */}
      {workflowId && (
        <Card>
          <div className="text-sm">
            <span className="font-medium">Workflow ID:</span>{' '}
            <span className="font-mono text-gray-600 dark:text-gray-400">{workflowId}</span>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Episodes</p>
              <p className="text-2xl font-bold">{stats.totalEpisodes.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Score</p>
              <p className="text-2xl font-bold">{stats.bestScore.toFixed(1)}</p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Target className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Score</p>
              <p className="text-2xl font-bold">{stats.avgScore.toFixed(1)}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Chart */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Score Progression</h3>
          {progressHistory.length > 0 ? (
            <div className="h-64 relative">
              {/* Simple SVG chart */}
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={100 - y}
                    x2="100"
                    y2={100 - y}
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-gray-200 dark:text-gray-700"
                  />
                ))}

                {/* Score line */}
                <polyline
                  points={progressHistory
                    .map((h, i) => {
                      const x = (i / Math.max(progressHistory.length - 1, 1)) * 100;
                      const y = 100 - Math.min(100, (h.score / 150) * 100);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary-500"
                />

                {/* Best score line */}
                <line
                  x1="0"
                  y1={100 - Math.min(100, (stats.bestScore / 150) * 100)}
                  x2="100"
                  y2={100 - Math.min(100, (stats.bestScore / 150) * 100)}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  className="text-green-500"
                />
              </svg>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Waiting for training data...
            </div>
          )}

          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>Start</span>
            <span>Episode Progress</span>
            <span>Now</span>
          </div>
        </Card>

        {/* Controls */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Controls</h3>
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCurrentEpisode(0);
                setProgressHistory([]);
                setLogs([]);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>

            <Link href="/goal" className="block">
              <Button variant="secondary" className="w-full">
                New Goal
              </Button>
            </Link>

            <Link href="/train" className="block">
              <Button variant="ghost" className="w-full">
                Quick Train
              </Button>
            </Link>
          </div>

          {/* Status */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium mb-3">Current Status</h4>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Episode</span>
                  <span className="font-mono">{currentEpisode}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Current Score</span>
                  <span className="font-mono">
                    {progressHistory.length > 0 ? progressHistory[progressHistory.length - 1].score.toFixed(1) : '0.0'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Best Score</span>
                  <span className="font-mono text-green-600">{stats.bestScore.toFixed(1)}</span>
                </div>
                <ProgressBar value={stats.bestScore} max={150} color="success" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress to Target (100)</span>
                  <span className="font-mono">{Math.min(100, (stats.avgScore / 100) * 100).toFixed(0)}%</span>
                </div>
                <ProgressBar value={Math.min(100, stats.avgScore)} max={100} color="primary" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Real-time Logs */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary-600" />
            Recent Logs
          </h3>
          <span className="text-xs text-gray-500">Live updates</span>
        </div>

        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
          {logs.length > 0 ? (
            <div className="space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="opacity-80">
                  {log}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Waiting for training logs...
            </div>
          )}
        </div>
      </Card>

      {/* Completion Message */}
      {workflowStatus === 'completed' && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-start">
            <CheckCircle className="h-8 w-8 text-green-500 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
                Goal Achieved! 🎉
              </h3>
              <p className="text-green-800 dark:text-green-200 mb-4">
                The agent successfully learned to play Angry Birds and reached the target score.
                You can now download the trained model or try different goals.
              </p>
              <div className="flex space-x-3">
                <Button variant="primary">Download Model</Button>
                <Button variant="outline">View Details</Button>
                <Link href="/goal">
                  <Button variant="ghost">Try New Goal</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {workflowStatus === 'failed' && (
        <Card className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-start">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                Training Did Not Complete
              </h3>
              <p className="text-red-800 dark:text-red-200 mb-4">
                The agent did not reach the target score within the allowed iterations.
                Consider adjusting your goal, using more training timesteps, or enabling curriculum learning.
              </p>
              <div className="flex space-x-3">
                <Link href="/goal">
                  <Button variant="primary">Adjust Goal & Retry</Button>
                </Link>
                <Link href="/train">
                  <Button variant="outline">Customize Training</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
