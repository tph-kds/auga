'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/UI';
import { Card } from '@/components/UI';
import type { TrainRequest } from '@/types/api';
import { Brain, Play, Settings, AlertCircle, CheckCircle } from 'lucide-react';

const PRESETS = {
  quick: {
    name: 'Quick Test',
    timesteps: 10000,
    algorithm: 'PPO',
    description: 'Fast training for testing',
  },
  balanced: {
    name: 'Balanced',
    timesteps: 50000,
    algorithm: 'PPO',
    description: 'Good performance vs speed',
  },
  thorough: {
    name: 'Thorough',
    timesteps: 200000,
    algorithm: 'PPO',
    description: 'Maximum performance',
  },
  a2c_fast: {
    name: 'A2C Fast',
    timesteps: 10000,
    algorithm: 'A2C',
    description: 'Faster but less stable',
  },
  dqn: {
    name: 'DQN',
    timesteps: 100000,
    algorithm: 'DQN',
    description: 'Deep Q-Learning',
  },
};

export default function TrainPage() {
  const router = useRouter();
  const [environment, setEnvironment] = useState('AngryBird-v0');
  const [level, setLevel] = useState('basic');
  const [algorithm, setAlgorithm] = useState('PPO');
  const [timesteps, setTimesteps] = useState(50000);
  const [targetScore, setTargetScore] = useState(100);
  const [hyperparameters, setHyperparameters] = useState({
    learning_rate: 0.0003,
    batch_size: 64,
    gamma: 0.99,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    model_path: string;
    metrics: any;
  } | null>(null);

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const request: TrainRequest = {
        environment,
        algorithm,
        total_timesteps: timesteps,
        target_score: targetScore,
        level: environment === 'AngryBird-v0' ? level : undefined,
        hyperparameters,
      };

      const response = await api.train(request);
      const data = response.data;

      setResult({
        success: data.success,
        model_path: data.model_path,
        metrics: data.metrics,
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Training failed');
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    const preset = PRESETS[presetName];
    setAlgorithm(preset.algorithm);
    setTimesteps(preset.timesteps);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
            <Brain className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Quick Training
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Manually configure and train an RL agent
        </p>
      </div>

      {/* Presets */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Quick Presets</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key as keyof typeof PRESETS)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                algorithm === preset.algorithm && timesteps === preset.timesteps
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
              }`}
            >
              <div className="font-semibold mb-1">{preset.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {preset.description}
              </div>
              <div className="text-xs font-mono">
                {preset.algorithm} • {preset.timesteps.toLocaleString()} steps
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Training Form */}
      <Card className="shadow-lg">
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <Settings className="h-6 w-6 mr-2 text-primary-600" />
          Training Configuration
        </h2>

        <form onSubmit={handleTrain} className="space-y-6">
          {/* Environment Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="input max-w-xs"
            >
              <option value="AngryBird-v0">Angry Birds (Custom)</option>
              <option value="CartPole-v1">CartPole-v1</option>
              <option value="FlappyBird-v0">Flappy Bird</option>
            </select>
          </div>

          {environment === 'AngryBird-v0' && (
            <div>
              <label className="block text-sm font-medium mb-2">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="input max-w-xs"
              >
                <option value="basic">Basic</option>
                <option value="medium">Medium</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          )}

          {/* Algorithm & Timesteps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Algorithm</label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="input"
              >
                <option value="PPO">PPO (Proximal Policy Optimization)</option>
                <option value="A2C">A2C (Advantage Actor-Critic)</option>
                <option value="DQN">DQN (Deep Q-Network)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Training Timesteps</label>
              <input
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                value={timesteps}
                onChange={(e) => setTimesteps(Number(e.target.value))}
                className="input"
              />
              <p className="text-sm text-gray-500 mt-1">
                More timesteps = better performance but longer training
              </p>
            </div>
          </div>

          {/* Target Score */}
          <div>
            <label className="block text-sm font-medium mb-2">Target Score</label>
            <input
              type="number"
              min="1"
              max="10000"
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="input max-w-xs"
            />
            <p className="text-sm text-gray-500 mt-1">
              Score threshold for considering training successful
            </p>
          </div>

          {/* Hyperparameters */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Hyperparameters</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Learning Rate</label>
                  <input
                    type="number"
                    step="1e-6"
                    min="1e-6"
                    max="1e-2"
                    value={hyperparameters.learning_rate}
                    onChange={(e) => setHyperparameters({
                      ...hyperparameters,
                      learning_rate: Number(e.target.value)
                    })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Batch Size</label>
                  <input
                    type="number"
                    min="8"
                    max="512"
                    step="8"
                    value={hyperparameters.batch_size}
                    onChange={(e) => setHyperparameters({
                      ...hyperparameters,
                      batch_size: Number(e.target.value)
                    })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Gamma (Discount)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.9"
                    max="0.999"
                    value={hyperparameters.gamma}
                    onChange={(e) => setHyperparameters({
                      ...hyperparameters,
                      gamma: Number(e.target.value)
                    })}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && result.success && (
            <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Training Complete!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Model saved to: {result.model_path}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Mean reward: {result.metrics.mean_reward?.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="min-w-[200px]"
            >
              <Play className="h-5 w-5 mr-2" />
              {isLoading ? 'Training...' : 'Start Training'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Info */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-0">
        <h3 className="font-semibold text-lg mb-3 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
          Training Tips for Angry Birds
        </h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
          <li><strong>Start small:</strong> Use 10k-50k timesteps for quick experiments</li>
          <li><strong>PPO recommended:</strong> Best balance of stability and performance</li>
          <li><strong>Monitor early:</strong> Check if reward is increasing after 10k steps</li>
          <li><strong>Adjust learning rate:</strong> Lower (1e-4) for fine-tuning, higher (1e-3) for early exploration</li>
          <li><strong>Target score:</strong> For basic levels, aim for 50-100; complex structures need 200+</li>
          <li><strong>Progressively harder levels:</strong> Train on simple levels first</li>
        </ul>
      </Card>
    </div>
  );
}
