import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user_id } = (await req.json()) as { user_id: string };
  const sb = getSupabase();

  const { data: trip } = await sb.from('trips').select('owner_id').eq('id', params.id).single();
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.owner_id !== user_id) return NextResponse.json({ error: 'Only the owner can delete this trip' }, { status: 403 });

  const { error } = await sb.from('trips').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const sb = getSupabase();

  const [tripResult, membersResult, expensesResult, daysResult] = await Promise.all([
    sb.from('trips').select('*').eq('id', id).single(),
    sb
      .from('trip_members')
      .select('*, user:users!user_id(*)')
      .eq('trip_id', id)
      .order('joined_at'),
    sb
      .from('expenses')
      .select('*, payer:users!paid_by(*), splits:expense_splits(*, user:users!user_id(*))')
      .eq('trip_id', id)
      .order('created_at', { ascending: false }),
    sb
      .from('trip_days')
      .select('*')
      .eq('trip_id', id)
      .order('created_at'),
  ]);

  if (tripResult.error) {
    console.error('Trip fetch error:', tripResult.error);
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      trip: tripResult.data,
      members: membersResult.data ?? [],
      expenses: expensesResult.data ?? [],
      days: daysResult.data ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
