'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { api } from '@/lib/api';
import { Button } from '@/components/UI';
import { Card } from '@/components/UI';
import type { GoalRequest } from '@/types/api';
import { CheckCircle, AlertCircle, Bird } from 'lucide-react';

// Example goals for Angry Birds
const EXAMPLE_GOALS = [
  {
    title: 'Destroy All Pigs',
    description: 'Train agent to eliminate all pigs in the level',
    goal: 'Train an Angry Birds agent to destroy all pigs in the level with maximum efficiency',
  },
  {
    title: 'Score Maximization',
    description: 'Achieve the highest possible score',
    goal: 'Maximize score in Angry Birds by destroying structures and hitting pigs',
  },
  {
    title: 'Minimize Birds Used',
    description: 'Complete level using fewest birds possible',
    goal: 'Learn to destroy all pigs using minimal number of birds (1-2 birds)',
  },
  {
    title: 'Precision Launch',
    description: 'Perfect accuracy and targeting',
    goal: 'Train agent to accurately hit specific targets with precise angle and power',
  },
];

export default function GoalPage() {
  const router = useRouter();
  const { setActiveWorkflowId } = useApp();
  const [userInput, setUserInput] = useState('');
  const [maxIterations, setMaxIterations] = useState(3);
  const [enableCurriculum, setEnableCurriculum] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) {
      setError('Please enter a goal description');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: GoalRequest = {
        user_input: userInput.trim(),
        max_iterations: maxIterations,
        enable_curriculum: enableCurriculum,
      };

      const response = await api.submitGoal(request);
      const data = response.data;

      if (data.success) {
        setActiveWorkflowId(data.workflow_id);
        // Redirect to monitor page
        router.push(`/monitor?workflow=${data.workflow_id}`);
      } else {
        setError(data.error || 'Failed to submit goal');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleSelect = (example: typeof EXAMPLE_GOALS[0]) => {
    setUserInput(example.goal);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
            <Bird className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Train Angry Birds Agent
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Describe what you want the AI to achieve in Angry Birds. Our autonomous system will
          parse your goal, design a custom reward function, and train an RL agent.
        </p>
      </div>

      {/* Examples */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Example Goals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXAMPLE_GOALS.map((example, idx) => (
            <Card
              key={idx}
              hover
              className="cursor-pointer"
              onClick={() => handleExampleSelect(example)}
            >
              <h3 className="font-semibold text-lg mb-2">{example.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {example.description}
              </p>
              <div className="mt-2 text-xs text-primary-600 font-mono">
                "{example.goal.substring(0, 60)}..."
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Goal Form */}
      <Card className="shadow-lg">
        <h2 className="text-2xl font-semibold mb-6">Define Your Custom Goal</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="goal-input" className="block text-sm font-medium mb-2">
              Goal Description
            </label>
            <textarea
              id="goal-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="E.g., Train an agent to destroy all pigs using the fewest birds possible with precise aim..."
              className="textarea min-h-[150px]"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Be specific about what you want the agent to achieve. Include target metrics if possible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Iterations
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500">
                Number of retry attempts if goal not met (1-10)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Curriculum Learning
              </label>
              <div className="flex items-center space-x-3 mt-2">
                <input
                  type="checkbox"
                  id="enable-curriculum"
                  checked={enableCurriculum}
                  onChange={(e) => setEnableCurriculum(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="enable-curriculum" className="text-sm">
                  Enable progressive difficulty scaling
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Agent starts with easier variants and gradually increases difficulty
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="min-w-[200px]"
            >
              {isLoading ? 'Submitting...' : 'Start Training'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-0">
        <h3 className="font-semibold text-lg mb-3 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
          How It Works
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
          <li>
            <strong>Parse:</strong> Our AI analyzes your goal and creates a training plan
          </li>
          <li>
            <strong>Design:</strong> Custom reward function is generated for Angry Birds physics
          </li>
          <li>
            <strong>Train:</strong> PPO/A2C/DQN agent learns through thousands of episodes
          </li>
          <li>
            <strong>Evaluate:</strong> Agent performance is tested against your target
          </li>
          <li>
            <strong>Retry:</strong> If needed, the system automatically refines approach
          </li>
        </ol>
      </Card>
    </div>
  );
}
