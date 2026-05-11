/* ============================================================
   Frizz — Money Manager  |  app.js
   ============================================================ */

// ── CATEGORY CONFIG ──────────────────────────────────────────
const CATEGORIES = [
  { id: 'shopping',   label: '🛒 Shopping / Daily Life', color: '#38bdf8' },
  { id: 'parents',    label: '👨‍👩‍👧 Money for Parents',    color: '#f472b6' },
  { id: 'savings',    label: '🏦 Savings',               color: '#22c55e' },
  { id: 'investment', label: '📈 Investment',             color: '#a78bfa' },
  { id: 'hobbies',    label: '🎮 Hobbies',               color: '#fb923c' },
  { id: 'debt',       label: '💳 Debt',                  color: '#ef4444' },
];

// ── STATE ─────────────────────────────────────────────────────
let transactions = loadFromStorage('frizz_transactions') || [];
let allocations  = loadFromStorage('frizz_allocations')  || defaultAllocations();

function defaultAllocations() {
  // default split: 40/20/15/10/10/5
  const defaults = { shopping: 40, parents: 20, savings: 15, investment: 10, hobbies: 10, debt: 5 };
  return defaults;
}

// ── STORAGE HELPERS ───────────────────────────────────────────
function saveTransactions() { localStorage.setItem('frizz_transactions', JSON.stringify(transactions)); }
function saveAllocations()  { localStorage.setItem('frizz_allocations',  JSON.stringify(allocations)); }
function loadFromStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

// ── FORMAT CURRENCY ───────────────────────────────────────────
function fmt(n) {
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

// ── COMPUTE TOTALS ────────────────────────────────────────────
function computeTotals() {
  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  // spent per category (expenses only)
  const spentByCategory = {};
  CATEGORIES.forEach(c => { spentByCategory[c.id] = 0; });
  transactions.filter(t => t.type === 'expense').forEach(t => {
    if (spentByCategory[t.category] !== undefined) spentByCategory[t.category] += t.amount;
  });

  // budget per category based on allocation %
  const budgetByCategory = {};
  CATEGORIES.forEach(c => {
    budgetByCategory[c.id] = (allocations[c.id] / 100) * totalIncome;
  });

  return { totalIncome, totalExpense, balance, spentByCategory, budgetByCategory };
}

// ── RENDER SUMMARY CARDS ──────────────────────────────────────
function renderSummary() {
  const { totalIncome, totalExpense, balance } = computeTotals();

  document.getElementById('totalIncome').textContent  = fmt(totalIncome);
  document.getElementById('totalExpense').textContent = fmt(totalExpense);
  document.getElementById('balance').textContent      = (balance < 0 ? '- ' : '') + fmt(balance);

  const balanceCard = document.getElementById('balanceCard');
  if (balance < 0) {
    balanceCard.classList.add('over-budget');
  } else {
    balanceCard.classList.remove('over-budget');
  }

  // warning banner
  const banner = document.getElementById('warningBanner');
  if (totalExpense > totalIncome && totalIncome > 0) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// ── RENDER ALLOCATION INPUTS ──────────────────────────────────
function renderAllocationGrid() {
  const grid = document.getElementById('allocationGrid');
  grid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'alloc-item';
    item.innerHTML = `
      <span class="alloc-dot" style="background:${cat.color}"></span>
      <span class="alloc-label">${cat.label}</span>
      <input class="alloc-input" type="number" min="0" max="100"
             data-cat="${cat.id}" value="${allocations[cat.id]}" />
      <span class="alloc-pct">%</span>
    `;
    grid.appendChild(item);
  });

  updateAllocTotal();

  // listen for changes
  grid.querySelectorAll('.alloc-input').forEach(input => {
    input.addEventListener('input', () => {
      const cat = input.dataset.cat;
      allocations[cat] = parseFloat(input.value) || 0;
      saveAllocations();
      updateAllocTotal();
      renderBudgetOverview();
    });
  });
}

function updateAllocTotal() {
  const total = CATEGORIES.reduce((s, c) => s + (allocations[c.id] || 0), 0);
  const el    = document.getElementById('allocTotal');
  const warn  = document.getElementById('allocWarning');
  el.textContent = total + '%';
  el.style.color = total === 100 ? '#22c55e' : '#f59e0b';
  warn.classList.toggle('hidden', total === 100);
}

// ── RENDER BUDGET OVERVIEW ────────────────────────────────────
function renderBudgetOverview() {
  const { spentByCategory, budgetByCategory } = computeTotals();
  const grid = document.getElementById('budgetGrid');
  grid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const spent  = spentByCategory[cat.id];
    const budget = budgetByCategory[cat.id];
    const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over   = spent > budget && budget > 0;

    const item = document.createElement('div');
    item.className = 'budget-item';
    item.innerHTML = `
      <div class="budget-item-header">
        <span class="budget-item-name">
          <span class="budget-dot" style="background:${cat.color}"></span>
          ${cat.label}
        </span>
        <span class="budget-amounts">
          <span style="color:${over ? '#ef4444' : cat.color}">${fmt(spent)}</span>
          / ${fmt(budget)}
        </span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${over ? 'over' : ''}"
             style="width:${pct}%; background:${over ? '' : cat.color}"></div>
      </div>
    `;
    grid.appendChild(item);
  });
}

// ── RENDER TRANSACTION LIST ───────────────────────────────────
function renderTransactions() {
  const filterType     = document.getElementById('filterType').value;
  const filterCategory = document.getElementById('filterCategory').value;

  let list = [...transactions].reverse(); // newest first

  if (filterType !== 'all')     list = list.filter(t => t.type === filterType);
  if (filterCategory !== 'all') list = list.filter(t => t.category === filterCategory);

  const container = document.getElementById('txList');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<p class="empty-state">No transactions match your filter.</p>';
    return;
  }

  list.forEach(tx => {
    const cat  = CATEGORIES.find(c => c.id === tx.category);
    const item = document.createElement('div');
    item.className = 'tx-item';

    const catBadge = tx.type === 'expense' && cat
      ? `<span class="tx-badge badge-${cat.id}">${cat.label}</span>`
      : `<span class="tx-badge" style="background:rgba(34,197,94,.15);color:#22c55e">Income</span>`;

    item.innerHTML = `
      <span class="tx-type-dot ${tx.type}"></span>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.desc)}</div>
        <div class="tx-meta">${tx.date}</div>
      </div>
      ${catBadge}
      <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'} ${fmt(tx.amount)}</span>
      <button class="tx-delete" data-id="${tx.id}" aria-label="Delete transaction">✕</button>
    `;
    container.appendChild(item);
  });

  // delete buttons
  container.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteTransaction(btn.dataset.id);
    });
  });
}

// ── ADD TRANSACTION ───────────────────────────────────────────
document.getElementById('txForm').addEventListener('submit', e => {
  e.preventDefault();

  const desc     = document.getElementById('txDesc').value.trim();
  const amount   = parseFloat(document.getElementById('txAmount').value);
  const type     = document.getElementById('txType').value;
  const category = document.getElementById('txCategory').value;
  const date     = document.getElementById('txDate').value;

  if (!desc || !amount || !date) return;

  const tx = {
    id: Date.now().toString(),
    desc,
    amount,
    type,
    category: type === 'income' ? 'income' : category,
    date,
  };

  transactions.push(tx);
  saveTransactions();
  renderAll();

  // reset form (keep date & type)
  document.getElementById('txDesc').value   = '';
  document.getElementById('txAmount').value = '';
});

// ── DELETE TRANSACTION ────────────────────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

// ── CLEAR ALL ─────────────────────────────────────────────────
document.getElementById('clearAll').addEventListener('click', () => {
  if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
  transactions = [];
  saveTransactions();
  renderAll();
});

// ── FILTERS ───────────────────────────────────────────────────
document.getElementById('filterType').addEventListener('change', renderTransactions);
document.getElementById('filterCategory').addEventListener('change', renderTransactions);

// ── SHOW/HIDE CATEGORY SELECT ─────────────────────────────────
document.getElementById('txType').addEventListener('change', function () {
  const catGroup = document.getElementById('categoryGroup');
  catGroup.style.opacity  = this.value === 'income' ? '0.4' : '1';
  catGroup.style.pointerEvents = this.value === 'income' ? 'none' : 'auto';
});

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── SET DEFAULT DATE ──────────────────────────────────────────
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('txDate').value = today;
}

// ── RENDER ALL ────────────────────────────────────────────────
function renderAll() {
  renderSummary();
  renderBudgetOverview();
  renderTransactions();
}

// ── INIT ──────────────────────────────────────────────────────
setDefaultDate();
renderAllocationGrid();
renderAll();
