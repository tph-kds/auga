'use client';

import { useState } from 'react';
import ChatBot from '@/components/ChatBot';
import MonitorPanel from '@/components/MonitorPanel';

export default function AgentChat() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[80vh]">
        {/* Chat */}
        <div className="xl:col-span-2">
          <ChatBot />
        </div>
        
        {/* Monitor */}
        <div>
          <MonitorPanel />
        </div>
      </div>
    </div>
  );
}


