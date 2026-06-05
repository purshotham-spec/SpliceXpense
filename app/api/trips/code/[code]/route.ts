import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const sb = getSupabase();
  const { data: trip, error } = await sb
    .from('trips')
    .select('*')
    .eq('invite_code', params.code.toUpperCase())
    .single();

  if (error || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const { data: members } = await sb
    .from('trip_members')
    .select('*, user:users!user_id(*)')
    .eq('trip_id', trip.id)
    .order('joined_at');

  return NextResponse.json({ trip, members: members ?? [] });
}
