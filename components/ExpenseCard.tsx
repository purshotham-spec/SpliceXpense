import { fmt } from '@/lib/utils';
import type { Expense } from '@/lib/types';

interface Props {
  expense: Expense;
  currency: string;
  currentUserId: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍽️',
  drink: '🍺',
  transport: '🚗',
  hotel: '🏨',
  activity: '🎭',
  default: '🧾',
};

export default function ExpenseCard({ expense, currency, currentUserId }: Props) {
  const myShare = expense.splits?.find((s) => s.user_id === currentUserId)?.amount;
  const splitCount = expense.splits?.length ?? 0;

  return (
    <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">
        {CATEGORY_EMOJI.default}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black truncate">{expense.description}</p>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">
          Paid by {expense.payer?.name ?? '—'}
          {splitCount > 0 && ` · ${splitCount} people`}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-black">{fmt(expense.amount, currency)}</p>
        {myShare !== undefined && (
          <p className="text-xs text-zinc-400">
            you: {fmt(myShare, currency)}
          </p>
        )}
      </div>
    </div>
  );
}
