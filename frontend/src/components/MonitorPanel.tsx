'use client';

import React from 'react';
import { Activity, Play } from 'lucide-react';
import { ProgressBar } from './UI';

export default function MonitorPanel() {
  // UseApp context for status/models/plans
  // Embed charts, game preview (canvas?), live SSE

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-lg border">
      <div className="p-4 border-b font-semibold flex items-center">
        <Activity className="h-5 w-5 mr-2" />
        Live Monitor
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Data Collection</span>
            <span>87%</span>
          </div>
          <ProgressBar value={87} />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Fine-tuning</span>
            <span>42%</span>
          </div>
          <ProgressBar value={42} />
        </div>
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
          <div className="flex items-center">
            <Play className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="font-semibold">Playing Episode 23</p>
              <p className="text-sm text-green-700">Current score: 8/10</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

