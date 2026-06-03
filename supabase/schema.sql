-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)),
  owner_id    UUID REFERENCES users(id),
  currency    TEXT NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trip members
CREATE TABLE IF NOT EXISTS trip_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  split_type  TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'items')),
  receipt_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits (who owes what per expense)
CREATE TABLE IF NOT EXISTS expense_splits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      NUMERIC(10,2) NOT NULL,
  is_settled  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(expense_id, user_id)
);

-- Receipt line items (extracted by AI)
CREATE TABLE IF NOT EXISTS receipt_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  assigned_to UUID[] DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Open policies for P0 (server uses service role key, bypasses RLS)
-- These allow the anon key to read as fallback — lock down later
CREATE POLICY "allow_all" ON users          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON trips          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON trip_members   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expense_splits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON receipt_items  FOR ALL USING (true) WITH CHECK (true);
