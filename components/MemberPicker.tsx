'use client';

import type { TripMember } from '@/lib/types';

interface Props {
  members: TripMember[];
  selectedId: string;
  onChange: (id: string) => void;
  label: string;
}

export default function MemberPicker({ members, selectedId, onChange, label }: Props) {
  return (
    <div>
      <p className="text-xs text-zinc-400 font-medium mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {members.map((m) => (
          <button
            key={m.user_id}
            type="button"
            onClick={() => onChange(m.user_id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedId === m.user_id
                ? 'bg-black text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {m.user?.name}
          </button>
        ))}
      </div>
    </div>
  );
}
