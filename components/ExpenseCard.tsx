import { fmt } from '@/lib/utils';
import type { OptimisticExpense } from '@/lib/types';

interface Props {
  expense: OptimisticExpense;
  currency: string;
  currentUserId: string;
  tripOwnerId?: string;
  activeMemberIds?: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function ExpenseCard({ expense, currency, currentUserId, tripOwnerId, activeMemberIds, onEdit, onDelete }: Props) {
  const myShare = expense.splits?.find((s) => s.user_id === currentUserId)?.amount;
  const activeSplits = activeMemberIds
    ? (expense.splits ?? []).filter((s) => activeMemberIds.includes(s.user_id))
    : (expense.splits ?? []);
  const splitCount = activeSplits.length;
  const canAct = !expense.pending && (currentUserId === expense.paid_by || currentUserId === tripOwnerId);
  const canDelete = canAct && !!onDelete;
  const canEdit = canAct && !!onEdit;

  return (
    <div
      className={`bg-white rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${
        expense.pending ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">
        🧾
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black truncate">{expense.description}</p>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">
          {expense.pending ? (
            <span className="text-zinc-300">Saving…</span>
          ) : (
            <>
              Paid by {expense.payer?.name ?? '—'}
              {splitCount > 0 && ` · ${splitCount} people`}
              {expense.expense_date && ` · ${new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            </>
          )}
        </p>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <div>
          <p className="text-sm font-bold text-black">{fmt(expense.amount, currency)}</p>
          {!expense.pending && myShare !== undefined && (
            <p className="text-xs text-zinc-400">you: {fmt(myShare, currency)}</p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => onEdit!(expense.id)}
            className="text-zinc-300 hover:text-black transition-colors leading-none"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => {
              if (confirm(`Delete "${expense.description}"?`)) onDelete!(expense.id);
            }}
            className="text-zinc-300 hover:text-red-400 transition-colors text-xl leading-none"
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
