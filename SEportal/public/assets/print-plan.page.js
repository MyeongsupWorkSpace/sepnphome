PortalStore.hydrate(['sepnp_print_slots']).then(() => {
  const empNo = sessionStorage.getItem('sepnp_emp_no');
  if (!empNo) {
    window.location.href = 'index.html';
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('sepnp_emp_no');
      window.location.href = 'index.html';
    });
  }

  const SLOT_COUNT = 15;
  const ASSIGN_KEY = 'sepnp_assign_v2';
  const PRESSES = ['1호기', '2호기', '3호기'];

  function fmtYMD(date) {
    const yy = String(date.getFullYear() % 100).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}년${mm}월${dd}일`;
  }
  (function setDates() {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 7);
    const title = document.getElementById('planTitle');
    title.textContent = `인쇄주간계획표 (예: ${fmtYMD(today)} - ${String(end.getMonth() + 1).padStart(2, '0')}월${String(
      end.getDate()
    ).padStart(2, '0')}일)`;
  })();

  function loadAssign() {
    let assign;
    try {
      assign = JSON.parse(localStorage.getItem(ASSIGN_KEY) || '{}');
    } catch {
      assign = {};
    }
    if (!assign || typeof assign !== 'object') assign = {};
    if (!assign.lanes || typeof assign.lanes !== 'object') assign.lanes = {};
    PRESSES.forEach((p) => {
      if (!Array.isArray(assign.lanes[p])) assign.lanes[p] = [];
    });
    return assign;
  }

  function buildSlotsFromAssign(assign) {
    const slots = {};
    for (let m = 1; m <= 3; m++) {
      for (let r = 1; r <= SLOT_COUNT; r++) {
        slots[`m${m}-${r}`] = null;
      }
    }
    PRESSES.forEach((press, idx) => {
      const list = assign.lanes[press] || [];
      list.forEach((card, i) => {
        if (i >= SLOT_COUNT) return;
        const key = `m${idx + 1}-${i + 1}`;
        slots[key] = {
          id: card.orderId || card.id || `row_${idx + 1}_${i + 1}`,
          name: card.productName || card.title || '미상',
          qty: card.quantity ?? card.qty ?? 0,
          due: card.dueDate || card.due || '',
          proc: '인쇄'
        };
      });
    });
    return slots;
  }

  function showToast(msg) {
    const root = document.getElementById('toastRoot');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 1800);
  }

  function renderGrid() {
    const assign = loadAssign();
    const slots = buildSlotsFromAssign(assign);
    const grid = document.getElementById('planGrid');
    grid.innerHTML = '';
    grid.appendChild(makeHeadCell('#', 'num'));
    grid.appendChild(makeHeadCell('인쇄 1호기'));
    grid.appendChild(makeHeadCell('인쇄 2호기'));
    grid.appendChild(makeHeadCell('인쇄 3호기'));

    for (let row = 1; row <= SLOT_COUNT; row++) {
      const numCell = document.createElement('div');
      numCell.className = 'row-num';
      numCell.textContent = row;
      grid.appendChild(numCell);

      for (let m = 1; m <= 3; m++) {
        const key = `m${m}-${row}`;
        const col = document.createElement('div');
        col.className = 'slot-col';
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        slotEl.dataset.key = key;
        slotEl.dataset.machine = String(m);
        slotEl.dataset.row = String(row);

        const item = slots[key];
        if (item) {
          slotEl.classList.add('occupied');
          slotEl.innerHTML = `<div class="slot-content"><div class="title">${escapeHtml(item.name)} ${escapeHtml(item.qty || '')}</div><div class="meta">수량: ${escapeHtml(String(item.qty || ''))} | 납기: ${escapeHtml(item.due || '')}<br>공정: ${escapeHtml(item.proc || '')}</div></div>`;
          slotEl.draggable = false;
        } else {
          slotEl.classList.add('empty');
          slotEl.innerHTML = '';
          slotEl.draggable = false;
        }

        col.appendChild(slotEl);
        grid.appendChild(col);
      }
    }
  }

  function makeHeadCell(text, cls) {
    const d = document.createElement('div');
    d.className = 'col-head' + (cls ? ' ' + cls : '');
    d.textContent = text;
    return d;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  renderGrid();

  window.addEventListener('storage', (e) => {
    if (e.key === ASSIGN_KEY) renderGrid();
  });

  setInterval(renderGrid, 2000);
});
