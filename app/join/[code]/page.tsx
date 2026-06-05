'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { setUserId, setUserName, getUserId, getUserName } from '@/lib/user';
import type { Trip, TripMember } from '@/lib/types';

type Step = 'pick' | 'contact' | 'new';

export default function JoinPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  // step: 'pick' = show member list, 'contact' = returning member adding contact info, 'new' = brand new user form
  const [step, setStep] = useState<Step>('pick');
  const [pickedMember, setPickedMember] = useState<TripMember | null>(null);

  // New user form
  const [name, setName] = useState(() => getUserName() ?? '');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    fetch(`/api/trips/code/${code}`)
      .then(async (r) => {
        if (!r.ok) { setLoadError('Trip not found.'); return; }
        const data = await r.json();
        setTrip(data.trip ?? data);
        setMembers(data.members ?? []);
      })
      .catch(() => setLoadError('Could not load trip.'))
      .finally(() => setLoading(false));
  }, [code]);

  // If user already has a stored ID that matches a member, show quick confirm
  useEffect(() => {
    const storedId = getUserId();
    if (!storedId || members.length === 0) return;
    const matched = members.find((m) => m.user_id === storedId);
    if (matched) {
      setPickedMember(matched);
      setStep('contact');
    }
  }, [members]);

  async function handlePickMember(member: TripMember) {
    setPickedMember(member);
    // Pre-fill contact details if already set
    setPhone(member.user?.phone ?? '');
    setUpiId(member.user?.upi_id ?? '');
    setStep('contact');
  }

  async function handleConfirmReturning() {
    if (!pickedMember || !trip) return;
    setJoining(true);
    setJoinError('');
    try {
      // Store identity
      setUserId(pickedMember.user_id);
      setUserName(pickedMember.user?.name ?? '');

      // Update contact info if provided
      if (phone.trim() || upiId.trim()) {
        await fetch(`/api/users/${pickedMember.user_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim() || undefined, upi_id: upiId.trim() || undefined }),
        });
      }

      // Join (idempotent if already a member)
      await fetch(`/api/trips/${trip.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: pickedMember.user_id }),
      });

      await new Promise((r) => setTimeout(r, 200));
      window.location.href = `/trip/${trip.id}`;
    } catch {
      setJoinError('Something went wrong. Please try again.');
      setJoining(false);
    }
  }

  async function handleNewJoin() {
    if (!name.trim() || !trip) return;
    setJoining(true);
    setJoinError('');
    try {
      let userId = getUserId();
      if (!userId) {
        const userRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, upi_id: upiId.trim() || null }),
        });
        const user = await userRes.json();
        if (!userRes.ok) throw new Error(user.error);
        userId = user.id;
        setUserId(user.id);
        setUserName(user.name);
      } else {
        setUserName(name.trim());
        if (phone.trim() || upiId.trim()) {
          await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone.trim() || undefined, upi_id: upiId.trim() || undefined }),
          });
        }
      }

      const joinRes = await fetch(`/api/trips/${trip.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!joinRes.ok) throw new Error('Failed to join trip');

      await new Promise((r) => setTimeout(r, 200));
      window.location.href = `/trip/${trip.id}`;
    } catch {
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
        <a href="/" className="text-sm text-black underline underline-offset-2">Go home</a>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-white">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-sm text-zinc-400 mb-1">You're joining</p>
          <h1 className="text-3xl font-bold">{trip?.name}</h1>
          <p className="text-xs text-zinc-400 mt-1">{members.length} member{members.length !== 1 ? 's' : ''} already in this trip</p>
        </div>

        {/* Step: pick from existing members */}
        {step === 'pick' && (
          <div className="space-y-3">
            {members.length > 0 && (
              <>
                <p className="text-xs font-medium text-zinc-400 text-center">ARE YOU ONE OF THESE PEOPLE?</p>
                <div className="space-y-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handlePickMember(m)}
                      className="w-full flex items-center gap-3 border border-zinc-200 rounded-xl px-4 py-3 hover:border-black hover:bg-zinc-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-500 flex-shrink-0">
                        {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.user?.name}</p>
                        {(m.user?.phone || m.user?.upi_id) && (
                          <p className="text-xs text-zinc-400 truncate">{m.user?.upi_id ?? m.user?.phone}</p>
                        )}
                      </div>
                      <span className="text-zinc-300 text-sm">→</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-zinc-100" />
                  <span className="text-xs text-zinc-400">not on the list?</span>
                  <div className="flex-1 h-px bg-zinc-100" />
                </div>
              </>
            )}

            <button
              onClick={() => { setPickedMember(null); setStep('new'); }}
              className="w-full border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
            >
              Join as someone new →
            </button>
          </div>
        )}

        {/* Step: returning member confirm + optional contact info */}
        {step === 'contact' && pickedMember && (
          <div className="space-y-3">
            <div className="bg-zinc-50 rounded-xl px-4 py-3 flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {pickedMember.user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold">{pickedMember.user?.name}</p>
                <p className="text-xs text-zinc-400">That's you — welcome back!</p>
              </div>
            </div>

            <p className="text-xs font-medium text-zinc-400 pt-1">PAYMENT DETAILS <span className="font-normal text-zinc-300">(optional — helps with UPI payments)</span></p>

            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />
            <input
              type="text"
              placeholder="UPI ID (e.g. name@paytm, name@ybl)"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />

            {joinError && <p className="text-xs text-red-500 text-center">{joinError}</p>}

            <button
              onClick={handleConfirmReturning}
              disabled={joining}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
            >
              {joining ? 'Joining…' : `Continue as ${pickedMember.user?.name} →`}
            </button>
            <button onClick={() => { setPickedMember(null); setStep('pick'); }} className="w-full text-xs text-zinc-400 py-1">
              ← That's not me
            </button>
          </div>
        )}

        {/* Step: brand new user */}
        {step === 'new' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
              autoFocus
            />

            <p className="text-xs font-medium text-zinc-400 pt-1">PAYMENT DETAILS <span className="font-normal text-zinc-300">(optional)</span></p>

            <input
              type="tel"
              placeholder="Phone number (for WhatsApp reminders)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />
            <input
              type="text"
              placeholder="UPI ID (e.g. name@paytm, name@ybl)"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewJoin()}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />

            {joinError && <p className="text-xs text-red-500 text-center">{joinError}</p>}

            <button
              onClick={handleNewJoin}
              disabled={joining || !name.trim()}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
            >
              {joining ? 'Joining…' : 'Join trip →'}
            </button>
            {members.length > 0 && (
              <button onClick={() => setStep('pick')} className="w-full text-xs text-zinc-400 py-1">
                ← Back to member list
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
