import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { phone, upi_id } = await req.json();
  const sb = getSupabase();

  const update: Record<string, string | null> = {};
  if (phone !== undefined) update.phone = phone?.trim() || null;
  if (upi_id !== undefined) update.upi_id = upi_id?.trim() || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await sb.from('users').update(update).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
