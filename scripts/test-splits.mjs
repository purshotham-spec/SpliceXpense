// Run: node scripts/test-splits.mjs
// Tests distributeEvenly + calculateBalances against a 6-person trip scenario

// ── Inline the functions under test ──────────────────────────────────────────

function distributeEvenly(totalCents, memberIds) {
  const n = memberIds.length;
  if (n === 0) return [];
  const baseUnits = Math.floor(totalCents / n);
  const remainder = totalCents - baseUnits * n;
  return memberIds.map((id, i) => ({
    user_id: id,
    amount: (baseUnits + (i < remainder ? 1 : 0)) / 100,
  }));
}

function calculateBalances(members, expenses, splits) {
  const balance = {};
  members.forEach((m) => { balance[m.user_id] = 0; });
  expenses.forEach((e) => { if (balance[e.paid_by] !== undefined) balance[e.paid_by] += Number(e.amount); });
  splits.forEach((s) => { if (balance[s.user_id] !== undefined) balance[s.user_id] -= Number(s.amount); });

  const creditors = [], debtors = [];
  Object.entries(balance).forEach(([id, amt]) => {
    if (amt > 0.01) creditors.push({ id, amt });
    else if (amt < -0.01) debtors.push({ id, amt: Math.abs(amt) });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transactions = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amt, debtors[j].amt);
    if (amount > 0.01) transactions.push({ from: debtors[j].id, to: creditors[i].id, amount: Math.round(amount * 100) / 100 });
    creditors[i].amt -= amount;
    debtors[j].amt -= amount;
    if (creditors[i].amt < 0.01) i++;
    if (debtors[j].amt < 0.01) j++;
  }
  return transactions;
}

// ── People ────────────────────────────────────────────────────────────────────
const ALICE = 'alice', BOB = 'bob', CHARLIE = 'charlie';
const DIANA = 'diana', EVE = 'eve', FRANK = 'frank';
const ALL = [ALICE, BOB, CHARLIE, DIANA, EVE, FRANK];
const names = { alice:'Alice', bob:'Bob', charlie:'Charlie', diana:'Diana', eve:'Eve', frank:'Frank' };

const members = ALL.map(id => ({ user_id: id, id, user: { name: names[id] } }));

// ── Expenses + splits ─────────────────────────────────────────────────────────
const expenses = [], allSplits = [];
let expId = 0;

function addExpense(desc, payerId, amount, splitIds, customAmounts = null) {
  const id = `e${++expId}`;
  expenses.push({ id, paid_by: payerId, amount, description: desc });
  const splits = customAmounts
    ? splitIds.map((uid, i) => ({ id: `s${id}-${i}`, expense_id: id, user_id: uid, amount: customAmounts[i] }))
    : distributeEvenly(Math.round(amount * 100), splitIds).map((s, i) => ({ id: `s${id}-${i}`, expense_id: id, user_id: s.user_id, amount: s.amount }));
  allSplits.push(...splits);

  // Verify splits sum to expense total
  const splitSum = splits.reduce((acc, s) => acc + s.amount, 0);
  const ok = Math.abs(splitSum - amount) < 0.02;
  const splitDetail = splits.map(s => `${names[s.user_id]}:₹${s.amount}`).join(', ');
  console.log(`${ok ? '✓' : '✗ ROUNDING ERROR'} ${desc.padEnd(22)} | Paid by ${names[payerId].padEnd(7)} ₹${String(amount).padStart(7)} | Split: ${splitDetail}`);
  if (!ok) console.log(`  !! Sum of splits: ${splitSum} ≠ ${amount}`);
  return splits;
}

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(' GOA TRIP 2026 — 6 People Split Verification');
console.log('══════════════════════════════════════════════════════════════════\n');
console.log('EXPENSES\n');

// 1. Hotel — all 6, divides evenly
addExpense('Hotel (3 nights)',   ALICE,   18000, ALL);

// 2. Flights — all 6, divides evenly
addExpense('Flight tickets',     BOB,     24000, ALL);

// 3. Dinner Day 1 — only 4 people, divides evenly
addExpense('Dinner Day 1',       CHARLIE,  4500, [ALICE, BOB, CHARLIE, DIANA]);

// 4. Scuba diving — only 3 people, divides evenly
addExpense('Scuba diving',       DIANA,   12000, [DIANA, EVE, FRANK]);

// 5. Groceries — all 6, divides evenly
addExpense('Groceries',          EVE,      3600, ALL);

// 6. Bar night — 4 people, divides evenly
addExpense('Bar night',          FRANK,    7000, [BOB, CHARLIE, EVE, FRANK]);

// 7. Airport transfer — all 6, divides evenly
addExpense('Airport transfer',   ALICE,    2400, ALL);

// 8. Lunch custom — Bob paid, unequal shares (tests custom split path)
addExpense('Lunch (custom)',     BOB,      1800,
  [ALICE, BOB, CHARLIE, DIANA, EVE, FRANK],
  [200, 300, 400, 250, 350, 300]
);

// 9. Sightseeing — 3 people, ₹1000 DOES NOT divide evenly (100000 paise / 3)
addExpense('Sightseeing (odd)',  CHARLIE,  1000, [CHARLIE, DIANA, FRANK]);

// 10. Cafe snacks — 5 people, ₹370 is tricky (37000 / 5 = 7400 exactly)
addExpense('Cafe snacks',        EVE,       370, [ALICE, BOB, CHARLIE, EVE, FRANK]);

// 11. Boat ride — 4 people, ₹1100 (110000 / 4 = 27500, exact)
addExpense('Boat ride',          FRANK,    1100, [ALICE, DIANA, EVE, FRANK]);

// 12. Petrol — all 6, ₹777 (77700 / 6 = 12950 exactly)
addExpense('Petrol',             BOB,       777, ALL);

// 13. Souvenirs — 3 people, ₹500 (50000 / 3 → tricky)
addExpense('Souvenirs (odd)',    DIANA,     500, [ALICE, BOB, DIANA]);

// ── Net balances ──────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────────────────');
console.log('NET BALANCES\n');

const paid = {}, owes = {};
ALL.forEach(id => { paid[id] = 0; owes[id] = 0; });
expenses.forEach(e => paid[e.paid_by] += e.amount);
allSplits.forEach(s => owes[s.user_id] += s.amount);

const nets = {};
ALL.forEach(id => {
  nets[id] = Math.round((paid[id] - owes[id]) * 100) / 100;
  const sign = nets[id] > 0 ? '+' : '';
  console.log(`  ${names[id].padEnd(8)} paid ₹${String(paid[id]).padStart(7)}  owes ₹${String(Math.round(owes[id]*100)/100).padStart(8)}  net ${sign}₹${nets[id]}`);
});

const totalNet = Math.round(Object.values(nets).reduce((a, b) => a + b, 0) * 100) / 100;
console.log(`\n  Zero-sum check: ${totalNet === 0 ? '✓ nets sum to 0' : '✗ ERROR nets sum to ' + totalNet}`);

// ── Settlements ───────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────────────────');
console.log('OPTIMAL SETTLEMENTS\n');

const txns = calculateBalances(members, expenses, allSplits);
txns.forEach((t, i) => {
  console.log(`  ${i+1}. ${names[t.from].padEnd(8)} → ${names[t.to].padEnd(8)} ₹${t.amount}`);
});

const settleSum = Math.round(txns.reduce((a, t) => a + t.amount, 0) * 100) / 100;
const totalPaid  = expenses.reduce((a, e) => a + e.amount, 0);
console.log(`\n  Transactions needed : ${txns.length} (min possible = ${ALL.length - 1})`);
console.log(`  Total money settled : ₹${settleSum}`);
console.log(`  Total trip spend    : ₹${totalPaid}`);

// Verify each person's settlement zeroes out
console.log('\n──────────────────────────────────────────────────────────────────');
console.log('SETTLEMENT VERIFICATION (net + settlements must = 0)\n');
const residual = {};
ALL.forEach(id => residual[id] = nets[id]);
txns.forEach(t => { residual[t.from] += t.amount; residual[t.to] -= t.amount; });
ALL.forEach(id => {
  const r = Math.round(residual[id] * 100) / 100;
  console.log(`  ${names[id].padEnd(8)} residual: ${r === 0 ? '✓ 0' : '✗ ' + r}`);
});
console.log('\n══════════════════════════════════════════════════════════════════\n');
