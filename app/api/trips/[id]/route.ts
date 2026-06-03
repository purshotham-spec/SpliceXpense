import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const [tripResult, membersResult, expensesResult] = await Promise.all([
    supabase.from('trips').select('*').eq('id', id).single(),
    supabase
      .from('trip_members')
      .select('*, user:users(*)')
      .eq('trip_id', id)
      .order('joined_at'),
    supabase
      .from('expenses')
      .select('*, payer:users!paid_by(*), splits:expense_splits(*, user:users(*))')
      .eq('trip_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (tripResult.error || !tripResult.data) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  return NextResponse.json({
    trip: tripResult.data,
    members: membersResult.data ?? [],
    expenses: expensesResult.data ?? [],
  });
}
