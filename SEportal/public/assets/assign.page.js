if (!sessionStorage.getItem('sepnp_emp_no')) {
  alert('로그인이 필요합니다.');
  location.href = 'index.html';
}
const NF = new Intl.NumberFormat('ko-KR');
const esc = s => (s==null?'':String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]));

const PRESSES = ['1호기','2호기','3호기'];
const PLAN_KEY = 'sepnp_print_slots_v1';
const PLAN_SLOTS = 15;
let state = { pool: [], lanes: {}, completed: [], history: [] };
let lastAssignRaw = '';

function saveState() {
  const raw = JSON.stringify(state);
  localStorage.setItem('sepnp_assign_v2', raw);
  lastAssignRaw = raw;
}

function loadState() {
  const saved = localStorage.getItem('sepnp_assign_v2');
  lastAssignRaw = saved || '';
  if (saved) {
    try {
      state = JSON.parse(saved);
      if (!state.pool) state.pool = [];
      if (!state.lanes) state.lanes = {};
      if (!state.completed) state.completed = [];
      if (!state.history) state.history = [];
    } catch (e) {
      console.error('assign state parse error', e);
      state = { pool: [], lanes: {}, completed: [], history: [] };
    }
  } else {
    state = { pool: [], lanes: {}, completed: [], history: [] };
  }

  PRESSES.forEach(p => {
    if (!Array.isArray(state.lanes[p])) state.lanes[p] = [];
  });

  const orders = JSON.parse(localStorage.getItem('sepnp_orders_v1') || '[]');
  orders.forEach(o => {
    if (!o.id) return;
    const hasPrint = Array.isArray(o?.productSnapshot?.processes) &&
                     o.productSnapshot.processes.some(x => /인쇄|print/i.test(String(x)));
    if (!hasPrint) return;

    const exists = [
      ...state.pool,
      ...Object.values(state.lanes).flat(),
      ...state.completed
    ].some(c => c.orderId === o.id);
    if (!exists) {
      const qty = Number(o.sheetsQty || o.qty || 0) + Number(o.extraSheets || o.extraQty || 0);
      state.pool.push({
        id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        orderId: o.id,
        productName: o.productName || '미상',
        vendor: o.vendor || '',
        quantity: qty,
        dueDate: o.dueDate || '',
        status: 'wait',
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString()
      });
    }
  });

  saveState();
}

function renderPool() {
  const container = document.getElementById('assignPool');
  if (!container) return;
  if (state.pool.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#999;padding:40px">미배정 작업이 없습니다</div>';
    return;
  }
  container.innerHTML = '';
  state.pool.forEach(card => {
    const div = document.createElement('div');
    div.className = 'pool-card';
    div.draggable = true;
    div.dataset.id = card.id;
    div.innerHTML = `
      <div class="card-title">${esc(card.productName)}</div>
      <div class="card-meta">
        <div>거래처: ${esc(card.vendor)}</div>
        <div>수량: ${NF.format(card.quantity)}개</div>
        ${card.netQty ? `<div>정미: ${NF.format(card.netQty)}개</div>` : ''}
        ${card.dueDate ? `<div>납기: ${card.dueDate}</div>` : ''}
      </div>
    `;
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'assign', id: card.id }));
      setTimeout(() => div.classList.add('dragging'), 0);
    });
    div.addEventListener('dragend', () => div.classList.remove('dragging'));
    container.appendChild(div);
  });
  document.getElementById('poolCount').textContent = state.pool.length;
}

function takeCardById(cardId){
  if(!cardId) return null;
  const poolIdx = state.pool.findIndex(c => c.id === cardId);
  if(poolIdx >= 0) return state.pool.splice(poolIdx, 1)[0];
  for(const press of PRESSES){
    const arr = state.lanes[press] || [];
    const idx = arr.findIndex(c => c.id === cardId);
    if(idx >= 0) return arr.splice(idx, 1)[0];
  }
  return null;
}

function loadPlanSlots(){
  const raw = localStorage.getItem(PLAN_KEY);
  if(!raw){
    const obj = {};
    for(let m=1;m<=3;m++){
      for(let r=1;r<=PLAN_SLOTS;r++){
        obj[`m${m}-${r}`] = null;
      }
    }
    localStorage.setItem(PLAN_KEY, JSON.stringify(obj));
    return obj;
  }
  try{ return JSON.parse(raw); }catch{ return {}; }
}

function savePlanSlots(slots){
  localStorage.setItem(PLAN_KEY, JSON.stringify(slots));
}

function addToPrintPlan(pressIndex, card){
  const slots = loadPlanSlots();
  for(let row=1; row<=PLAN_SLOTS; row++){
    const key = `m${pressIndex}-${row}`;
    if(!slots[key]){
      slots[key] = {
        id: card.orderId || card.id,
        name: card.productName || '미상',
        qty: card.quantity || 0,
        due: card.dueDate || '',
        proc: '인쇄'
      };
      savePlanSlots(slots);
      return true;
    }
  }
  return false;
}

function assignToPress(cardId, pressIndex){
  const card = takeCardById(cardId);
  if(!card) return;
  card.status = 'assigned';
  if(!Array.isArray(state.lanes[PRESSES[pressIndex-1]])){
    state.lanes[PRESSES[pressIndex-1]] = [];
  }
  state.lanes[PRESSES[pressIndex-1]].push(card);
  saveState();

  const ok = addToPrintPlan(pressIndex, card);
  if(!ok){
    alert(`인쇄 ${pressIndex}호기 계획표가 가득 찼습니다.`);
  }
  renderPool();
  renderLanes();
}

function moveToPool(cardId){
  const card = takeCardById(cardId);
  if(!card) return;
  card.status = 'wait';
  state.pool.unshift(card);
  saveState();
  renderPool();
  renderLanes();
}

function renderLanes() {
  const grid = document.getElementById('lanesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  PRESSES.forEach(p => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.innerHTML = `<h4>${p} (${(state.lanes[p] || []).length})</h4><div class="lane-cards" data-press="${p}"></div>`;
    const cards = lane.querySelector('.lane-cards');
    cards.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cards.classList.add('dragover');
    });
    cards.addEventListener('dragleave', () => cards.classList.remove('dragover'));
    cards.addEventListener('drop', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cards.classList.remove('dragover');
      const raw = e.dataTransfer.getData('text/plain');
      if(!raw) return;
      try{
        const payload = JSON.parse(raw);
        if(payload.type !== 'assign' || !payload.id) return;
        const pressIndex = PRESSES.indexOf(p) + 1;
        if(pressIndex < 1) return;
        assignToPress(payload.id, pressIndex);
      }catch{}
    });
    (state.lanes[p] || []).forEach(card => {
      const div = document.createElement('div');
      div.className = `lane-card ${card.status || 'assigned'}`;
      div.draggable = true;
      div.innerHTML = `
        <div class="card-title">${esc(card.productName)}</div>
        <div class="card-meta">
          <div>${esc(card.vendor)} / ${NF.format(card.quantity)}개</div>
          ${card.netQty ? `<div>정미: ${NF.format(card.netQty)}개</div>` : ''}
          ${card.dueDate ? `<div>납기: ${card.dueDate}</div>` : ''}
        </div>
      `;
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'assign', id: card.id }));
        setTimeout(() => div.classList.add('dragging'), 0);
      });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      cards.appendChild(div);
    });
    grid.appendChild(lane);
  });
}

const poolEl = document.getElementById('assignPool');
if(poolEl){
  poolEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  poolEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const raw = e.dataTransfer.getData('text/plain');
    if(!raw) return;
    try{
      const payload = JSON.parse(raw);
      if(payload.type !== 'assign' || !payload.id) return;
      moveToPool(payload.id);
    }catch{}
  });
}

loadState();
renderPool();
renderLanes();

function syncFromStorage(){
  const raw = localStorage.getItem('sepnp_assign_v2') || '';
  if(raw && raw !== lastAssignRaw){
    lastAssignRaw = raw;
    loadState();
    renderPool();
    renderLanes();
  }
}

window.addEventListener('storage', (e) => {
  if(e.key === 'sepnp_assign_v2') syncFromStorage();
});

setInterval(syncFromStorage, 1000);
