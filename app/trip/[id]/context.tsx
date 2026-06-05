'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  OptimisticExpense,
  SaveExpenseInput,
  Trip,
  TripDay,
  TripMember,
} from '@/lib/types';

const POLL_MS = 3000;

interface TripContextValue {
  trip: Trip | null;
  members: TripMember[];
  expenses: OptimisticExpense[];
  days: TripDay[];
  loading: boolean;
  reload: () => void;
  saveExpense: (data: SaveExpenseInput) => void;
  deleteExpense: (id: string, userId: string) => Promise<void>;
  saveDay: (name: string, date?: string, ownerId?: string) => Promise<void>;
  deleteDay: (dayId: string, ownerId: string) => Promise<void>;
  saveError: string | null;
  clearSaveError: () => void;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<OptimisticExpense[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const memberRef = useRef<TripMember[]>([]);
  const pendingRef = useRef(false);
  memberRef.current = members;

  const reload = useCallback(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((d) => {
        setTrip(d.trip ?? null);
        setMembers(d.members ?? []);
        setDays(d.days ?? []);
        setExpenses((prev) => {
          const pending = prev.filter((e) => e.pending);
          const fresh = d.expenses ?? [];
          const stillPending = pending.filter(
            (p) =>
              !fresh.some(
                (r: OptimisticExpense) =>
                  r.description === p.description &&
                  Number(r.amount) === Number(p.amount) &&
                  r.paid_by === p.paid_by
              )
          );
          return [...stillPending, ...fresh];
        });
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  function saveExpense(data: SaveExpenseInput) {
    const tempId = `pending-${Date.now()}`;
    const payer = memberRef.current.find((m) => m.user_id === data.paid_by)?.user;

    const optimistic: OptimisticExpense = {
      id: tempId,
      trip_id: tripId,
      paid_by: data.paid_by,
      description: data.description,
      amount: data.amount,
      split_type: data.split_type,
      receipt_url: null,
      created_at: new Date().toISOString(),
      expense_date: data.expense_date ?? null,
      day_id: data.day_id ?? null,
      pending: true,
      payer,
      splits: data.splits.map((s, i) => ({
        id: `pending-split-${i}`,
        expense_id: tempId,
        user_id: s.user_id,
        amount: s.amount,
        is_settled: false,
      })),
    };

    pendingRef.current = true;
    setExpenses((prev) => [optimistic, ...prev]);

    fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId, ...data }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
        pendingRef.current = false;
        reload();
      })
      .catch((err: Error) => {
        pendingRef.current = false;
        setExpenses((prev) => prev.filter((e) => e.id !== tempId));
        setSaveError(err.message ?? 'Failed to save expense. Please try again.');
      });
  }

  async function deleteExpense(id: string, userId: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, trip_owner_id: trip?.owner_id }),
    });
    reload();
  }

  async function saveDay(name: string, date?: string, ownerId?: string) {
    await fetch(`/api/trips/${tripId}/days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date: date || null, owner_id: ownerId }),
    });
    reload();
  }

  async function deleteDay(dayId: string, ownerId: string) {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
    await fetch(`/api/trips/${tripId}/days/${dayId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_id: ownerId }),
    });
    reload();
  }

  return (
    <TripContext.Provider
      value={{
        trip, members, expenses, days, loading, reload,
        saveExpense, deleteExpense, saveDay, deleteDay,
        saveError, clearSaveError: () => setSaveError(null),
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used inside TripProvider');
  return ctx;
}
