# Splice — Setup Guide

## You need three things

1. **Supabase account** — free at supabase.com  
2. **Anthropic API key** — for receipt scanning (console.anthropic.com)  
3. **Vercel account** — free deployment (vercel.com)

---

## Step 1 — Supabase database

1. Go to [supabase.com](https://supabase.com) → New project (remember the DB password)
2. Open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - `Project URL`  
   - `service_role` key (under "Project API keys", click to reveal)

---

## Step 2 — Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Step 3 — Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Step 4 — Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Or push to GitHub and connect the repo at [vercel.com/new](https://vercel.com/new).

Add the three environment variables in Vercel → Project Settings → Environment Variables.

---

## What's in P0

| Feature | Done |
|---------|------|
| Create trip with invite code + QR | ✅ |
| Join trip with name + phone | ✅ |
| Add expense manually | ✅ |
| Equal or custom splits | ✅ |
| Camera / photo → AI line items | ✅ |
| Assign receipt items per person | ✅ |
| Add missing items manually | ✅ |
| Balances (who owes who, optimized) | ✅ |
| WhatsApp reminder per person | ✅ |
| Share all splits via WhatsApp | ✅ |
| Share trip invite link | ✅ |

## Coming in P1

- Settlement optimizer (fewer transactions)
- PDF / CSV export  
- Multi-currency + FX conversion  
- Expense categories  
- Partial settlement tracking  
- Offline PWA support  
