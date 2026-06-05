export interface User {
  id: string;
  name: string;
  phone?: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  currency: string;
  created_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  name: string;
  date?: string | null;
  created_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  joined_at: string;
  user?: User;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  is_settled: boolean;
  user?: User;
}

export interface ReceiptItem {
  id: string;
  expense_id: string;
  name: string;
  price: number;
  assigned_to: string[];
}

export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  description: string;
  amount: number;
  split_type: 'equal' | 'custom' | 'items';
  receipt_url?: string | null;
  created_at: string;
  expense_date?: string | null;
  day_id?: string | null;
  payer?: User;
  splits?: ExpenseSplit[];
  receipt_items?: ReceiptItem[];
}

export interface BalanceTransaction {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  from_user?: User;
  to_user?: User;
}

export interface ParsedReceiptItem {
  name: string;
  price: number;
}

export interface OptimisticExpense extends Expense {
  pending?: boolean;
}

export interface SaveExpenseInput {
  description: string;
  amount: number;
  split_type: 'equal' | 'custom' | 'items';
  paid_by: string;
  expense_date?: string;
  day_id?: string | null;
  splits: { user_id: string; amount: number }[];
  receipt_items?: { name: string; price: number; assigned_to: string[] }[];
}

export interface TripData {
  trip: Trip;
  members: TripMember[];
  expenses: Expense[];
}
