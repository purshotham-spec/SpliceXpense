'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { getUserId } from '@/lib/user';
import { fmt } from '@/lib/utils';
import ExpenseCard from '@/components/ExpenseCard';
import { useTripContext } from './context';
import type { OptimisticExpense } from '@/lib/types';

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const { trip, members, expenses, days, loading, saveError, clearSaveError, deleteExpense, saveDay, deleteDay, reload } = useTripContext();
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDays, setShowDays] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acting, setActing] = useState(false);

  // Add day form state
  const [newDayName, setNewDayName] = useState('');
  const [newDayDate, setNewDayDate] = useState('');
  const [savingDay, setSavingDay] = useState(false);

  const userId = typeof window !== 'undefined' ? getUserId() : null;
  const isOwner = !!userId && trip?.owner_id === userId;

  useEffect(() => {
    if (saveError) {
      const t = setTimeout(clearSaveError, 5000);
      return () => clearTimeout(t);
    }
  }, [saveError, clearSaveError]);

  // Pre-fill day name with next day number
  useEffect(() => {
    if (showDays) setNewDayName(`Day ${days.length + 1}`);
  }, [showDays, days.length]);

  const grouped = useMemo(() => {
    if (days.length === 0) return null;
    const byDay: Record<string, OptimisticExpense[]> = {};
    days.forEach((d) => { byDay[d.id] = []; });
    const ungrouped: OptimisticExpense[] = [];
    expenses.forEach((e) => {
      if (e.day_id && byDay[e.day_id] !== undefined) byDay[e.day_id].push(e);
      else ungrouped.push(e);
    });
    return { byDay, ungrouped };
  }, [days, expenses]);

  async function handleLeave() {
    if (!userId || !confirm('Leave this trip? You can rejoin via invite link.')) return;
    setActing(true);
    const res = await fetch(`/api/trips/${tripId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) { window.location.href = '/'; }
    else { const d = await res.json(); alert(d.error ?? 'Failed to leave trip.'); setActing(false); }
  }

  async function handleDelete() {
    if (!userId || !confirm(`Delete "${trip?.name}"? This cannot be undone and will remove all expenses.`)) return;
    setActing(true);
    const res = await fetch(`/api/trips/${tripId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) { window.location.href = '/'; }
    else { const d = await res.json(); alert(d.error ?? 'Failed to delete trip.'); setActing(false); }
  }

  async function handleAddDay() {
    if (!newDayName.trim() || !userId) return;
    setSavingDay(true);
    await saveDay(newDayName.trim(), newDayDate || undefined, userId);
    setNewDayName(`Day ${days.length + 2}`);
    setNewDayDate('');
    setSavingDay(false);
  }

  async function handleDeleteDay(dayId: string, name: string) {
    if (!userId || !confirm(`Remove "${name}"? Expenses in this day will move to "Other".`)) return;
    await deleteDay(dayId, userId);
  }

  if (loading && !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50">
        <p className="text-zinc-500 text-sm">Trip not found</p>
        <a href="/" className="text-sm text-black underline underline-offset-2">Go home</a>
      </div>
    );
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const currency = trip.currency;
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${trip.invite_code}` : '';
  const activeMemberIds = members.map((m) => m.user_id);

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function renderExpenseCard(expense: OptimisticExpense) {
    return (
      <ExpenseCard
        key={expense.id}
        expense={expense}
        currency={currency}
        currentUserId={userId ?? ''}
        tripOwnerId={trip!.owner_id ?? undefined}
        activeMemberIds={activeMemberIds}
        onEdit={(id) => router.push(`/trip/${tripId}/edit/${id}`)}
        onDelete={(id) => deleteExpense(id, userId ?? '')}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      {saveError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-500 text-white text-sm text-center py-2 px-4">
          {saveError}
        </div>
      )}

      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base leading-tight">{trip.name}</h1>
            <p className="text-zinc-400 text-xs mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => reload()} className="text-zinc-400 hover:text-black transition-colors p-1" title="Refresh">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            {isOwner && (
              <button onClick={() => setShowDays(true)} className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-600 hover:border-zinc-400 transition-colors">
                Days {days.length > 0 && <span className="ml-0.5 text-zinc-400">({days.length})</span>}
              </button>
            )}
            <button onClick={() => setShowInvite(true)} className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 hover:border-zinc-400 transition-colors">
              + Invite
            </button>
            <button onClick={() => setShowSettings(true)} className="text-zinc-400 hover:text-black transition-colors p-1" title="Settings">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <circle cx="6" cy="12" r="1" fill="currentColor" />
                <circle cx="18" cy="12" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        <div className="bg-black text-white rounded-2xl p-5 mb-4">
          <p className="text-zinc-400 text-xs font-medium tracking-wide">TOTAL SPENT</p>
          <p className="text-4xl font-bold mt-1">{fmt(total, currency)}</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => router.push(`/trip/${tripId}/balances`)} className="flex-1 bg-white/10 hover:bg-white/20 rounded-xl py-2.5 text-sm font-medium transition-colors">
              Balances
            </button>
            <button onClick={() => router.push(`/trip/${tripId}/add`)} className="flex-1 bg-white text-black rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-100 transition-colors">
              + Add expense
            </button>
          </div>
        </div>

        {members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
            {members.map((m) => (
              <span key={m.id} className="flex-shrink-0 flex items-center gap-1 bg-white border border-zinc-200 rounded-full pl-3 pr-2 py-1 text-xs text-zinc-500">
                {m.user?.name}
                {isOwner && m.user_id !== userId && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${m.user?.name} from this trip?`)) return;
                      const res = await fetch(`/api/trips/${tripId}/members/${m.user_id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requester_id: userId }),
                      });
                      if (res.ok) window.location.reload();
                      else alert('Failed to remove member.');
                    }}
                    className="text-zinc-300 hover:text-red-400 transition-colors leading-none ml-0.5"
                  >×</button>
                )}
              </span>
            ))}
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🧾</p>
            <p className="text-zinc-400 text-sm">No expenses yet</p>
            <button onClick={() => router.push(`/trip/${tripId}/add`)} className="mt-4 text-sm text-black underline underline-offset-2">
              Add the first expense
            </button>
          </div>
        ) : grouped ? (
          // Grouped by day
          <div className="space-y-5">
            {days.map((day) => {
              const dayExpenses = grouped.byDay[day.id] ?? [];
              const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
              return (
                <div key={day.id}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div>
                      <span className="text-xs font-semibold text-zinc-800">{day.name}</span>
                      {day.date && <span className="text-xs text-zinc-400 ml-1.5">{fmtDate(day.date)}</span>}
                    </div>
                    <span className="text-xs font-medium text-zinc-500">{fmt(dayTotal, currency)}</span>
                  </div>
                  {dayExpenses.length > 0 ? (
                    <div className="space-y-2">{dayExpenses.map(renderExpenseCard)}</div>
                  ) : (
                    <div className="bg-white rounded-xl px-4 py-3 text-xs text-zinc-300 text-center border border-dashed border-zinc-200">
                      No expenses yet
                    </div>
                  )}
                </div>
              );
            })}
            {grouped.ungrouped.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-2 px-1">OTHER</p>
                <div className="space-y-2">{grouped.ungrouped.map(renderExpenseCard)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">{expenses.map(renderExpenseCard)}</div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-0.5">Invite to {trip.name}</h2>
            <p className="text-zinc-400 text-sm mb-5">Share the code or scan QR</p>
            <div className="bg-zinc-50 rounded-xl p-4 text-center mb-4">
              <p className="text-3xl font-bold tracking-[0.25em] font-mono">{trip.invite_code}</p>
            </div>
            {inviteUrl && (
              <div className="flex justify-center mb-5">
                <QRCodeSVG value={inviteUrl} size={148} className="rounded-lg" />
              </div>
            )}
            <div className="space-y-2">
              <button onClick={copyInvite} className="w-full border border-zinc-200 rounded-xl py-2.5 text-sm font-medium hover:border-zinc-400 transition-colors">
                {copied ? '✓ Copied!' : 'Copy invite link'}
              </button>
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join ${trip.name} on Splice 💸\n${inviteUrl}`)}`, '_blank')}
                className="w-full bg-[#25D366] text-white rounded-xl py-2.5 text-sm font-medium active:opacity-80"
              >
                Share on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{trip.name}</h2>
            <a href="/" className="block w-full border border-zinc-200 rounded-xl py-3 text-sm font-medium text-center text-zinc-700 hover:border-zinc-400 transition-colors">
              ← Back to home
            </a>
            {!isOwner && (
              <button onClick={handleLeave} disabled={acting} className="w-full border border-red-200 rounded-xl py-3 text-sm font-medium text-red-500 hover:border-red-400 transition-colors disabled:opacity-40">
                Leave trip
              </button>
            )}
            {isOwner && (
              <button onClick={handleDelete} disabled={acting} className="w-full bg-red-500 text-white rounded-xl py-3 text-sm font-medium active:opacity-80 disabled:opacity-40">
                Delete trip
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manage Days modal */}
      {showDays && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setShowDays(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">Manage days</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Group expenses by day for easier tracking</p>
              </div>
              <button onClick={() => setShowDays(false)} className="text-zinc-400 text-xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {days.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-4">No days added yet</p>
              )}
              {days.map((day) => (
                <div key={day.id} className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{day.name}</p>
                    {day.date && <p className="text-xs text-zinc-400">{fmtDate(day.date)}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>{(grouped?.byDay[day.id] ?? []).length} expense{(grouped?.byDay[day.id] ?? []).length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => handleDeleteDay(day.id, day.name)}
                      className="text-zinc-300 hover:text-red-400 transition-colors text-xl leading-none"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-zinc-100 space-y-2">
              <p className="text-xs font-medium text-zinc-400 mb-2">ADD DAY</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Day name (e.g. Day 1, Beach day)"
                  value={newDayName}
                  onChange={(e) => setNewDayName(e.target.value)}
                  className="flex-1 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-400 bg-white"
                />
                <input
                  type="date"
                  value={newDayDate}
                  onChange={(e) => setNewDayDate(e.target.value)}
                  className="border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-400 bg-white text-zinc-600"
                />
              </div>
              <button
                onClick={handleAddDay}
                disabled={savingDay || !newDayName.trim()}
                className="w-full bg-black text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40"
              >
                {savingDay ? 'Adding…' : '+ Add day'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
