'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VoteButton({
  featureId, initialVotes, initialVoted, loggedIn,
}: {
  featureId: number; initialVotes: number; initialVoted: boolean; loggedIn: boolean;
}) {
  const [votes, setVotes]     = useState(initialVotes);
  const [voted, setVoted]     = useState(initialVoted);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!loggedIn) {
      router.push('/login');
      return;
    }
    if (loading) return;

    setLoading(true);
    const nextVoted = !voted;
    setVoted(nextVoted);
    setVotes((v) => v + (nextVoted ? 1 : -1));

    try {
      const res = await fetch('/api/sugestoes/vote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ featureId }),
      });
      if (!res.ok) throw new Error('falha ao votar');
      const data = await res.json() as { voted: boolean; votes: number };
      setVoted(data.voted);
      setVotes(data.votes);
    } catch {
      // reverte em caso de erro
      setVoted(!nextVoted);
      setVotes((v) => v - (nextVoted ? 1 : -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={loggedIn ? (voted ? 'Remover voto' : 'Votar nesta sugestão') : 'Entre para votar'}
      className="flex flex-col items-center justify-center rounded-xl border px-3 py-2 transition-colors min-w-[3.25rem]"
      style={
        voted
          ? { background: 'var(--accent-dim)', borderColor: 'var(--border-strong)', color: 'var(--accent-text)' }
          : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }
      }
    >
      <span className="text-sm leading-none">▲</span>
      <span className="text-xs font-bold leading-none mt-1">{votes}</span>
    </button>
  );
}
