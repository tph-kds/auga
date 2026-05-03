'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoalPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/chat');
  }, []);
  return <div>Redirecting to Agent Chat...</div>;
}

