'use client';

import { useState, useEffect, useId } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUserId } from '@/lib/user';
import { fmt } from '@/lib/utils';
import CameraUpload from '@/components/CameraUpload';
import MemberPicker from '@/components/MemberPicker';
import SplitSelector from '@/components/SplitSelector';
import type { TripMember, ParsedReceiptItem } from '@/lib/types';

interface ReceiptLineItem extends ParsedReceiptItem {
  uid: string;
  assigned_to: string[];
}

type Flow = 'manual' | 'receipt';

export default function AddExpensePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const uid = useId();

  const [members, setMembers] = useState<TripMember[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [flow, setFlow] = useState<Flow>('manual');

  // Manual form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Receipt flow state
  const [scanning, setScanning] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptLineItem[]>([]);
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptPaidBy, setReceiptPaidBy] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const userId = typeof window !== 'undefined' ? getUserId() : null;

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((data) => {
        const mems: TripMember[] = data.members ?? [];
        setMembers(mems);
        setCurrency(data.trip?.currency ?? 'USD');
        const allIds = mems.map((m) => m.user_id);
        setSelectedMembers(allIds);
        const defaultPayer = mems.find((m) => m.user_id === userId)?.user_id ?? mems[0]?.user_id ?? '';
        setPaidBy(defaultPayer);
        setReceiptPaidBy(defaultPayer);
      });
  }, [tripId, userId]);

  // ── Manual flow ──────────────────────────────────────────────
  async function saveManual() {
    if (!description.trim() || !amount || !paidBy || selectedMembers.length === 0) {
      setError('Fill in all fields and select at least one person to split with.');
      return;
    }
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) { setError('Enter a valid amount.'); return; }

    const splits = selectedMembers.map((id) => ({
      user_id: id,
      amount:
        splitType === 'equal'
          ? Math.round((total / selectedMembers.length) * 100) / 100
          : parseFloat(customSplits[id] || '0'),
    }));

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, paid_by: paidBy, description: description.trim(), amount: total, split_type: splitType, splits }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/trip/${tripId}`;
    } catch {
      setError('Failed to save. Try again.');
      setSaving(false);
    }
  }

  // ── Receipt flow ──────────────────────────────────────────────
  async function handleReceiptUpload(file: File) {
    setScanning(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/receipt/scan', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const items: ReceiptLineItem[] = (json.items as ParsedReceiptItem[]).map((item, i) => ({
        ...item,
        uid: `${uid}-${i}`,
        assigned_to: members.map((m) => m.user_id),
      }));
      setReceiptItems(items);
      setFlow('receipt');
    } catch {
      setError('Could not read receipt. Try a clearer photo, or add items manually.');
    } finally {
      setScanning(false);
    }
  }

  function toggleItemMember(itemUid: string, memberId: string) {
    setReceiptItems((items) =>
      items.map((item) =>
        item.uid !== itemUid
          ? item
          : {
              ...item,
              assigned_to: item.assigned_to.includes(memberId)
                ? item.assigned_to.filter((id) => id !== memberId)
                : [...item.assigned_to, memberId],
            }
      )
    );
  }

  function addManualItem() {
    if (!newItemName.trim() || !newItemPrice) return;
    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price <= 0) return;
    setReceiptItems((prev) => [
      ...prev,
      { uid: `manual-${Date.now()}`, name: newItemName.trim(), price, assigned_to: members.map((m) => m.user_id) },
    ]);
    setNewItemName('');
    setNewItemPrice('');
  }

  function removeItem(itemUid: string) {
    setReceiptItems((prev) => prev.filter((i) => i.uid !== itemUid));
  }

  async function saveReceipt() {
    if (!receiptDescription.trim() || !receiptPaidBy || receiptItems.length === 0) {
      setError('Add a description, select who paid, and keep at least one item.');
      return;
    }

    const splitMap: Record<string, number> = {};
    receiptItems.forEach((item) => {
      const count = item.assigned_to.length || 1;
      item.assigned_to.forEach((id) => {
        splitMap[id] = (splitMap[id] ?? 0) + item.price / count;
      });
    });

    const splits = Object.entries(splitMap).map(([user_id, amount]) => ({
      user_id,
      amount: Math.round(amount * 100) / 100,
    }));

    const total = receiptItems.reduce((s, i) => s + i.price, 0);

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          paid_by: receiptPaidBy,
          description: receiptDescription.trim(),
          amount: Math.round(total * 100) / 100,
          split_type: 'items',
          splits,
          receipt_items: receiptItems.map(({ name, price, assigned_to }) => ({ name, price, assigned_to })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/trip/${tripId}`;
    } catch {
      setError('Failed to save. Try again.');
      setSaving(false);
    }
  }

  const receiptTotal = receiptItems.reduce((s, i) => s + i.price, 0);

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => flow === 'receipt' ? setFlow('manual') : router.back()}
            className="text-zinc-400 hover:text-black transition-colors text-xl leading-none"
          >
            ←
          </button>
          <h1 className="font-bold text-base">
            {flow === 'receipt' ? 'Review receipt' : 'Add expense'}
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 pb-10 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Manual flow ── */}
        {flow === 'manual' && (
          <>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="What was this for? (e.g. Dinner at Nobu)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 bg-white"
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 bg-white"
              />
            </div>

            {members.length > 0 && (
              <MemberPicker
                members={members}
                selectedId={paidBy}
                onChange={setPaidBy}
                label="PAID BY"
              />
            )}

            {members.length > 0 && (
              <div>
                <p className="text-xs text-zinc-400 font-medium mb-2">SPLIT BETWEEN</p>
                <SplitSelector
                  members={members}
                  totalAmount={parseFloat(amount) || 0}
                  currency={currency}
                  splitType={splitType}
                  onSplitTypeChange={setSplitType}
                  selectedMembers={selectedMembers}
                  onSelectedMembersChange={setSelectedMembers}
                  customSplits={customSplits}
                  onCustomSplitsChange={setCustomSplits}
                />
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={saveManual}
                disabled={saving}
                className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
              >
                {saving ? 'Saving…' : 'Add expense'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-xs text-zinc-400">or</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>

              <CameraUpload onUpload={handleReceiptUpload} loading={scanning} />
            </div>
          </>
        )}

        {/* ── Receipt flow ── */}
        {flow === 'receipt' && (
          <>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Description (e.g. Dinner at Nobu)"
                value={receiptDescription}
                onChange={(e) => setReceiptDescription(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 bg-white"
              />
              {members.length > 0 && (
                <MemberPicker
                  members={members}
                  selectedId={receiptPaidBy}
                  onChange={setReceiptPaidBy}
                  label="PAID BY"
                />
              )}
            </div>

            {/* Line items */}
            <div>
              <p className="text-xs text-zinc-400 font-medium mb-2">ITEMS — tap names to assign</p>
              <div className="space-y-2">
                {receiptItems.map((item) => (
                  <div key={item.uid} className="bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{fmt(item.price, currency)}</span>
                        <button
                          onClick={() => removeItem(item.uid)}
                          className="text-zinc-300 hover:text-red-400 transition-colors text-base leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {members.map((m) => (
                        <button
                          key={m.user_id}
                          onClick={() => toggleItemMember(item.uid, m.user_id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            item.assigned_to.includes(m.user_id)
                              ? 'bg-black text-white'
                              : 'bg-zinc-100 text-zinc-400'
                          }`}
                        >
                          {m.user?.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Add item manually */}
                <div className="bg-white rounded-xl p-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="flex-1 text-sm outline-none placeholder:text-zinc-300"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Price"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
                    className="w-20 text-sm text-right outline-none placeholder:text-zinc-300"
                  />
                  <button
                    onClick={addManualItem}
                    disabled={!newItemName.trim() || !newItemPrice}
                    className="text-sm font-medium text-black disabled:text-zinc-300 transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-base font-bold">{fmt(receiptTotal, currency)}</span>
            </div>

            <button
              onClick={saveReceipt}
              disabled={saving || receiptItems.length === 0}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
            >
              {saving ? 'Saving…' : 'Save expense'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
