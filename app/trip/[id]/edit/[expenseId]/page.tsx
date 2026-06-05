'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUserId } from '@/lib/user';
import { distributeEvenly } from '@/lib/balance';
import MemberPicker from '@/components/MemberPicker';
import SplitSelector from '@/components/SplitSelector';
import { useTripContext } from '../../context';

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const expenseId = params.expenseId as string;

  const { trip, members, reload } = useTripContext();
  const currency = trip?.currency ?? 'INR';
  const userId = typeof window !== 'undefined' ? getUserId() : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Load existing expense
  useEffect(() => {
    fetch(`/api/expenses/${expenseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError('Expense not found.'); return; }
        setDescription(data.description);
        setAmount(String(data.amount));
        setExpenseDate(data.expense_date ?? new Date().toISOString().slice(0, 10));
        setPaidBy(data.paid_by);
        const type = data.split_type === 'equal' ? 'equal' : 'custom';
        setSplitType(type);
        const splitIds = (data.splits ?? []).map((s: { user_id: string }) => s.user_id);
        setSelectedMembers(splitIds);
        if (type === 'custom') {
          const map: Record<string, string> = {};
          (data.splits ?? []).forEach((s: { user_id: string; amount: number }) => {
            map[s.user_id] = String(s.amount);
          });
          setCustomSplits(map);
        }
      })
      .catch(() => setError('Failed to load expense.'))
      .finally(() => setLoading(false));
  }, [expenseId]);

  const defaultPayer = members.find((m) => m.user_id === userId)?.user_id ?? members[0]?.user_id ?? '';
  const allMemberIds = members.map((m) => m.user_id);
  const activePaidBy = paidBy || defaultPayer;
  const activeMembers = selectedMembers.length > 0 ? selectedMembers : allMemberIds;

  async function handleSave() {
    const total = parseFloat(amount);
    if (!description.trim() || isNaN(total) || total <= 0 || !activePaidBy) {
      setError('Fill in description, amount, and who paid.');
      return;
    }
    if (activeMembers.length === 0) {
      setError('Select at least one person to split with.');
      return;
    }

    const splits =
      splitType === 'equal'
        ? distributeEvenly(Math.round(total * 100), activeMembers)
        : activeMembers.map((id) => ({ user_id: id, amount: parseFloat(customSplits[id] || '0') }));

    setError('');
    setSaving(true);

    const res = await fetch(`/api/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        trip_owner_id: trip?.owner_id,
        description: description.trim(),
        amount: total,
        split_type: splitType,
        paid_by: activePaidBy,
        expense_date: expenseDate,
        splits,
      }),
    });

    if (res.ok) {
      reload();
      router.push(`/trip/${tripId}`);
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to save. Please try again.');
      setSaving(false);
    }
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
            onClick={() => router.push(`/trip/${tripId}`)}
            className="text-zinc-400 hover:text-black transition-colors text-xl leading-none"
          >
            ←
          </button>
          <h1 className="font-bold text-base">Edit expense</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 pb-10 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            placeholder="What was this for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 bg-white"
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 bg-white"
            />
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="border border-zinc-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-zinc-400 bg-white text-zinc-600"
            />
          </div>
        </div>

        {members.length > 0 && (
          <>
            <MemberPicker
              members={members}
              selectedId={activePaidBy}
              onChange={setPaidBy}
              label="PAID BY"
            />
            <div>
              <p className="text-xs text-zinc-400 font-medium mb-2">SPLIT BETWEEN</p>
              <SplitSelector
                members={members}
                totalAmount={parseFloat(amount) || 0}
                currency={currency}
                splitType={splitType}
                onSplitTypeChange={setSplitType}
                selectedMembers={activeMembers}
                onSelectedMembersChange={setSelectedMembers}
                customSplits={customSplits}
                onCustomSplitsChange={setCustomSplits}
              />
            </div>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </main>
  );
}
