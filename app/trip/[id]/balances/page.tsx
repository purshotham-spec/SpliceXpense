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

type EnrichedTxn = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  from_user?: { name?: string; phone?: string | null; upi_id?: string | null };
  to_user?: { name?: string; phone?: string | null; upi_id?: string | null };
};

export default function BalancesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [tab, setTab] = useState<'summary' | 'settle'>('summary');
  const [showHow, setShowHow] = useState(false);
  const [drillDown, setDrillDown] = useState<MemberStat | null>(null);
  const [settleTarget, setSettleTarget] = useState<EnrichedTxn | null>(null);

  const { trip, members, expenses, loading } = useTripContext();
  const currency = trip?.currency ?? 'INR';

  const { transactions, memberStats, shareLink } = useMemo(() => {
    const activeMemberIds = new Set(members.map((m) => m.user_id));
    const allSplits: ExpenseSplit[] = expenses.flatMap((e) => e.splits ?? []).filter((s) => activeMemberIds.has(s.user_id));

    const effectiveExpenses = expenses.map((e) => {
      const activeTotal = (e.splits ?? []).filter((s) => activeMemberIds.has(s.user_id)).reduce((sum, s) => sum + Number(s.amount), 0);
      return { ...e, amount: activeTotal };
    });

    const txns = calculateBalances(members, effectiveExpenses, allSplits);
    const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m.user]));
    const enriched: EnrichedTxn[] = txns.map((t) => ({
      ...t,
      from_user: memberMap[t.from_user_id],
      to_user: memberMap[t.to_user_id],
    }));

    const paid: Record<string, number> = {};
    const share: Record<string, number> = {};
    members.forEach((m) => { paid[m.user_id] = 0; share[m.user_id] = 0; });
    effectiveExpenses.forEach((e) => { if (paid[e.paid_by] !== undefined) paid[e.paid_by] += Number(e.amount); });
    allSplits.forEach((s) => { if (share[s.user_id] !== undefined) share[s.user_id] += Number(s.amount); });

    const stats: MemberStat[] = members.map((m) => {
      const breakdown = expenses
        .map((e) => {
          const amountPaid = e.paid_by === m.user_id ? Number(e.amount) : 0;
          const myShare = Number((e.splits ?? []).find((s) => s.user_id === m.user_id)?.amount ?? 0);
          return { description: e.description, amountPaid, myShare, net: amountPaid - myShare };
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
    const lines = transactions.map((t) => `• ${t.from_user?.name ?? '?'} pays ${t.to_user?.name ?? '?'}: ${fmt(t.amount, currency)}`);
    const text = `${trip?.name ?? 'Trip'} — who pays whom:\n${lines.join('\n')}\n\nView full details: ${shareLink}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  function buildWhatsAppUrl(t: EnrichedTxn) {
    const text = `Hey ${t.from_user?.name ?? 'there'}, you owe ${t.to_user?.name ?? 'someone'} ${fmt(t.amount, currency)}.\nSettle up: ${shareLink}`;
    const phone = t.from_user?.phone?.replace(/\D/g, '');
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  function buildUPIUrl(t: EnrichedTxn) {
    const name = encodeURIComponent(t.to_user?.name ?? 'Payee');
    const note = encodeURIComponent(`${trip?.name ?? 'Trip'} settlement`);
    const amt = t.amount.toFixed(2);
    // Prefer explicit UPI ID; fall back to phone@paytm
    const upiId = t.to_user?.upi_id?.trim();
    const phone = t.to_user?.phone?.replace(/\D/g, '');
    const pa = upiId || (phone ? `${phone}@paytm` : '');
    return pa
      ? `upi://pay?pa=${encodeURIComponent(pa)}&pn=${name}&am=${amt}&cu=INR&tn=${note}`
      : `upi://pay?pn=${name}&am=${amt}&cu=INR&tn=${note}`;
  }

  function buildPaytmUrl(t: EnrichedTxn) {
    const upiId = t.to_user?.upi_id?.trim();
    const phone = t.to_user?.phone?.replace(/\D/g, '');
    const pa = upiId || (phone ? `${phone}@paytm` : null);
    const amt = t.amount.toFixed(2);
    return pa
      ? `paytmmp://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(t.to_user?.name ?? '')}&am=${amt}&cu=INR`
      : null;
  }

  function buildChatGPTUrl() {
    const memberNames = members.map((m) => m.user?.name ?? '?').join(', ');
    const expenseLines = expenses.map((e) => {
      const payer = members.find((m) => m.user_id === e.paid_by)?.user?.name ?? '?';
      const splitParts = (e.splits ?? []).map((s) => {
        const name = members.find((m) => m.user_id === s.user_id)?.user?.name ?? '?';
        return `${name}: ${fmt(Number(s.amount), currency)}`;
      }).join(', ');
      return `- ${e.description}${e.expense_date ? ` (${e.expense_date})` : ''}: ${fmt(Number(e.amount), currency)} paid by ${payer}${splitParts ? ` — split: ${splitParts}` : ''}`;
    }).join('\n');
    const settlementLines = transactions.map((t) => `- ${t.from_user?.name ?? '?'} → ${t.to_user?.name ?? '?'}: ${fmt(t.amount, currency)}`).join('\n');
    const totalSpend = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const prompt = `Trip: ${trip?.name ?? 'Trip'}\nMembers (${members.length}): ${memberNames}\nTotal spend: ${fmt(totalSpend, currency)} across ${expenses.length} expenses\n\nExpenses:\n${expenseLines || 'None'}\n\nSettlements needed (${transactions.length} transfers):\n${settlementLines || 'All settled!'}\n\nTrip link: ${shareLink}\n\nCan you help me understand this expense split or answer any questions?`;
    return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
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

        {/* Tabs */}
        <div className="flex bg-zinc-100 rounded-xl p-1 gap-1">
          <button onClick={() => setTab('summary')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'summary' ? 'bg-white text-black shadow-sm' : 'text-zinc-500'}`}>
            Summary
          </button>
          <button onClick={() => setTab('settle')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'settle' ? 'bg-white text-black shadow-sm' : 'text-zinc-500'}`}>
            Settle Up {transactions.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{transactions.length}</span>}
          </button>
        </div>

        {/* ── Summary tab ── */}
        {tab === 'summary' && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-xs font-medium text-zinc-400">WHO PAID VS THEIR SHARE</p>
              <button onClick={() => setShowHow(!showHow)} className="text-xs text-zinc-400 underline underline-offset-2">
                {showHow ? 'hide' : 'how is this calculated?'}
              </button>
            </div>
            {showHow && (
              <div className="mx-4 mb-3 bg-zinc-50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
                <p><span className="font-semibold text-black">Paid</span> = money they actually put in upfront.</p>
                <p><span className="font-semibold text-black">Fair share</span> = sum of their portion across every expense.</p>
                <p><span className="font-semibold text-green-600">Gets back</span> = paid more than their share → others owe them.</p>
                <p><span className="font-semibold text-red-500">Owes</span> = their share was more than what they paid.</p>
                <p className="pt-1 border-t border-zinc-200">Splice finds the <span className="font-semibold text-black">fewest transfers</span> to settle everything.</p>
              </div>
            )}
            <div className="divide-y divide-zinc-100">
              {memberStats.map((stat) => (
                <div key={stat.member.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${stat.net > 0.01 ? 'bg-green-50 text-green-600' : stat.net < -0.01 ? 'bg-red-50 text-red-400' : 'bg-zinc-100 text-zinc-400'}`}>
                      {stat.member.user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm font-medium truncate">{stat.member.user?.name}</span>
                    <button onClick={() => setDrillDown(stat)} className="w-4 h-4 rounded-full border border-zinc-200 text-zinc-400 hover:border-black hover:text-black transition-colors flex items-center justify-center text-[10px] font-bold leading-none flex-shrink-0">?</button>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-bold ${stat.net > 0.01 ? 'text-green-600' : stat.net < -0.01 ? 'text-red-500' : 'text-zinc-400'}`}>
                      {stat.net > 0.01 ? `+${fmt(stat.net, currency)}` : stat.net < -0.01 ? `-${fmt(Math.abs(stat.net), currency)}` : '✓'}
                    </span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">paid {fmt(stat.paid, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Settle Up tab ── */}
        {tab === 'settle' && (
          <div className="space-y-3">
            <button onClick={() => window.open(buildChatGPTUrl(), '_blank')} className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
              </svg>
              Analyse with ChatGPT
            </button>

            {transactions.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl">
                <p className="text-4xl mb-2">🎉</p>
                <p className="text-zinc-600 text-sm font-medium">All settled up!</p>
                <p className="text-zinc-400 text-xs mt-1">No transfers needed</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-zinc-400 px-1">
                  {transactions.length} TRANSFER{transactions.length !== 1 ? 'S' : ''} TO SETTLE EVERYTHING
                </p>
                <div className="bg-white rounded-2xl divide-y divide-zinc-100 overflow-hidden">
                  {transactions.map((t, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-400 flex-shrink-0">
                        {t.from_user?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          <span className="text-black">{t.from_user?.name}</span>
                          <span className="text-zinc-400 mx-1">→</span>
                          <span className="text-black">{t.to_user?.name}</span>
                        </p>
                        <p className="text-xs text-zinc-400">{fmt(t.amount, currency)}</p>
                      </div>
                      <button
                        onClick={() => setSettleTarget(t)}
                        className="flex-shrink-0 bg-black text-white rounded-lg px-3 py-1.5 text-xs font-medium active:opacity-80"
                      >
                        Settle
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => window.open(buildGroupWhatsApp(), '_blank')} className="w-full border border-zinc-200 bg-white rounded-xl py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors">
                  Share all splits on WhatsApp
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Drill-down sheet ── */}
      {drillDown && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setDrillDown(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">{drillDown.member.user?.name}'s breakdown</h2>
                <p className="text-xs text-zinc-400 mt-0.5">How we arrived at their balance</p>
              </div>
              <button onClick={() => setDrillDown(null)} className="text-zinc-400 text-xl leading-none">×</button>
            </div>
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
                    {row.amountPaid > 0 && <span>Paid <span className="text-zinc-600 font-medium">{fmt(row.amountPaid, currency)}</span></span>}
                    {row.myShare > 0 && <span>Share <span className="text-zinc-600 font-medium">{fmt(row.myShare, currency)}</span></span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-zinc-100 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Total paid upfront</span><span className="font-medium">{fmt(drillDown.paid, currency)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Total fair share</span><span className="font-medium">{fmt(drillDown.share, currency)}</span></div>
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

      {/* ── Payment settle sheet ── */}
      {settleTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setSettleTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base">Settle up</h2>
                <button onClick={() => setSettleTarget(null)} className="text-zinc-400 text-xl leading-none">×</button>
              </div>
              {/* Confirmation row */}
              <div className="bg-zinc-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">{settleTarget.from_user?.name} pays {settleTarget.to_user?.name}</p>
                  {settleTarget.to_user?.upi_id && (
                    <p className="text-xs text-zinc-400 mt-0.5">UPI: {settleTarget.to_user.upi_id}</p>
                  )}
                  {!settleTarget.to_user?.upi_id && settleTarget.to_user?.phone && (
                    <p className="text-xs text-zinc-400 mt-0.5">Phone: {settleTarget.to_user.phone}</p>
                  )}
                  {!settleTarget.to_user?.upi_id && !settleTarget.to_user?.phone && (
                    <p className="text-xs text-amber-500 mt-0.5">No UPI ID or phone saved — ask {settleTarget.to_user?.name} to add one</p>
                  )}
                </div>
                <p className="text-xl font-bold text-black">{fmt(settleTarget.amount, currency)}</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-medium text-zinc-400 mb-3">CHOOSE PAYMENT METHOD</p>

              {/* UPI */}
              <button
                onClick={() => window.open(buildUPIUrl(settleTarget), '_blank')}
                className="w-full flex items-center gap-3 border border-zinc-200 rounded-xl px-4 py-3 hover:border-zinc-400 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold text-blue-600">₹</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Pay via UPI</p>
                  <p className="text-xs text-zinc-400">Google Pay, PhonePe, BHIM & more</p>
                </div>
                <svg className="w-4 h-4 text-zinc-300 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>

              {/* Paytm */}
              <button
                onClick={() => {
                  const url = buildPaytmUrl(settleTarget);
                  window.open(url ?? buildUPIUrl(settleTarget), '_blank');
                }}
                className="w-full flex items-center gap-3 border border-zinc-200 rounded-xl px-4 py-3 hover:border-zinc-400 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-sky-600">P</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Pay via Paytm</p>
                  <p className="text-xs text-zinc-400">Opens Paytm with amount pre-filled</p>
                </div>
                <svg className="w-4 h-4 text-zinc-300 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>

              {/* WhatsApp reminder */}
              <button
                onClick={() => { window.open(buildWhatsAppUrl(settleTarget), '_blank'); setSettleTarget(null); }}
                className="w-full flex items-center gap-3 bg-[#25D366] rounded-xl px-4 py-3 active:opacity-80"
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Remind on WhatsApp</p>
                  <p className="text-xs text-white/70">Send a reminder message</p>
                </div>
                <svg className="w-4 h-4 text-white/50 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
