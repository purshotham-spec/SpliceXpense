import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({ name: name.trim(), currency: currency || 'USD', owner_id })
    .select()
    .single();

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  // Owner is automatically a member
  await supabase
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: owner_id });

  return NextResponse.json(trip, { status: 201 });
}
