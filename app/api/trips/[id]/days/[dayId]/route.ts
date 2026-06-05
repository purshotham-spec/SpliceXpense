import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; dayId: string } }
) {
  const { owner_id } = await req.json();
  const sb = getSupabase();

  const { data: trip } = await sb.from('trips').select('owner_id').eq('id', params.id).single();
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.owner_id !== owner_id) return NextResponse.json({ error: 'Only the owner can delete days' }, { status: 403 });

  const { error } = await sb.from('trip_days').delete().eq('id', params.dayId).eq('trip_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
