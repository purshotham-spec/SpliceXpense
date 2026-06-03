import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const { requester_id } = (await req.json()) as { requester_id: string };
  const sb = getSupabase();

  const { data: trip } = await sb.from('trips').select('owner_id').eq('id', params.id).single();
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.owner_id !== requester_id) return NextResponse.json({ error: 'Only the owner can remove members' }, { status: 403 });
  if (params.userId === requester_id) return NextResponse.json({ error: 'Owner cannot remove themselves' }, { status: 400 });

  const { error } = await sb
    .from('trip_members')
    .delete()
    .eq('trip_id', params.id)
    .eq('user_id', params.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
