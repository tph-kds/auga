'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';

export default function AgentStream() {
  const { backendOnline } = useApp();
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!backendOnline) return;
    let isActive = true;

    const fetchFrame = async () => {
      if (!isActive) return;
      try {
        // Add timestamp to bypass browser cache
        const ts = new Date().getTime();
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const url = `${baseUrl}/latest-frame?t=${ts}`;
        
        // Pre-fetch to check if it's 404/error before flashing
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          setFrameUrl(url);
          setError(false);
        } else {
          setError(true);
        }
      } catch (e) {
        setError(true);
      }
      
      if (isActive) {
        // Poll at roughly 10fps
        setTimeout(fetchFrame, 100);
      }
    };

    fetchFrame();

    return () => {
      isActive = false;
    };
  }, [backendOnline]);

  if (!backendOnline) {
    return (
      <div className="w-full aspect-[4/3] bg-gray-900 flex items-center justify-center rounded-xl overflow-hidden border border-gray-800">
        <p className="text-gray-500 font-mono text-sm">Waiting for Backend Connection...</p>
      </div>
    );
  }

  if (error || !frameUrl) {
    return (
      <div className="w-full aspect-[4/3] bg-gray-900 flex items-center justify-center rounded-xl overflow-hidden border border-gray-800">
        <div className="text-center">
          <p className="text-orange-500 font-mono text-sm">No Agent Activity Detected</p>
          <p className="text-gray-500 text-xs mt-2">Submit a goal or start training to view the live agent stream.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src={frameUrl} 
        alt="Live Agent Stream" 
        className="w-full h-full object-contain"
      />
      <div className="absolute top-2 left-2 flex gap-2 pointer-events-none">
        <span className="badge-blue text-[10px] animate-pulse flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping inline-block"/>
          LIVE AGENT STREAM
        </span>
      </div>
    </div>
  );
}
