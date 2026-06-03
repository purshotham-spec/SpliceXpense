import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, currency, owner_id } = body as {
    name: string;
    currency: string;
    owner_id: string;
  };

  if (!name?.trim() || !owner_id) {
    return NextResponse.json({ error: 'name and owner_id are required' }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: trip, error: tripError } = await sb
    .from('trips')
    .insert({ name: name.trim(), currency: currency || 'USD', owner_id })
    .select()
    .single();

  if (tripError) {
    console.error('Create trip error:', tripError);
    return NextResponse.json({ error: tripError.message }, { status: 500 });
  }

  // Owner is automatically a member
  const { error: memberError } = await sb
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: owner_id });

  if (memberError) {
    console.error('Add owner as member error:', memberError);
  }

  return NextResponse.json(trip, { status: 201 });
}
