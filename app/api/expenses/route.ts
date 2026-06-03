import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

interface SplitInput {
  user_id: string;
  amount: number;
}

interface ReceiptItemInput {
  name: string;
  price: number;
  assigned_to: string[];
}

interface ExpenseBody {
  trip_id: string;
  paid_by: string;
  description: string;
  amount: number;
  split_type: 'equal' | 'custom' | 'items';
  splits: SplitInput[];
  receipt_items?: ReceiptItemInput[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ExpenseBody;
  const { trip_id, paid_by, description, amount, split_type, splits, receipt_items } = body;

  if (!trip_id || !paid_by || !description || !amount || !splits?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: expense, error: expenseError } = await sb
    .from('expenses')
    .insert({ trip_id, paid_by, description, amount, split_type })
    .select()
    .single();

  if (expenseError) {
    console.error('Create expense error:', expenseError);
    return NextResponse.json({ error: expenseError.message }, { status: 500 });
  }

  const { error: splitsError } = await sb
    .from('expense_splits')
    .insert(splits.map((s) => ({ expense_id: expense.id, user_id: s.user_id, amount: s.amount })));

  if (splitsError) {
    console.error('Create splits error:', splitsError);
    return NextResponse.json({ error: splitsError.message }, { status: 500 });
  }

  if (receipt_items?.length) {
    const { error: itemsError } = await sb.from('receipt_items').insert(
      receipt_items.map((item) => ({
        expense_id: expense.id,
        name: item.name,
        price: item.price,
        assigned_to: item.assigned_to,
      }))
    );
    if (itemsError) console.error('Create receipt items error:', itemsError);
  }

  return NextResponse.json(expense, { status: 201 });
}
