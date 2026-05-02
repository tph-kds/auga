'use client';

import { useEffect } from 'react';
import { useApp } from '@/lib/context';
import { StatCard, Card, Badge, ProgressBar } from '@/components/UI';
import {
  TrendingUp,
  Target,
  Clock,
  Zap,
  CheckCircle,
  AlertCircle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { workflowDetails, activeWorkflowId, setActiveWorkflowId, workflowStatus, isConnected } = useApp();

  const stats = {
    totalEpisodes: workflowDetails.controller?.total_episodes_played || 0,
    bestScore: workflowDetails.controller?.best_score || 0,
    successRate: (workflowDetails.controller?.success_rate || 0) * 100,
    recentScore: workflowDetails.controller?.mean_recent_score || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor your autonomous RL agents
          </p>
        </div>
        <Link href="/goal">
          <button className="btn-primary flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>New Goal</span>
          </button>
        </Link>
      </div>

      {/* Status Overview */}
      {activeWorkflowId && (
        <Card className="border-l-4 border-l-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">Active Workflow</h2>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mb-2">
                {activeWorkflowId}
              </p>
              <div className="flex items-center space-x-4">
                <Badge variant={
                  workflowStatus === 'running' ? 'info' :
                  workflowStatus === 'completed' ? 'success' :
                  workflowStatus === 'failed' ? 'error' : 'default'
                }>
                  {workflowStatus === 'running' && (
                    <span className="flex items-center">
                      <span className="h-2 w-2 bg-current rounded-full mr-2 animate-pulse" />
                      Running
                    </span>
                  )}
                  {workflowStatus === 'completed' && 'Completed'}
                  {workflowStatus === 'failed' && 'Failed'}
                  {workflowStatus === 'not_found' && 'Not Found'}
                </Badge>
                <span className="text-sm text-gray-500">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600">{stats.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Episodes"
          value={stats.totalEpisodes.toLocaleString()}
          icon={<Activity className="h-6 w-6 text-primary-600" />}
        />
        <StatCard
          title="Best Score"
          value={stats.bestScore.toFixed(1)}
          icon={<Target className="h-6 w-6 text-secondary-600" />}
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          change={5.2}
          trend="up"
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
        />
        <StatCard
          title="Current Avg"
          value={stats.recentScore.toFixed(1)}
          icon={<TrendingUp className="h-6 w-6 text-yellow-600" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Progress */}
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-primary-600" />
            Training Progress
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Goal Progress</span>
                <span className="font-mono">{Math.min(100, (stats.recentScore / 100) * 100).toFixed(0)}%</span>
              </div>
              <ProgressBar
                value={Math.min(100, stats.recentScore)}
                max={100}
                showLabel
                color="primary"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Success Rate</span>
                <span className="font-mono">{stats.successRate.toFixed(1)}%</span>
              </div>
              <ProgressBar
                value={stats.successRate}
                max={100}
                showLabel
                color="success"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Episode Completion</span>
                <span className="font-mono">{(stats.totalEpisodes % 100).toFixed(0)}%</span>
              </div>
              <ProgressBar
                value={stats.totalEpisodes % 100}
                max={100}
                showLabel
                color="secondary"
              />
            </div>
          </div>
        </Card>

        {/* Recent Activity / Plans */}
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary-600" />
            Recent Goals
          </h3>
          <div className="space-y-3">
            <Link href="/goal" className="block p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary-600">Create New Goal</span>
                <span className="text-sm text-gray-500">→</span>
              </div>
            </Link>
            {workflowStatus === 'running' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-200">
                      Training in Progress
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Agent is currently training. Check Monitor page for live updates.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {workflowStatus === 'completed' && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-200">
                      Goal Achieved!
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Agent successfully completed the training goal.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {workflowStatus === 'failed' && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-200">
                      Training Failed
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Agent did not achieve goal. Consider adjusting targets or retrying.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/goal" className="block">
          <div className="card card-hover cursor-pointer text-center">
            <Target className="h-12 w-12 mx-auto mb-3 text-primary-600" />
            <h3 className="font-semibold text-lg mb-1">Define Goal</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Describe your RL objective in natural language
            </p>
          </div>
        </Link>
        <Link href="/train" className="block">
          <div className="card card-hover cursor-pointer text-center">
            <Zap className="h-12 w-12 mx-auto mb-3 text-secondary-600" />
            <h3 className="font-semibold text-lg mb-1">Quick Train</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Start training with pre-configured settings
            </p>
          </div>
        </Link>
        <Link href="/monitor" className="block">
          <div className="card card-hover cursor-pointer text-center">
            <Activity className="h-12 w-12 mx-auto mb-3 text-green-600" />
            <h3 className="font-semibold text-lg mb-1">Monitor</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View live training metrics and progress
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
