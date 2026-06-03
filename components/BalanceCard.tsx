'use client';

import { fmt } from '@/lib/utils';
import type { BalanceTransaction } from '@/lib/types';

interface Props {
  transaction: BalanceTransaction;
  currency: string;
  tripId: string;
}

function Avatar({ name }: { name?: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export default function BalanceCard({ transaction, currency, tripId }: Props) {
  const { from_user, to_user, amount } = transaction;

  function buildWhatsAppUrl() {
    const tripUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/trip/${tripId}`
        : '';
    const text = `Hey ${from_user?.name ?? 'there'}, you owe ${to_user?.name ?? 'someone'} ${fmt(amount, currency)}. Settle up: ${tripUrl}`;
    const phone = from_user?.phone?.replace(/\D/g, '');
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Avatar name={from_user?.name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{from_user?.name ?? '—'}</p>
          <p className="text-xs text-zinc-400">owes</p>
        </div>
        <div className="text-center px-2">
          <p className="text-base font-bold">{fmt(amount, currency)}</p>
          <p className="text-xs text-zinc-400">→</p>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-medium truncate">{to_user?.name ?? '—'}</p>
          <p className="text-xs text-zinc-400">gets paid</p>
        </div>
        <Avatar name={to_user?.name} />
      </div>
      <button
        onClick={() => window.open(buildWhatsAppUrl(), '_blank')}
        className="w-full bg-[#25D366] text-white rounded-xl py-2.5 text-sm font-medium active:opacity-80"
      >
        Remind on WhatsApp
      </button>
    </div>
  );
}
