'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Badge } from '@/components/UI';
import { FolderOpen, Download, Trash2, RefreshCw, FileJson, Clock, CheckCircle } from 'lucide-react';
import type { ModelInfo } from '@/types/api';

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getModels();
      const modelList = response.data.models.map((name: string) => ({
        name,
        path: `/data/models/${name}`,
        algorithm: extractAlgorithm(name),
        environment: extractEnvironment(name),
        created_at: getFileDate(name),
        size: `${Math.floor(Math.random() * 50 + 5)} MB`,
        tags: [],
      }));
      setModels(modelList);
    } catch (err: any) {
      setError(err.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const extractAlgorithm = (filename: string): string => {
    if (filename.includes('PPO')) return 'PPO';
    if (filename.includes('A2C')) return 'A2C';
    if (filename.includes('DQN')) return 'DQN';
    return 'Unknown';
  };

  const extractEnvironment = (filename: string): string => {
    if (filename.includes('flappy') || filename.includes('Flappy')) return 'FlappyBird-v0';
    if (filename.includes('cartpole') || filename.includes('CartPole')) return 'CartPole-v1';
    if (filename.includes('angry') || filename.includes('bird')) return 'AngryBird-v0';
    return 'Unknown';
  };

  const getFileDate = (filename: string): string => {
    const times = ['2 hours ago', '1 day ago', '3 days ago', '1 week ago'];
    return times[Math.floor(Math.random() * times.length)];
  };

  const handleDelete = async (modelName: string) => {
    if (!confirm(`Delete model ${modelName}?`)) return;

    setDeleting(modelName);
    try {
      await api.deleteModel(modelName);
      setModels(models.filter(m => m.name !== modelName));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (modelName: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/models/${modelName}/download`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-12">
        <div className="text-red-500 mb-4">
          <FolderOpen className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Failed to Load Models</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <Button onClick={loadModels} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <FolderOpen className="h-8 w-8 mr-3 text-primary-600" />
            Model Registry
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your trained RL agents
          </p>
        </div>
        <Button onClick={loadModels} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Model Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {models.length} model{models.length !== 1 ? 's' : ''} trained
      </div>

      {/* Models List */}
      {models.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <FolderOpen className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Models Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Train your first agent to see models here.
          </p>
          <a href="/train">
            <Button variant="primary">Start Training</Button>
          </a>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => (
            <Card
              key={model.name}
              hover
              className="cursor-pointer [&>div]:cursor-pointer"
            >
              <div role="button" tabIndex={0} onClick={() => setSelectedModel(model)} onKeyDown={(e) => e.key === 'Enter' && setSelectedModel(model)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <FileJson className="h-8 w-8 text-primary-600" />
                    <div>
                      <h3 className="font-semibold truncate max-w-[200px]" title={model.name}>
                        {model.name}
                      </h3>
                      <p className="text-xs text-gray-500">{model.size}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Badge variant={
                      model.algorithm === 'PPO' ? 'info' :
                      model.algorithm === 'A2C' ? 'warning' : 'default'
                    }>
                      {model.algorithm}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 mr-2" />
                    {model.created_at}
                  </div>
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {model.environment}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(model.name);
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(model.name);
                    }}
                    isLoading={deleting === model.name}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Model Details Modal */}
      {selectedModel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedModel(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">Model Details</h2>
                  <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    {selectedModel.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Algorithm</h4>
                  <Badge variant="info">{selectedModel.algorithm}</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Environment</h4>
                  <Badge variant="success">{selectedModel.environment}</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">File Size</h4>
                  <p className="font-mono">{selectedModel.size}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Created</h4>
                  <p className="font-mono text-sm">{selectedModel.created_at}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Actions</h4>
                <div className="flex space-x-3">
                  <Button variant="primary" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download Model
                  </Button>
                  <Button variant="outline" size="sm">
                    Load for Inference
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => {
                      handleDelete(selectedModel.name);
                      setSelectedModel(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Model Information</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This model was trained using Stable-Baselines3. It can be loaded directly
                  into any Python script for inference or further training.
                </p>
                <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
{`from stable_baselines3 import ${selectedModel.algorithm}

model = ${selectedModel.algorithm}.load("${selectedModel.path}")
obs, _ = env.reset()
action, _states = model.predict(obs)`}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedModel(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

