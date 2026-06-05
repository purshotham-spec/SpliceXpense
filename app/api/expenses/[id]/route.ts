import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await getSupabase()
    .from('expenses')
    .select('*, splits:expense_splits(*)')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { user_id, trip_owner_id, description, amount, split_type, paid_by, expense_date, day_id, splits } = body;
  const sb = getSupabase();

  const { data: expense } = await sb.from('expenses').select('paid_by').eq('id', params.id).single();
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const canEdit = expense.paid_by === user_id || trip_owner_id === user_id;
  if (!canEdit) return NextResponse.json({ error: 'Only the payer or trip owner can edit this expense' }, { status: 403 });

  const splitTotal = Math.round(splits.reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0) * 100);
  const expenseTotal = Math.round(Number(amount) * 100);
  if (Math.abs(splitTotal - expenseTotal) > 1) {
    return NextResponse.json({ error: `Split total (${splitTotal / 100}) doesn't match expense amount (${expenseTotal / 100})` }, { status: 400 });
  }

  const { error: updateError } = await sb
    .from('expenses')
    .update({ description, amount, split_type, paid_by, expense_date: expense_date ?? null, day_id: day_id ?? null })
    .eq('id', params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await sb.from('expense_splits').delete().eq('expense_id', params.id);

  const { error: splitsError } = await sb
    .from('expense_splits')
    .insert(splits.map((s: { user_id: string; amount: number }) => ({ expense_id: params.id, user_id: s.user_id, amount: s.amount })));
  if (splitsError) return NextResponse.json({ error: splitsError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

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
