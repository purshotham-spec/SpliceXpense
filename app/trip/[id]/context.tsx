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
  TripMember,
} from '@/lib/types';

interface TripContextValue {
  trip: Trip | null;
  members: TripMember[];
  expenses: OptimisticExpense[];
  loading: boolean;
  reload: () => void;
  saveExpense: (data: SaveExpenseInput) => void;
  saveError: string | null;
  clearSaveError: () => void;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<OptimisticExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const memberRef = useRef<TripMember[]>([]);
  memberRef.current = members;

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((d) => {
        setTrip(d.trip ?? null);
        setMembers(d.members ?? []);
        setExpenses(d.expenses ?? []);
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => {
    reload();
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  function saveExpense(data: SaveExpenseInput) {
    const tempId = `pending-${Date.now()}`;
    const payer = memberRef.current.find((m) => m.user_id === data.paid_by)?.user;

    // Add optimistic item immediately
    const optimistic: OptimisticExpense = {
      id: tempId,
      trip_id: tripId,
      paid_by: data.paid_by,
      description: data.description,
      amount: data.amount,
      split_type: data.split_type,
      receipt_url: null,
      created_at: new Date().toISOString(),
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

    setExpenses((prev) => [optimistic, ...prev]);

    // Save in background
    fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId, ...data }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
        reload(); // swap optimistic for real data silently
      })
      .catch((err: Error) => {
        setExpenses((prev) => prev.filter((e) => e.id !== tempId));
        setSaveError(err.message ?? 'Failed to save expense. Please try again.');
      });
  }

  return (
    <TripContext.Provider
      value={{
        trip,
        members,
        expenses,
        loading,
        reload,
        saveExpense,
        saveError,
        clearSaveError: () => setSaveError(null),
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
