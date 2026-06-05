import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user_id, trip_owner_id } = (await req.json()) as { user_id: string; trip_owner_id: string };
  const sb = getSupabase();

  const { data: expense } = await sb.from('expenses').select('paid_by').eq('id', params.id).single();
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const canDelete = expense.paid_by === user_id || trip_owner_id === user_id;
  if (!canDelete) return NextResponse.json({ error: 'Only the payer or trip owner can delete this expense' }, { status: 403 });

  const { error } = await sb.from('expenses').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
