'use client';

import { useState, useId } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUserId } from '@/lib/user';
import { fmt } from '@/lib/utils';
import CameraUpload from '@/components/CameraUpload';
import MemberPicker from '@/components/MemberPicker';
import SplitSelector from '@/components/SplitSelector';
import { useTripContext } from '../context';
import type { ParsedReceiptItem } from '@/lib/types';

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

  const { trip, members, saveExpense } = useTripContext();
  const currency = trip?.currency ?? 'INR';
  const userId = typeof window !== 'undefined' ? getUserId() : null;

  const [flow, setFlow] = useState<Flow>('manual');

  // Manual form
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(() => userId ?? members[0]?.user_id ?? '');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() =>
    members.map((m) => m.user_id)
  );
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Receipt flow
  const [scanning, setScanning] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptLineItem[]>([]);
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptPaidBy, setReceiptPaidBy] = useState(() => userId ?? members[0]?.user_id ?? '');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const [error, setError] = useState('');

  // Sync defaults once members load
  const defaultPayer = members.find((m) => m.user_id === userId)?.user_id ?? members[0]?.user_id ?? '';
  const allMemberIds = members.map((m) => m.user_id);

  // ── Manual flow ──────────────────────────────────────────────
  function handleManualSave() {
    const total = parseFloat(amount);
    const activePaidBy = paidBy || defaultPayer;
    const activeMembers = selectedMembers.length > 0 ? selectedMembers : allMemberIds;

    if (!description.trim() || isNaN(total) || total <= 0 || !activePaidBy) {
      setError('Fill in description, amount, and who paid.');
      return;
    }
    if (activeMembers.length === 0) {
      setError('Select at least one person to split with.');
      return;
    }

    setError('');

    const splits = activeMembers.map((id) => ({
      user_id: id,
      amount:
        splitType === 'equal'
          ? Math.round((total / activeMembers.length) * 100) / 100
          : parseFloat(customSplits[id] || '0'),
    }));

    saveExpense({
      description: description.trim(),
      amount: total,
      split_type: splitType,
      paid_by: activePaidBy,
      splits,
    });

    // Navigate instantly — expense already in list optimistically
    router.push(`/trip/${tripId}`);
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
        assigned_to: allMemberIds,
      }));
      setReceiptItems(items);
      setFlow('receipt');
    } catch {
      setError('Could not read receipt. Try a clearer photo or add items manually.');
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
    const price = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(price) || price <= 0) return;
    setReceiptItems((prev) => [
      ...prev,
      { uid: `manual-${Date.now()}`, name: newItemName.trim(), price, assigned_to: allMemberIds },
    ]);
    setNewItemName('');
    setNewItemPrice('');
  }

  function handleReceiptSave() {
    const activePaidBy = receiptPaidBy || defaultPayer;
    if (!receiptDescription.trim() || !activePaidBy || receiptItems.length === 0) {
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

    const splits = Object.entries(splitMap).map(([user_id, amt]) => ({
      user_id,
      amount: Math.round(amt * 100) / 100,
    }));

    const total = Math.round(receiptItems.reduce((s, i) => s + i.price, 0) * 100) / 100;

    setError('');

    saveExpense({
      description: receiptDescription.trim(),
      amount: total,
      split_type: 'items',
      paid_by: activePaidBy,
      splits,
      receipt_items: receiptItems.map(({ name, price, assigned_to }) => ({
        name,
        price,
        assigned_to,
      })),
    });

    router.push(`/trip/${tripId}`);
  }

  const receiptTotal = receiptItems.reduce((s, i) => s + i.price, 0);
  const activePaidBy = paidBy || defaultPayer;
  const activeReceiptPaidBy = receiptPaidBy || defaultPayer;
  const activeSelectedMembers =
    selectedMembers.length > 0 ? selectedMembers : allMemberIds;

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() =>
              flow === 'receipt' ? setFlow('manual') : router.push(`/trip/${tripId}`)
            }
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
                    selectedMembers={activeSelectedMembers}
                    onSelectedMembersChange={setSelectedMembers}
                    customSplits={customSplits}
                    onCustomSplitsChange={setCustomSplits}
                  />
                </div>
              </>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleManualSave}
                className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium active:opacity-80"
              >
                Add expense
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
                  selectedId={activeReceiptPaidBy}
                  onChange={setReceiptPaidBy}
                  label="PAID BY"
                />
              )}
            </div>

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
                          onClick={() =>
                            setReceiptItems((prev) => prev.filter((i) => i.uid !== item.uid))
                          }
                          className="text-zinc-300 hover:text-red-400 transition-colors text-lg leading-none"
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
                    className="text-sm font-medium text-black disabled:text-zinc-300"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-base font-bold">{fmt(receiptTotal, currency)}</span>
            </div>

            <button
              onClick={handleReceiptSave}
              disabled={receiptItems.length === 0}
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:opacity-80"
            >
              Save expense
            </button>
          </>
        )}
      </div>
    </main>
  );
}
