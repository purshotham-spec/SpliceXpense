import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user_id } = (await req.json()) as { user_id: string };
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const sb = getSupabase();

  // Owner cannot leave — they must delete the trip
  const { data: trip } = await sb.from('trips').select('owner_id').eq('id', params.id).single();
  if (trip?.owner_id === user_id) {
    return NextResponse.json({ error: 'Owner cannot leave. Delete the trip instead.' }, { status: 400 });
  }

  const { error } = await sb
    .from('trip_members')
    .delete()
    .eq('trip_id', params.id)
    .eq('user_id', user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
