'use client';

import { fmt } from '@/lib/utils';
import type { TripMember } from '@/lib/types';

interface Props {
  members: TripMember[];
  totalAmount: number;
  currency: string;
  splitType: 'equal' | 'custom';
  onSplitTypeChange: (type: 'equal' | 'custom') => void;
  selectedMembers: string[];
  onSelectedMembersChange: (ids: string[]) => void;
  customSplits: Record<string, string>;
  onCustomSplitsChange: (splits: Record<string, string>) => void;
}

export default function SplitSelector({
  members,
  totalAmount,
  currency,
  splitType,
  onSplitTypeChange,
  selectedMembers,
  onSelectedMembersChange,
  customSplits,
  onCustomSplitsChange,
}: Props) {
  function toggleMember(userId: string) {
    if (selectedMembers.includes(userId)) {
      onSelectedMembersChange(selectedMembers.filter((id) => id !== userId));
    } else {
      onSelectedMembersChange([...selectedMembers, userId]);
    }
  }

  const equalShare =
    selectedMembers.length > 0 ? totalAmount / selectedMembers.length : 0;

  const customTotal = Object.entries(customSplits)
    .filter(([id]) => selectedMembers.includes(id))
    .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex border border-zinc-200 rounded-xl overflow-hidden">
        {(['equal', 'custom'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onSplitTypeChange(type)}
            className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
              splitType === type
                ? 'bg-black text-white'
                : 'text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const isSelected = selectedMembers.includes(member.user_id);
          return (
            <div key={member.user_id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleMember(member.user_id)}
                className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-black border-black' : 'border-zinc-300'
                }`}
              >
                {isSelected && (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <span className="flex-1 text-sm">{member.user?.name}</span>

              {splitType === 'equal' ? (
                <span className="text-sm text-zinc-400 w-16 text-right">
                  {isSelected ? fmt(equalShare, currency) : '—'}
                </span>
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={customSplits[member.user_id] ?? ''}
                  disabled={!isSelected}
                  onChange={(e) =>
                    onCustomSplitsChange({
                      ...customSplits,
                      [member.user_id]: e.target.value,
                    })
                  }
                  className="w-20 border border-zinc-200 rounded-lg px-2 py-1 text-sm text-right outline-none focus:border-black disabled:opacity-30"
                />
              )}
            </div>
          );
        })}
      </div>

      {splitType === 'custom' && totalAmount > 0 && (
        <p
          className={`text-xs text-right ${
            Math.abs(customTotal - totalAmount) < 0.01
              ? 'text-green-500'
              : 'text-red-400'
          }`}
        >
          {fmt(customTotal, currency)} of {fmt(totalAmount, currency)}
          {Math.abs(customTotal - totalAmount) >= 0.01 &&
            ` (${fmt(Math.abs(totalAmount - customTotal), currency)} remaining)`}
        </p>
      )}
    </div>
  );
}
