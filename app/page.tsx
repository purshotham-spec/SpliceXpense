'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setUserId, setUserName } from '@/lib/user';

const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee (₹)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'THB', label: 'THB — Thai Baht' },
];

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'create' | 'join'>('create');

  const [ownerName, setOwnerName] = useState('');
  const [tripName, setTripName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [creating, setCreating] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleCreate() {
    if (!ownerName.trim() || !tripName.trim()) return;
    setCreating(true);
    try {
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ownerName.trim() }),
      });
      const user = await userRes.json();
      if (!userRes.ok) throw new Error(user.error);

      setUserId(user.id);
      setUserName(user.name);

      const tripRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tripName.trim(), currency, owner_id: user.id }),
      });
      const trip = await tripRes.json();
      if (!tripRes.ok) throw new Error(trip.error);

      router.push(`/trip/${trip.id}`);
    } catch (err) {
      alert('Something went wrong. Please try again.');
      setCreating(false);
    }
  }

  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) return;
    setChecking(true);
    setJoinError('');
    try {
      const res = await fetch(`/api/trips/code/${code}`);
      if (!res.ok) {
        setJoinError('Trip not found. Check the invite code and try again.');
        return;
      }
      router.push(`/join/${code}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">splice</h1>
          <p className="text-zinc-400 text-sm mt-1.5">split expenses, not friendships</p>
        </div>

        <div className="flex border border-zinc-200 rounded-2xl overflow-hidden mb-5">
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-black text-white' : 'text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {t === 'create' ? 'Start a trip' : 'Join a trip'}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Your name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />
            <input
              type="text"
              placeholder="Trip name (e.g. Goa 2025)"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 bg-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={creating || !ownerName.trim() || !tripName.trim()}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
            >
              {creating ? 'Creating…' : 'Create trip →'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={8}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 uppercase tracking-widest text-center font-mono text-lg"
            />
            {joinError && (
              <p className="text-xs text-red-500 text-center">{joinError}</p>
            )}
            <button
              onClick={handleJoin}
              disabled={checking || inviteCode.trim().length < 4}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
            >
              {checking ? 'Checking…' : 'Join trip →'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
