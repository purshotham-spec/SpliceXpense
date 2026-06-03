import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', params.code.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
