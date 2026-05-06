'use client';
import { useState } from 'react';
import PhaserGame from './PhaserGame';
import { useApp } from '@/lib/context';

export default function AgentStream() {
  const { backendOnline } = useApp();
  const [gameType, setGameType] = useState<'angry_birds' | 'flappy_birds' | 'cars'>('angry_birds');

  return (
    <div className="relative w-full rounded-xl border border-gray-700 shadow-2xl bg-black flex flex-col">
      <div className="flex items-center gap-2 p-2 bg-gray-900 border-b border-gray-800">
        <button 
          onClick={() => setGameType('angry_birds')}
          className={`px-3 py-1 rounded text-sm ${gameType === 'angry_birds' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-300'}`}
        >
          Angry Birds
        </button>
        <button 
          onClick={() => setGameType('flappy_birds')}
          className={`px-3 py-1 rounded text-sm ${gameType === 'flappy_birds' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-300'}`}
        >
          Flappy Bird
        </button>
        <button 
          onClick={() => setGameType('cars')}
          className={`px-3 py-1 rounded text-sm ${gameType === 'cars' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-300'}`}
        >
          Car Racing
        </button>
      </div>
      
      <div className="relative w-full aspect-[4/3] bg-black">
        <PhaserGame gameType={gameType} />
        
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <div className="bg-red-500/85 backdrop-blur px-3 py-1 rounded shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-bold text-[10px] tracking-wider">AGENT PLAYING</span>
          </div>
        </div>

        <div className="absolute bottom-2 right-2 text-[10px] text-white/40 font-mono pointer-events-none z-10">
          Phaser Engine | High-Res Graphics
        </div>
      </div>
    </div>
  );
}
