'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { calculateBalances } from '@/lib/balance';
import { fmt } from '@/lib/utils';
import BalanceCard from '@/components/BalanceCard';
import type { Expense, ExpenseSplit, TripMember, BalanceTransaction } from '@/lib/types';

export default function BalancesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [tripName, setTripName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [members, setMembers] = useState<TripMember[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((data) => {
        const mems: TripMember[] = data.members ?? [];
        const expenses: Expense[] = data.expenses ?? [];

        setTripName(data.trip?.name ?? '');
        setCurrency(data.trip?.currency ?? 'USD');
        setMembers(mems);

        const allSplits: ExpenseSplit[] = expenses.flatMap((e) => e.splits ?? []);
        const txns = calculateBalances(mems, expenses, allSplits);

        const memberMap = Object.fromEntries(mems.map((m) => [m.user_id, m.user]));
        setTransactions(
          txns.map((t) => ({
            ...t,
            from_user: memberMap[t.from_user_id],
            to_user: memberMap[t.to_user_id],
          }))
        );

        if (typeof window !== 'undefined') {
          setShareLink(`${window.location.origin}/trip/${tripId}`);
        }
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  function buildGroupWhatsApp() {
    const lines = transactions.map(
      (t) => `• ${t.from_user?.name ?? '?'} → ${t.to_user?.name ?? '?'}: ${fmt(t.amount, currency)}`
    );
    const text = `${tripName} — final splits:\n${lines.join('\n')}\n\nView details: ${shareLink}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-black transition-colors text-xl leading-none"
          >
            ←
          </button>
          <div>
            <h1 className="font-bold text-base">Balances</h1>
            <p className="text-xs text-zinc-400">{tripName}</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 pb-10 space-y-4">
        {transactions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🎉</p>
            <p className="text-zinc-500 text-sm font-medium">All settled up!</p>
            <p className="text-zinc-400 text-xs mt-1">No one owes anything</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {transactions.map((t, i) => (
                <BalanceCard
                  key={i}
                  transaction={t}
                  currency={currency}
                  tripId={tripId}
                />
              ))}
            </div>

            {/* Send all splits at once */}
            <button
              onClick={() => window.open(buildGroupWhatsApp(), '_blank')}
              className="w-full border border-zinc-200 bg-white rounded-xl py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
            >
              Share all splits on WhatsApp
            </button>
          </>
        )}

        {/* Member summary */}
        {members.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <p className="text-xs text-zinc-400 font-medium mb-3">MEMBERS</p>
            <div className="space-y-2">
              {members.map((m) => {
                const owes = transactions
                  .filter((t) => t.from_user_id === m.user_id)
                  .reduce((s, t) => s + t.amount, 0);
                const getsBack = transactions
                  .filter((t) => t.to_user_id === m.user_id)
                  .reduce((s, t) => s + t.amount, 0);
                const net = getsBack - owes;

                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-sm">{m.user?.name}</span>
                    <span
                      className={`text-sm font-medium ${
                        net > 0.01 ? 'text-green-600' : net < -0.01 ? 'text-red-500' : 'text-zinc-400'
                      }`}
                    >
                      {net > 0.01
                        ? `+${fmt(net, currency)}`
                        : net < -0.01
                          ? `-${fmt(Math.abs(net), currency)}`
                          : 'settled'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
