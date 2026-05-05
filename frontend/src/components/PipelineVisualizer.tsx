'use client';

interface Stage {
  id: string;
  label: string;
  icon: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

interface PipelineVisualizerProps {
  stages?: Stage[];
  className?: string;
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'goal', label: 'Parse Goal', icon: '🎯', status: 'pending' },
  { id: 'env', label: 'Create Env', icon: '🎮', status: 'pending' },
  { id: 'train', label: 'Train Model', icon: '🧠', status: 'pending' },
  { id: 'eval', label: 'Evaluate', icon: '📊', status: 'pending' },
  { id: 'play', label: 'Play Game', icon: '🕹️', status: 'pending' },
  { id: 'result', label: 'Report', icon: '✅', status: 'pending' },
];

export default function PipelineVisualizer({ stages, className }: PipelineVisualizerProps) {
  const pipeline = stages || DEFAULT_STAGES;

  const statusStyles: Record<string, string> = {
    pending: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400',
    active: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 border-orange-400 text-orange-600 shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30 animate-pulse',
    done: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-400 text-green-600',
    error: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30 border-red-400 text-red-600',
  };

  const connectorStyles: Record<string, string> = {
    pending: 'bg-gray-200 dark:bg-gray-700',
    active: 'bg-gradient-to-r from-orange-400 to-amber-400 animate-pulse',
    done: 'bg-gradient-to-r from-green-400 to-emerald-400',
    error: 'bg-red-400',
  };

  return (
    <div className={`${className || ''}`}>
      <div className="flex items-center justify-between gap-1">
        {pipeline.map((stage, idx) => (
          <div key={stage.id} className="flex items-center flex-1">
            {/* Stage Node */}
            <div className="flex flex-col items-center min-w-0 flex-shrink-0">
              <div
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl transition-all duration-500 ${statusStyles[stage.status]}`}
              >
                {stage.status === 'active' ? (
                  <span className="animate-bounce">{stage.icon}</span>
                ) : stage.status === 'done' ? (
                  '✓'
                ) : stage.status === 'error' ? (
                  '✗'
                ) : (
                  stage.icon
                )}
              </div>
              <span className="text-[10px] mt-1.5 text-center font-medium text-gray-500 dark:text-gray-400 truncate max-w-[70px]">
                {stage.label}
              </span>
              {stage.detail && (
                <span className="text-[9px] text-gray-400 truncate max-w-[70px]">{stage.detail}</span>
              )}
            </div>

            {/* Connector */}
            {idx < pipeline.length - 1 && (
              <div className="flex-1 mx-1">
                <div
                  className={`h-0.5 rounded-full transition-all duration-500 ${
                    pipeline[idx + 1].status === 'done' || pipeline[idx + 1].status === 'active'
                      ? connectorStyles.done
                      : pipeline[idx].status === 'active'
                      ? connectorStyles.active
                      : connectorStyles.pending
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
