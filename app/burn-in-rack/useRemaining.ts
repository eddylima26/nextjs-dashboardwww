'use client';
import { useEffect, useState } from 'react';

export default function useRemaining(endsAtISO?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAtISO) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAtISO]);

  if (!endsAtISO) return { ms: undefined, done: false };
  const end = new Date(endsAtISO).getTime();
  const ms = Math.max(0, end - now);
  return { ms, done: ms === 0 };
}
