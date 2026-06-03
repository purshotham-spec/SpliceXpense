import type { BalanceTransaction, Expense, ExpenseSplit, TripMember } from './types';

export function distributeEvenly(
  totalCents: number,
  memberIds: string[]
): { user_id: string; amount: number }[] {
  const n = memberIds.length;
  if (n === 0) return [];
  const baseUnits = Math.floor(totalCents / n);
  const remainder = totalCents - baseUnits * n;
  return memberIds.map((id, i) => ({
    user_id: id,
    amount: (baseUnits + (i < remainder ? 1 : 0)) / 100,
  }));
}

export function calculateBalances(
  members: TripMember[],
  expenses: Expense[],
  splits: ExpenseSplit[]
): BalanceTransaction[] {
  // net balance per user: positive = owed money, negative = owes money
  const balance: Record<string, number> = {};
  members.forEach((m) => { balance[m.user_id] = 0; });

  expenses.forEach((e) => {
    if (balance[e.paid_by] !== undefined) {
      balance[e.paid_by] += Number(e.amount);
    }
  });

  splits.forEach((s) => {
    if (balance[s.user_id] !== undefined) {
      balance[s.user_id] -= Number(s.amount);
    }
  });

  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];

  Object.entries(balance).forEach(([id, amt]) => {
    if (amt > 0.01) creditors.push({ id, amt });
    else if (amt < -0.01) debtors.push({ id, amt: Math.abs(amt) });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transactions: BalanceTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amt, debtors[j].amt);
    if (amount > 0.01) {
      transactions.push({
        from_user_id: debtors[j].id,
        to_user_id: creditors[i].id,
        amount: Math.round(amount * 100) / 100,
      });
    }
    creditors[i].amt -= amount;
    debtors[j].amt -= amount;
    if (creditors[i].amt < 0.01) i++;
    if (debtors[j].amt < 0.01) j++;
  }

  return transactions;
}
