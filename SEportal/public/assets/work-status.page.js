if (!sessionStorage.getItem('sepnp_emp_no')) {
  alert('로그인이 필요합니다.');
  location.href = 'index.html';
}
;(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function getCurrentUser() {
    try {
      const authData = localStorage.getItem('sepnp_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.name || '관리자';
      }
    } catch (e) {}
    return '관리자';
  }

  const currentUserName = getCurrentUser();

  const CATS = [
    { id: 'print', label: '인쇄', machines: ['1호기', '2호기', '3호기'] },
    { id: 'coating', label: '코팅', machines: ['오버코팅1호기', '오버코팅2호기', '오버코팅3호기', 'UV코팅기', '라미네이팅기', '열코팅기'] },
    { id: 'foil', label: '금박', machines: ['YUYIN1호기', 'YUYIN2호기', '하이델베르그'] },
    { id: 'emboss', label: '형압', machines: ['YUYIN1호기', 'YUYIN2호기', '하이델베르그'] },
    { id: 'lamination', label: '합지', machines: ['합지기1', '합지톰슨기1'] },
    { id: 'thomson', label: '톰슨', machines: ['1호기', '2호기', '3호기', '4호기', '5호기'] },
    { id: 'adhesive', label: '접착', machines: ['1호기', '2호기', '3호기', '4호기', '5호기', '6호기', '7호기'] }
  ];

  const KEY = 'sepnp_workstatus_v6';
  const state = load() || bootstrap();
  let currentCat = CATS[0].id;
  let pendingFinalCard = null;

  function bootstrap() {
    const lanes = {};
    const completed = {};
    const brokenMachines = {};
    CATS.forEach((cat) => {
      lanes[`${cat.id}::pool`] = [];
      cat.machines.forEach((m, idx) => (lanes[`${cat.id}::m${idx + 1}`] = []));
      completed[cat.id] = [];
      brokenMachines[cat.id] = {};
    });
    return { lanes, completed, brokenMachines, seq: 0 };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.completed || Array.isArray(s.completed)) {
        const old = s.completed || [];
        s.completed = {};
        CATS.forEach((cat) => (s.completed[cat.id] = []));
        if (old.length) s.completed[CATS[0].id] = old;
      }
      if (!s.brokenMachines) s.brokenMachines = {};
      CATS.forEach((cat) => {
        if (!s.lanes[`${cat.id}::pool`]) s.lanes[`${cat.id}::pool`] = [];
        cat.machines.forEach((m, idx) => {
          const k = `${cat.id}::m${idx + 1}`;
          if (!s.lanes[k]) s.lanes[k] = [];
        });
        if (!s.completed[cat.id]) s.completed[cat.id] = [];
        if (!s.brokenMachines[cat.id]) s.brokenMachines[cat.id] = {};
      });
      return s;
    } catch (e) {
      console.error(e);
      return null;
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function isToday(ts) {
    if (!ts) return false;
    const d = new Date(ts);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  const PROC_ORDER = ['print', 'coating', 'foil', 'emboss', 'lamination', 'thomson', 'adhesive'];

  function getNextCatId(card, currentCatId) {
    const route = Array.isArray(card?.route) ? card.route.slice() : PROC_ORDER.slice();
    const idx = route.indexOf(currentCatId);
    if (idx >= 0 && idx < route.length - 1) return route[idx + 1];
    const i2 = PROC_ORDER.indexOf(currentCatId);
    return i2 >= 0 && i2 < PROC_ORDER.length - 1 ? PROC_ORDER[i2 + 1] : null;
  }

  function isLastProcess(card, currentCatId) {
    return !getNextCatId(card, currentCatId);
  }

  function addToInventory(productName, qty, unit, spec) {
    const KEY_PRODUCTS = 'sepnp_inventory_products';
    let products = [];
    try {
      products = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
    } catch (e) {}

    let product = products.find((p) => p.name === productName);
    if (!product) {
      product = {
        id: `prod_${Date.now()}`,
        name: productName,
        length: spec?.length || 0,
        width: spec?.width || 0,
        height: spec?.height || 0,
        vendor: '',
        qty: 0,
        safety: 0,
        unit: unit || '개',
        lastIn: new Date().toISOString().slice(0, 10)
      };
      products.push(product);
    }

    product.qty = (product.qty || 0) + qty;
    product.unit = product.unit || unit || '개';
    product.lastIn = new Date().toISOString().slice(0, 10);

    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
  }

  window.showQtyModal = function (card, catId, isFinal) {
    pendingFinalCard = { card, catId, isFinal };
    $('#qtyModalTitle').textContent = isFinal ? '최종 생산 수량 입력' : '공정 생산 수량 입력';
    $('#finalProductName').textContent = card.title || '제품';
    $('#finalOrderQty').textContent = `${card.qty || 0}개`;
    $('#producedInput').value = card.lastProduced ?? (card.qty || 0);
    $('#defectiveInput').value = card.lastDefective ?? 0;
    $('#qtyModalInfo').textContent = isFinal
      ? '입력한 양이 재고로 등록됩니다.'
      : '입력한 수량에서 불량을 제외한 양이 다음 공정 수량으로 전달됩니다.';
    $('#finalQtyModal').classList.add('show');
    $('#producedInput').focus();
  };

  window.closeFinalQtyModal = function () {
    $('#finalQtyModal').classList.remove('show');
    pendingFinalCard = null;
  };

  async function handleConfirmQty() {
    if (!pendingFinalCard) return closeFinalQtyModal();
    const { card, catId, isFinal } = pendingFinalCard;
    const produced = parseInt($('#producedInput').value || '0', 10);
    const defective = parseInt($('#defectiveInput').value || '0', 10);

    if (isNaN(produced) || produced < 0) {
      alert('생산 수량을 올바르게 입력하세요.');
      return;
    }
    if (isNaN(defective) || defective < 0) {
      alert('불량 수량을 올바르게 입력하세요.');
      return;
    }
    if (defective > produced) {
      alert('불량 수량이 생산 수량보다 클 수 없습니다.');
      return;
    }

    const goodQty = produced - defective;

    card.lastProduced = produced;
    card.lastDefective = defective;
    if (!card.processHistory) card.processHistory = [];
    card.processHistory.unshift({
      cat: catId,
      produced,
      defective,
      goodQty,
      time: Date.now(),
      user: currentUserName
    });

    card.completedAt = Date.now();
    card.completedBy = currentUserName;
    if (!card.startedAt) {
      card.startedAt = Date.now();
      card.startedBy = currentUserName;
    }

    const loc = findCardLocation(card.id);
    if (loc) {
      const [removed] = state.lanes[loc.key].splice(loc.index, 1);
      if (!state.completed[catId]) state.completed[catId] = [];
      removed.produced = produced;
      removed.defective = defective;
      removed.goodQty = goodQty;
      state.completed[catId].unshift(removed);

      if (catId === 'print') {
        const orderId = removed.orderId || removed.id;
        removeFromAssignByOrderId(orderId);
        removeFromPrintPlan(orderId);
      }

      if (isFinal) {
        addToInventory(removed.title, goodQty, '개', {});
      } else {
        const nextCat = getNextCatId(removed, catId);
        if (nextCat) {
          const poolKey = `${nextCat}::pool`;
          if (!Array.isArray(state.lanes[poolKey])) state.lanes[poolKey] = [];
          const nextCard = {
            ...removed,
            qty: goodQty,
            status: 'wait',
            startedAt: null,
            completedAt: null,
            startedBy: null,
            completedBy: null,
            currentCat: nextCat
          };
          state.lanes[poolKey].unshift(nextCard);
          refreshLane(poolKey, nextCat);
        }
      }

      refreshLane(loc.key, loc.key.split('::')[0]);
      renderTodayCompleted(catId);
      save();
    }

    closeFinalQtyModal();
    alert(
      isFinal
        ? `생산 완료! 재고에 ${goodQty}개가 등록되었습니다.`
        : `공정 완료: 생산 ${produced}개, 불량 ${defective}개. 다음 공정에 ${goodQty}개 전달됨.`
    );
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'confirmQtyBtn') handleConfirmQty();
  });

  function renderTodayCompleted(catId) {
    currentCat = catId;
    const todayCards = (state.completed[catId] || []).filter((c) => isToday(c.completedAt));
    const section = $('#todayCompletedSection');
    const list = $('#todayList');
    const count = $('#todayCount');
    const label = $('#todayProcessLabel');

    const cat = CATS.find((c) => c.id === catId);
    label.textContent = cat ? cat.label : '';

    if (!todayCards.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    count.textContent = `(${todayCards.length})`;
    list.innerHTML = '';

    todayCards.forEach((card) => {
      const mini = document.createElement('div');
      mini.className = 'mini-card';
      const finalText = card.finalQty ? ` → 생산 ${card.finalQty}개` : '';
      mini.textContent = `${card.title} - ${card.vendor || ''} (${card.qty ?? 0})${finalText}`;
      list.appendChild(mini);
    });
  }

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    CATS.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (i === 0 ? ' active' : '');
      btn.textContent = c.label;
      btn.dataset.cat = c.id;
      btn.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('active'));
        btn.classList.add('active');
        showBoard(c.id);
        renderTodayCompleted(c.id);
      });
      tabs.appendChild(btn);
    });
  }

  function showBoard(catId) {
    const boards = $('#boards');
    boards.innerHTML = '';
    boards.appendChild(buildBoard(catId));
  }

  function buildBoard(catId) {
    const sec = document.createElement('div');
    sec.className = 'board active';
    sec.appendChild(buildPoolLane(catId));
    const machineWrap = document.createElement('div');
    machineWrap.className = 'machine-lanes';
    const cat = CATS.find((c) => c.id === catId);
    cat.machines.forEach((name, idx) => {
      machineWrap.appendChild(buildLane(catId, `m${idx + 1}`, name));
    });
    sec.appendChild(machineWrap);
    return sec;
  }

  function buildPoolLane(catId) {
    const k = `${catId}::pool`;
    const wrap = document.createElement('div');
    wrap.className = 'pool-lane';
    const h = document.createElement('h3');
    h.innerHTML = `대기풀 <span class="count">(${state.lanes[k].length})</span>`;
    wrap.appendChild(h);

    const drop = document.createElement('div');
    drop.className = 'drop';
    drop.dataset.key = k;
    addDnd(drop);
    wrap.appendChild(drop);

    if (!state.lanes[k].length) {
      const emp = document.createElement('div');
      emp.className = 'empty';
      emp.textContent = '카드 없음';
      drop.appendChild(emp);
    } else {
      state.lanes[k].forEach((card) => drop.appendChild(cardEl(card, catId)));
    }
    return wrap;
  }

  function buildLane(catId, laneId, title) {
    const k = `${catId}::${laneId}`;
    const wrap = document.createElement('div');
    wrap.className = 'lane';
    wrap.dataset.key = k;

    const isBroken = state.brokenMachines[catId] && state.brokenMachines[catId][laneId];
    if (isBroken) wrap.classList.add('broken');

    const h = document.createElement('h3');
    h.innerHTML = `
        <div class="title-left">
          <span>${title}</span>
          <span class="count">(${state.lanes[k].length})</span>
        </div>
        <label class="broken-check" onclick="event.stopPropagation()">
          <input type="checkbox" data-cat="${catId}" data-lane="${laneId}" ${isBroken ? 'checked' : ''}>
          고장
        </label>
      `;
    wrap.appendChild(h);

    const checkbox = h.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const checked = checkbox.checked;
      const catId = checkbox.dataset.cat;
      const laneId = checkbox.dataset.lane;

      if (!state.brokenMachines[catId]) state.brokenMachines[catId] = {};
      state.brokenMachines[catId][laneId] = checked;

      if (checked) {
        wrap.classList.add('broken');
        drop.style.pointerEvents = 'none';
      } else {
        wrap.classList.remove('broken');
        drop.style.pointerEvents = '';
      }

      save();
    });

    const drop = document.createElement('div');
    drop.className = 'drop';
    drop.dataset.key = k;
    addDnd(drop);
    wrap.appendChild(drop);

    if (!state.lanes[k].length) {
      const emp = document.createElement('div');
      emp.className = 'empty';
      emp.textContent = '카드 없음';
      drop.appendChild(emp);
    } else {
      state.lanes[k].forEach((card) => drop.appendChild(cardEl(card, catId)));
    }
    return wrap;
  }

  function parseDue(d) {
    if (!d) return null;
    if (typeof d === 'number') return new Date(d);
    if (typeof d === 'string') {
      const s = d.includes('T') ? d : `${d}T23:59:59`;
      const dt = new Date(s);
      return isNaN(dt) ? null : dt;
    }
    return null;
  }
  function daysUntilDue(due) {
    const dueDt = parseDue(due);
    if (!dueDt) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((dueDt - today) / 86400000);
  }
  function getUrgency(due) {
    const dl = daysUntilDue(due);
    if (dl === 3) return { icons: 1, blink: false, days: dl };
    if (dl === 2) return { icons: 2, blink: false, days: dl };
    if (dl <= 1) return { icons: 1, blink: true, days: dl };
    return { icons: 0, blink: false, days: dl };
  }

  function findCardLocation(cardId) {
    for (const [key, arr] of Object.entries(state.lanes)) {
      const idx = arr.findIndex((c) => c.id === cardId);
      if (idx > -1) return { key, index: idx };
    }
    return null;
  }

  function refreshLane(key, catId) {
    const drop = document.querySelector(`.drop[data-key="${key}"]`);
    if (!drop) return;
    const arr = state.lanes[key] || [];
    drop.innerHTML = '';
    if (arr.length === 0) {
      const emp = document.createElement('div');
      emp.className = 'empty';
      emp.textContent = '카드 없음';
      drop.appendChild(emp);
    } else {
      arr.forEach((card) => drop.appendChild(cardEl(card, catId)));
    }
    const countEl = drop.parentElement?.querySelector('h3 .count');
    if (countEl) countEl.textContent = `(${arr.length})`;
  }

  function addDnd(dropEl) {
    dropEl.addEventListener('dragover', (e) => {
      const laneEl = dropEl.closest('.lane');
      if (laneEl && laneEl.classList.contains('broken')) return;

      e.preventDefault();
      dropEl.classList.add('dragover');
    });
    dropEl.addEventListener('dragleave', () => {
      dropEl.classList.remove('dragover');
    });
    dropEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropEl.classList.remove('dragover');

      const laneEl = dropEl.closest('.lane');
      if (laneEl && laneEl.classList.contains('broken')) return;

      const targetKey = dropEl.dataset.key;
      if (!targetKey) return;
      const targetCat = targetKey.split('::')[0];

      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;

      const loc = findCardLocation(id);
      if (!loc) return;
      if (loc.key === targetKey) return;

      const [card] = state.lanes[loc.key].splice(loc.index, 1);

      if (targetKey.endsWith('::pool')) {
        card.status = 'wait';
      } else {
        card.status = 'progress';
        if (!card.startedAt) {
          card.startedAt = Date.now();
          card.startedBy = currentUserName;
        }
      }

      state.lanes[targetKey].push(card);

      refreshLane(loc.key, loc.key.split('::')[0]);
      refreshLane(targetKey, targetCat);
      save();
    });
  }

  function cardEl(card, catId) {
    if (!card.status) card.status = 'wait';
    const el = document.createElement('div');
    el.className = `wcard ${card.status}`;
    el.draggable = true;
    el.dataset.id = card.id;
    el.innerHTML = `
        <div class="title-row">
          <div class="title">${card.title}</div>
          <div class="urgency" aria-label="due-indicator"></div>
        </div>
        <div class="meta">
          <span>${card.vendor || ''}</span>
          <span>·</span>
          <span>수량 ${card.qty ?? 0}</span>
        </div>
        <div class="status-sel">
          <button data-status="wait" class="${card.status === 'wait' ? 'on' : ''}">대기</button>
          <button data-status="progress" class="${card.status === 'progress' ? 'on' : ''}">진행중</button>
          <button data-status="done" class="${card.status === 'done' ? 'on' : ''}">완료</button>
        </div>
      `;

    const u = getUrgency(card.dueDate);
    const urgEl = el.querySelector('.urgency');
    if (u.icons > 0) {
      urgEl.textContent = '🚨'.repeat(u.icons);
      if (card.dueDate) {
        const sign = u.days >= 0 ? 'D-' : 'D+';
        urgEl.title = `납기 ${sign}${Math.abs(u.days)}`;
      }
    }
    el.classList.toggle('urgent-blink', !!u.blink);

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.id);
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    el.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newStatus = btn.dataset.status;
        const oldStatus = card.status;

        if (newStatus === 'progress' && oldStatus !== 'progress') {
          card.startedAt = Date.now();
          card.startedBy = currentUserName;
        }
        if (newStatus === 'done' && oldStatus !== 'done') {
          card.completedAt = Date.now();
          card.completedBy = currentUserName;
          if (!card.startedAt) {
            card.startedAt = Date.now();
            card.startedBy = currentUserName;
          }

          if (!state.completed[catId]) state.completed[catId] = [];
          const exists = state.completed[catId].some((c) => c.id === card.id);
          if (!exists) {
            state.completed[catId].unshift({ ...card });
          }
          if (catId === 'print') {
            const orderId = card.orderId || card.id;
            removeFromAssignByOrderId(orderId);
            removeFromPrintPlan(orderId);
          }
          renderTodayCompleted(catId);
        }

        card.status = newStatus;
        save();
        el.className = `wcard ${newStatus}`;
        el.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('on', b.dataset.status === newStatus));
      });
    });

    return el;
  }

  function repaintUrgency() {
    document.querySelectorAll('.wcard').forEach((el) => {
      const id = el.dataset.id;
      const loc = findCardLocation(id);
      if (!loc) return;
      const card = state.lanes[loc.key][loc.index];
      const u = getUrgency(card.dueDate);
      const urgEl = el.querySelector('.urgency');
      if (urgEl) {
        urgEl.textContent = u.icons > 0 ? '🚨'.repeat(u.icons) : '';
        if (card.dueDate) {
          const sign = u.days >= 0 ? 'D-' : 'D+';
          urgEl.title = `납기 ${sign}${Math.abs(u.days)}`;
        } else {
          urgEl.removeAttribute('title');
        }
      }
      el.classList.toggle('urgent-blink', !!u.blink);
    });
  }

  function normalizeStatus(s) {
    const val = String(s || '').toLowerCase();
    if (['wait', 'waiting', 'pending'].includes(val)) return 'wait';
    if (['progress', 'doing', 'assigned', 'inprogress'].includes(val)) return 'progress';
    if (['done', 'complete', 'completed', 'finished'].includes(val)) return 'done';
    return 'wait';
  }

  function getOrderIdSet() {
    const keys = ['sepnp_orders', 'sepnp_orders_v1', 'sepnp_orders_v2'];
    const list = [];
    keys.forEach((k) => {
      try {
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(arr)) list.push(...arr);
      } catch {}
    });
    const ids = new Set();
    list.forEach((o) => {
      const id = o?.id ?? o?.orderId ?? o?.order_id;
      if (id != null) ids.add(String(id));
    });
    return ids;
  }

  function getOrderIdFromCard(card) {
    if (!card) return null;
    if (card.orderId != null) return String(card.orderId);
    const id = card.id != null ? String(card.id) : '';
    if (id.startsWith('card_')) return id.slice(5);
    return id || null;
  }

  function pruneWorkStatusFromOrders() {
    const orderIds = getOrderIdSet();
    if (orderIds.size === 0) return;
    let changed = false;
    Object.keys(state.lanes || {}).forEach((k) => {
      const arr = state.lanes[k];
      if (!Array.isArray(arr)) return;
      const next = arr.filter((card) => {
        const oid = getOrderIdFromCard(card);
        return !oid || orderIds.has(oid);
      });
      if (next.length !== arr.length) {
        state.lanes[k] = next;
        changed = true;
      }
    });
    Object.keys(state.completed || {}).forEach((k) => {
      const arr = state.completed[k];
      if (!Array.isArray(arr)) return;
      const next = arr.filter((card) => {
        const oid = getOrderIdFromCard(card);
        return !oid || orderIds.has(oid);
      });
      if (next.length !== arr.length) {
        state.completed[k] = next;
        changed = true;
      }
    });
    if (changed) save();
  }

  function removeFromAssignByOrderId(orderId) {
    if (!orderId) return;
    const keys = ['sepnp_assign_v2', 'sepnp_assign_v1'];
    keys.forEach((key) => {
      let assign;
      try {
        assign = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {
        assign = {};
      }
      if (!assign || typeof assign !== 'object') assign = {};
      if (Array.isArray(assign.pool)) assign.pool = assign.pool.filter((c) => c.orderId !== orderId && c.id !== orderId);
      if (assign.lanes && typeof assign.lanes === 'object') {
        Object.keys(assign.lanes).forEach((k) => {
          if (Array.isArray(assign.lanes[k]))
            assign.lanes[k] = assign.lanes[k].filter((c) => c.orderId !== orderId && c.id !== orderId);
        });
      }
      if (Array.isArray(assign.completed)) assign.completed = assign.completed.filter((c) => c.orderId !== orderId && c.id !== orderId);
      if (Array.isArray(assign.history)) assign.history = assign.history.filter((c) => c.orderId !== orderId && c.id !== orderId);
      localStorage.setItem(key, JSON.stringify(assign));
    });
  }

  function removeFromPrintPlan(orderId) {
    if (!orderId) return;
    const key = 'sepnp_print_slots_v1';
    let slots;
    try {
      slots = JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      slots = {};
    }
    let changed = false;
    Object.keys(slots).forEach((k) => {
      if (slots[k]?.id === orderId) {
        slots[k] = null;
        changed = true;
      }
    });
    if (changed) localStorage.setItem(key, JSON.stringify(slots));
  }

  function importAssignmentsToWorkstatus() {
    if (Object.values(state.lanes || {}).some((v) => Array.isArray(v) && v.length > 0)) return;
    let assign = null;
    try {
      assign = JSON.parse(localStorage.getItem('sepnp_assign_v2') || localStorage.getItem('sepnp_assign_v1') || 'null');
    } catch (e) {
      assign = null;
    }
    if (!assign) return;

    const printCat = CATS.find((c) => c.id === 'print');
    if (!printCat) return;

    const toCard = (src, extra = {}) => ({
      id: src.id || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      orderId: src.orderId || (typeof src.id === 'string' && src.id.startsWith('card_') ? src.id.slice(5) : src.id),
      title: src.productName || src.title || '미상',
      vendor: src.vendor || '',
      qty: Number(src.quantity ?? src.qty ?? 0),
      dueDate: src.dueDate || src.due || '',
      status: normalizeStatus(src.status),
      createdAt: src.createdAt || Date.now(),
      route: PROC_ORDER.slice(),
      currentCat: 'print',
      ...extra
    });

    const poolKey = 'print::pool';
    if (!Array.isArray(state.lanes[poolKey])) state.lanes[poolKey] = [];

    const pool = Array.isArray(assign.pool) ? assign.pool : [];
    pool.forEach((card) => state.lanes[poolKey].push(toCard(card, { status: 'wait' })));

    const lanes = assign.lanes || {};
    Object.entries(lanes).forEach(([machineName, list]) => {
      if (!Array.isArray(list)) return;
      const idx = printCat.machines.findIndex((m) => m === machineName);
      const laneId = idx >= 0 ? `m${idx + 1}` : null;
      const laneKey = laneId ? `print::${laneId}` : poolKey;
      if (!Array.isArray(state.lanes[laneKey])) state.lanes[laneKey] = [];
      list.forEach((card) => state.lanes[laneKey].push(toCard(card, { status: normalizeStatus(card.status || 'progress') })));
    });

    save();
  }

  importAssignmentsToWorkstatus();
  pruneWorkStatusFromOrders();

  renderTabs();
  showBoard(CATS[0].id);
  renderTodayCompleted(CATS[0].id);
  repaintUrgency();
  setInterval(repaintUrgency, 60000);
})();
