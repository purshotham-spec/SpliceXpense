'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { calculateBalances } from '@/lib/balance';
import { fmt } from '@/lib/utils';
import { useTripContext } from '../context';
import type { ExpenseSplit, TripMember } from '@/lib/types';

interface MemberStat {
  member: TripMember;
  paid: number;
  share: number;
  net: number;
  breakdown: { description: string; amountPaid: number; myShare: number; net: number }[];
}

export default function BalancesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [showHow, setShowHow] = useState(false);
  const [drillDown, setDrillDown] = useState<MemberStat | null>(null);

  const { trip, members, expenses, loading } = useTripContext();
  const currency = trip?.currency ?? 'INR';

  const { transactions, memberStats, shareLink } = useMemo(() => {
    const allSplits: ExpenseSplit[] = expenses.flatMap((e) => e.splits ?? []);
    const txns = calculateBalances(members, expenses, allSplits);
    const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m.user]));
    const enriched = txns.map((t) => ({
      ...t,
      from_user: memberMap[t.from_user_id],
      to_user: memberMap[t.to_user_id],
    }));

    const paid: Record<string, number> = {};
    const share: Record<string, number> = {};
    members.forEach((m) => { paid[m.user_id] = 0; share[m.user_id] = 0; });
    expenses.forEach((e) => { if (paid[e.paid_by] !== undefined) paid[e.paid_by] += Number(e.amount); });
    allSplits.forEach((s) => { if (share[s.user_id] !== undefined) share[s.user_id] += Number(s.amount); });

    const stats: MemberStat[] = members.map((m) => {
      const breakdown = expenses
        .map((e) => {
          const amountPaid = e.paid_by === m.user_id ? Number(e.amount) : 0;
          const myShare = Number((e.splits ?? []).find((s) => s.user_id === m.user_id)?.amount ?? 0);
          const net = amountPaid - myShare;
          return { description: e.description, amountPaid, myShare, net };
        })
        .filter((row) => row.amountPaid > 0 || row.myShare > 0);

      return {
        member: m,
        paid: Math.round((paid[m.user_id] ?? 0) * 100) / 100,
        share: Math.round((share[m.user_id] ?? 0) * 100) / 100,
        net: Math.round(((paid[m.user_id] ?? 0) - (share[m.user_id] ?? 0)) * 100) / 100,
        breakdown,
      };
    });

    const link = typeof window !== 'undefined' ? `${window.location.origin}/trip/${tripId}` : '';
    return { transactions: enriched, memberStats: stats, shareLink: link };
  }, [members, expenses, tripId]);

  function buildGroupWhatsApp() {
    const lines = transactions.map(
      (t) => `• ${t.from_user?.name ?? '?'} pays ${t.to_user?.name ?? '?'}: ${fmt(t.amount, currency)}`
    );
    const text = `${trip?.name ?? 'Trip'} — who pays whom:\n${lines.join('\n')}\n\nView full details: ${shareLink}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  function buildWhatsAppUrl(t: typeof transactions[0]) {
    const tripUrl = typeof window !== 'undefined' ? `${window.location.origin}/trip/${tripId}` : '';
    const text = `Hey ${t.from_user?.name ?? 'there'}, you owe ${t.to_user?.name ?? 'someone'} ${fmt(t.amount, currency)}.\nSettle up: ${tripUrl}`;
    const phone = t.from_user?.phone?.replace(/\D/g, '');
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  if (loading && !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalSpend = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/trip/${tripId}`)} className="text-zinc-400 hover:text-black transition-colors text-xl leading-none">←</button>
          <div>
            <h1 className="font-bold text-base">Balances</h1>
            <p className="text-xs text-zinc-400">{trip?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 pb-10 space-y-4">

        {/* Total spend */}
        <div className="bg-black text-white rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400 font-medium">TOTAL TRIP SPEND</p>
            <p className="text-2xl font-bold mt-0.5">{fmt(totalSpend, currency)}</p>
          </div>
          <p className="text-xs text-zinc-400 text-right">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}<br />{members.length} people</p>
        </div>

        {/* Per-member breakdown */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-xs font-medium text-zinc-400">WHO PAID WHAT VS THEIR SHARE</p>
            <button onClick={() => setShowHow(!showHow)} className="text-xs text-zinc-400 underline underline-offset-2">
              {showHow ? 'hide' : 'how is this calculated?'}
            </button>
          </div>

          {showHow && (
            <div className="mx-4 mb-3 bg-zinc-50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
              <p><span className="font-semibold text-black">Paid</span> = money they actually put in upfront.</p>
              <p><span className="font-semibold text-black">Fair share</span> = sum of their portion across every expense.</p>
              <p><span className="font-semibold text-green-600">Gets back</span> = paid more than their share → others owe them.</p>
              <p><span className="font-semibold text-red-500">Owes</span> = their share was more than what they paid → they need to pay up.</p>
              <p className="pt-1 border-t border-zinc-200">The app figures out the <span className="font-semibold text-black">fewest transfers</span> to settle everything — so people who owe multiple others pay one person at a time instead of everyone separately.</p>
            </div>
          )}

          <div className="divide-y divide-zinc-100">
            {memberStats.map((stat) => (
              <div key={stat.member.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{stat.member.user?.name}</span>
                    <button
                      onClick={() => setDrillDown(stat)}
                      className="w-4 h-4 rounded-full border border-zinc-300 text-zinc-400 hover:border-black hover:text-black transition-colors flex items-center justify-center text-[10px] font-bold leading-none flex-shrink-0"
                      title="See breakdown"
                    >
                      ?
                    </button>
                  </div>
                  <span className={`text-sm font-bold ${stat.net > 0.01 ? 'text-green-600' : stat.net < -0.01 ? 'text-red-500' : 'text-zinc-400'}`}>
                    {stat.net > 0.01 ? `gets back ${fmt(stat.net, currency)}` : stat.net < -0.01 ? `owes ${fmt(Math.abs(stat.net), currency)}` : 'settled ✓'}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-zinc-400">
                  <span>Paid <span className="text-zinc-600 font-medium">{fmt(stat.paid, currency)}</span></span>
                  <span>·</span>
                  <span>Fair share <span className="text-zinc-600 font-medium">{fmt(stat.share, currency)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settlements */}
        {transactions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-zinc-600 text-sm font-medium">All settled up!</p>
            <p className="text-zinc-400 text-xs mt-1">No one owes anything</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 px-1">
              WHO PAYS WHOM · {transactions.length} transfer{transactions.length !== 1 ? 's' : ''} to settle everything
            </p>
            {transactions.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-sm font-bold text-red-400 flex-shrink-0">
                      {t.from_user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.from_user?.name}</p>
                      <p className="text-xs text-red-400">pays</p>
                    </div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <p className="text-base font-bold">{fmt(t.amount, currency)}</p>
                    <p className="text-xs text-zinc-300">→</p>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <div className="min-w-0 text-right">
                      <p className="text-sm font-semibold truncate">{t.to_user?.name}</p>
                      <p className="text-xs text-green-500">receives</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-sm font-bold text-green-500 flex-shrink-0">
                      {t.to_user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => window.open(buildWhatsAppUrl(t), '_blank')}
                  className="w-full bg-[#25D366] text-white rounded-xl py-2.5 text-sm font-medium active:opacity-80"
                >
                  Remind {t.from_user?.name} on WhatsApp
                </button>
              </div>
            ))}
            <button
              onClick={() => window.open(buildGroupWhatsApp(), '_blank')}
              className="w-full border border-zinc-200 bg-white rounded-xl py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
            >
              Share all splits on WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Drill-down sheet */}
      {drillDown && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
          onClick={() => setDrillDown(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="px-5 pt-5 pb-3 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">{drillDown.member.user?.name}'s breakdown</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">How we arrived at their balance</p>
                </div>
                <button onClick={() => setDrillDown(null)} className="text-zinc-400 text-xl leading-none">×</button>
              </div>
            </div>

            {/* Expense rows */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {drillDown.breakdown.map((row, i) => (
                <div key={i} className="rounded-xl bg-zinc-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-black leading-snug">{row.description}</p>
                    <span className={`text-xs font-semibold flex-shrink-0 ${row.net > 0.01 ? 'text-green-600' : row.net < -0.01 ? 'text-red-500' : 'text-zinc-400'}`}>
                      {row.net > 0.01 ? `+${fmt(row.net, currency)}` : row.net < -0.01 ? `-${fmt(Math.abs(row.net), currency)}` : '±0'}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-400">
                    {row.amountPaid > 0 && (
                      <span>Paid <span className="text-zinc-600 font-medium">{fmt(row.amountPaid, currency)}</span></span>
                    )}
                    {row.myShare > 0 && (
                      <span>Share <span className="text-zinc-600 font-medium">{fmt(row.myShare, currency)}</span></span>
                    )}
                    {row.amountPaid === 0 && row.myShare === 0 && (
                      <span className="text-zinc-300">not involved</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div className="px-5 py-4 border-t border-zinc-100 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total paid upfront</span>
                <span className="font-medium">{fmt(drillDown.paid, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total fair share</span>
                <span className="font-medium">{fmt(drillDown.share, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-zinc-100 pt-1.5">
                <span>{drillDown.net > 0.01 ? 'Gets back' : drillDown.net < -0.01 ? 'Owes' : 'Settled'}</span>
                <span className={drillDown.net > 0.01 ? 'text-green-600' : drillDown.net < -0.01 ? 'text-red-500' : 'text-zinc-400'}>
                  {drillDown.net > 0.01 ? fmt(drillDown.net, currency) : drillDown.net < -0.01 ? fmt(Math.abs(drillDown.net), currency) : '✓'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
