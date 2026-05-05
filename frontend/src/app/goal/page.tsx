'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /goal is deprecated — the goal configuration is now built into
 * the Training Pipeline page (/train). Redirect transparently.
 */
export default function GoalRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/train');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      Redirecting to Training Pipeline…
    </div>
  );
}
