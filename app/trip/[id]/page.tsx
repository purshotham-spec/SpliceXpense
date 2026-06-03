'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { getUserId } from '@/lib/user';
import { getCurrencySymbol, fmt } from '@/lib/utils';
import ExpenseCard from '@/components/ExpenseCard';
import type { TripData } from '@/lib/types';

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [data, setData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const userId = typeof window !== 'undefined' ? getUserId() : null;

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => {
    loadData();
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50">
        <p className="text-zinc-500 text-sm">Trip not found</p>
        <a href="/" className="text-sm text-black underline underline-offset-2">Go home</a>
      </div>
    );
  }

  const { trip, expenses, members } = data;
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const currency = trip.currency;

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${trip.invite_code}`
      : '';

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base leading-tight">{trip.name}</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="text-zinc-400 hover:text-black transition-colors p-1"
              title="Refresh"
            >
              ↻
            </button>
            <button
              onClick={() => setShowInvite(true)}
              className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 hover:border-zinc-400 transition-colors"
            >
              + Invite
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        {/* Summary card */}
        <div className="bg-black text-white rounded-2xl p-5 mb-4">
          <p className="text-zinc-400 text-xs font-medium tracking-wide">TOTAL SPENT</p>
          <p className="text-4xl font-bold mt-1">{fmt(total, currency)}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push(`/trip/${tripId}/balances`)}
              className="flex-1 bg-white/10 hover:bg-white/20 rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Balances
            </button>
            <button
              onClick={() => router.push(`/trip/${tripId}/add`)}
              className="flex-1 bg-white text-black rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-100 transition-colors"
            >
              + Add expense
            </button>
          </div>
        </div>

        {/* Members */}
        {members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
            {members.map((m) => (
              <span
                key={m.id}
                className="flex-shrink-0 bg-white border border-zinc-200 rounded-full px-3 py-1 text-xs text-zinc-500"
              >
                {m.user?.name}
              </span>
            ))}
          </div>
        )}

        {/* Expense list */}
        {expenses.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🧾</p>
            <p className="text-zinc-400 text-sm">No expenses yet</p>
            <button
              onClick={() => router.push(`/trip/${tripId}/add`)}
              className="mt-4 text-sm text-black underline underline-offset-2"
            >
              Add the first expense
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                currency={currency}
                currentUserId={userId ?? ''}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-lg mb-0.5">Invite to {trip.name}</h2>
            <p className="text-zinc-400 text-sm mb-5">Share the code or scan QR</p>

            <div className="bg-zinc-50 rounded-xl p-4 text-center mb-4">
              <p className="text-3xl font-bold tracking-[0.25em] font-mono">
                {trip.invite_code}
              </p>
            </div>

            {inviteUrl && (
              <div className="flex justify-center mb-5">
                <QRCodeSVG value={inviteUrl} size={148} className="rounded-lg" />
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={copyInvite}
                className="w-full border border-zinc-200 rounded-xl py-2.5 text-sm font-medium hover:border-zinc-400 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy invite link'}
              </button>
              <button
                onClick={() => {
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`Join ${trip.name} on Splice 💸\n${inviteUrl}`)}`,
                    '_blank'
                  );
                }}
                className="w-full bg-[#25D366] text-white rounded-xl py-2.5 text-sm font-medium active:opacity-80"
              >
                Share on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
