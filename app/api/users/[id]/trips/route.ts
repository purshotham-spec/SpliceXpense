import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await getSupabase()
    .from('trip_members')
    .select('trip:trips(*)')
    .eq('user_id', params.id)
    .order('joined_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const trips = (data ?? []).map((r: any) => r.trip).filter(Boolean);
  return NextResponse.json(trips, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
