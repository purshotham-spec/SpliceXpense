import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user_id } = await req.json() as { user_id: string };

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  // Upsert so rejoining the same trip is idempotent
  const { data, error } = await supabase
    .from('trip_members')
    .upsert({ trip_id: params.id, user_id }, { onConflict: 'trip_id,user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
