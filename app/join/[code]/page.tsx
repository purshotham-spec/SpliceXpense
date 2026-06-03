'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { setUserId, setUserName } from '@/lib/user';
import type { Trip } from '@/lib/types';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    fetch(`/api/trips/code/${code}`)
      .then(async (r) => {
        if (!r.ok) { setLoadError('Trip not found.'); return; }
        setTrip(await r.json());
      })
      .catch(() => setLoadError('Could not load trip.'))
      .finally(() => setLoading(false));
  }, [code]);

  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    setJoinError('');
    try {
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const user = await userRes.json();
      if (!userRes.ok) throw new Error(user.error);

      setUserId(user.id);
      setUserName(user.name);

      const joinRes = await fetch(`/api/trips/${trip!.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!joinRes.ok) throw new Error('Failed to join trip');

      router.push(`/trip/${trip!.id}`);
    } catch (err) {
      setJoinError('Something went wrong. Please try again.');
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
        <p className="text-zinc-500 text-sm">{loadError}</p>
        <a href="/" className="text-sm text-black underline underline-offset-2">
          Go home
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm text-zinc-400 mb-1">You're joining</p>
          <h1 className="text-3xl font-bold">{trip?.name}</h1>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            autoFocus
          />
          <input
            type="tel"
            placeholder="Phone number (for WhatsApp reminders)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
          />
          {joinError && (
            <p className="text-xs text-red-500 text-center">{joinError}</p>
          )}
          <button
            onClick={handleJoin}
            disabled={joining || !name.trim()}
            className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
          >
            {joining ? 'Joining…' : 'Join trip →'}
          </button>
        </div>

        <p className="text-xs text-zinc-400 text-center mt-4">
          Phone number is optional but lets others send you WhatsApp reminders
        </p>
      </div>
    </main>
  );
}
