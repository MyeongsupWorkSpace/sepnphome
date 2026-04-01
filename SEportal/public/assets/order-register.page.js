PortalStore.hydrate(['sepnp_workstatus', 'sepnp_assign', 'sepnp_orders']).then(() => {
  const empNo = sessionStorage.getItem('sepnp_emp_no');
  if (!empNo) location.href = 'index.html';

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    sessionStorage.removeItem('sepnp_emp_no');
    location.href = 'index.html';
  });

  let products = [];
  let orders = [];
  const WS_KEY = 'sepnp_workstatus_v6';
  const ASSIGN_KEY = 'sepnp_assign_v2';

  const PROC_PRECEDENCE = [
    { id: 'print', re: /인쇄|print/i },
    { id: 'coating', re: /코팅|uv|라미/i },
    { id: 'foil', re: /금박/i },
    { id: 'emboss', re: /형압/i },
    { id: 'lamination', re: /합지|골|lam/i },
    { id: 'thomson', re: /톰슨|타발|die/i },
    { id: 'adhesive', re: /접착|글루|glue|bond/i }
  ];

  function mapProcessesToRoute(product) {
    const list = Array.isArray(product?.processes) ? product.processes.map(String) : [];
    const route = PROC_PRECEDENCE.filter((p) => list.some((x) => p.re.test(x))).map((p) => p.id);
    return route.length ? route : ['print'];
  }

  function wsLoad() {
    let s;
    try {
      s = JSON.parse(localStorage.getItem(WS_KEY) || '');
    } catch {}
    return s && typeof s === 'object' ? s : null;
  }
  function wsSave(state) {
    localStorage.setItem(WS_KEY, JSON.stringify(state));
  }

  function wsEnsurePools(state) {
    if (!state || typeof state !== 'object') state = {};
    if (!state.lanes || typeof state.lanes !== 'object') state.lanes = {};
    if (!state.completed || typeof state.completed !== 'object') state.completed = {};
    PROC_PRECEDENCE.forEach((p) => {
      const poolKey = `${p.id}::pool`;
      if (!Array.isArray(state.lanes[poolKey])) state.lanes[poolKey] = [];
      if (!Array.isArray(state.completed[p.id])) state.completed[p.id] = [];
    });
    if (typeof state.seq !== 'number') state.seq = 0;
    return state;
  }

  function addToWorkStatusByRoute(order) {
    const route = mapProcessesToRoute(order.productSnapshot);
    let state = wsLoad();
    state = wsEnsurePools(state || {});
    const firstCat = route[0];
    const poolKey = `${firstCat}::pool`;

    const exists = Object.values(state.lanes)
      .flat()
      .some((c) => c.id === order.id);
    if (exists) {
      wsSave(state);
      return;
    }

    const qty = Number(order.sheetsQty || 0) + Number(order.extraSheets || 0);
    const card = {
      id: order.id,
      title: `${order.productName || '제품'} 작업`,
      vendor: order.vendor || '',
      qty,
      netQty: Number(order.netQty || 0),
      dueDate: order.dueDate || null,
      status: 'wait',
      createdAt: order.createdAt || Date.now(),
      route,
      currentCat: firstCat
    };

    state.lanes[poolKey].unshift(card);
    wsSave(state);
  }

  function addToAssignPoolIfPrint(order) {
    const route = mapProcessesToRoute(order.productSnapshot);
    if (!route.includes('print')) return;

    let state;
    try {
      state = JSON.parse(localStorage.getItem(ASSIGN_KEY) || '{}');
    } catch {
      state = {};
    }
    if (!Array.isArray(state.pool)) state.pool = [];
    if (!state.lanes || typeof state.lanes !== 'object') state.lanes = {};
    if (!Array.isArray(state.completed)) state.completed = [];
    if (!Array.isArray(state.history)) state.history = [];

    const exists = [...state.pool, ...Object.values(state.lanes).flat(), ...state.completed].some(
      (c) => c.orderId === order.id
    );
    if (exists) {
      localStorage.setItem(ASSIGN_KEY, JSON.stringify(state));
      return;
    }

    const qty = Number(order.sheetsQty || 0) + Number(order.extraSheets || 0);
    state.pool.unshift({
      id: `card_${order.id}`,
      orderId: order.id,
      productName: order.productName || '미상',
      vendor: order.vendor || '',
      quantity: qty,
      netQty: Number(order.netQty || 0),
      dueDate: order.dueDate || '',
      status: 'wait',
      createdAt: new Date().toISOString()
    });

    localStorage.setItem(ASSIGN_KEY, JSON.stringify(state));
  }

  function loadProducts() {
    return products;
  }
  function loadOrders() {
    return orders;
  }
  async function syncProducts() {
    try {
      products = await window.API.getProducts();
    } catch {
      products = [];
    }
    if (Array.isArray(products)) {
      products = products.map(normalizeProduct);
    } else {
      products = [];
    }
  }

  async function ensureSampleProduct() {
    const seedKey = 'sepnp_products_sample_seeded';
    if (localStorage.getItem(seedKey)) return;
    let list = [];
    try {
      list = await window.API.getProducts();
    } catch {
      list = [];
    }
    if (Array.isArray(list) && list.length) return;

    const nowIso = new Date().toISOString();
    const payload = {
      name: '샘플 박스',
      vendor: '세팍패키지',
      size: { l: 200, w: 120, h: 60 },
      paper: { type: 'SC IV RIV AB', sizeW: 800, sizeH: 600, sizeText: '800×600' },
      noLaminate: true,
      laminate: '없음',
      price: 120,
      cutCount: 2,
      knifeSize: { w: 210, h: 130 },
      processes: ['인쇄', '코팅', '톰슨', '접착'],
      processDetails: {},
      createdAt: nowIso,
      createdBy: '관리자'
    };

    try {
      await window.API.createProduct(payload);
      localStorage.setItem(seedKey, '1');
    } catch (e) {
      console.warn('sample product create failed', e);
    }
  }
  async function syncOrders() {
    try {
      orders = await window.API.getOrders();
    } catch {
      orders = [];
    }
  }

  const $ = (s) => document.querySelector(s);
  const NF = new Intl.NumberFormat('ko-KR');

  const todayISO = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  let selected = null;
  let editingOrder = null;
  let activeIndex = -1;

  function formatSize(size) {
    if (!size) return '-';
    if (typeof size === 'string') return size;
    const l = size.l ?? size.length ?? size.L ?? '-';
    const w = size.w ?? size.width ?? size.W ?? '-';
    const h = size.h ?? size.height ?? size.H ?? '-';
    return `${l}×${w}×${h}`;
  }

  function money(n) {
    if (n == null || isNaN(n)) return '-';
    return NF.format(n) + '원';
  }

  function parseTwoSizeText(text) {
    if (!text || typeof text !== 'string') return null;
    const m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/);
    if (!m) return null;
    return { w: Number(m[1]), h: Number(m[2]) };
  }

  function parseNumberLike(v) {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const cleaned = v.replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSize(size, p) {
    if (!size && p) {
      const l = p.l ?? p.length ?? null;
      const w = p.w ?? p.width ?? null;
      const h = p.h ?? p.height ?? null;
      if (l != null || w != null || h != null) return { l, w, h };
    }
    if (!size) return null;
    if (typeof size === 'string') return size;
    if (typeof size === 'object') {
      const l = size.l ?? size.length ?? size.L ?? null;
      const w = size.w ?? size.width ?? size.W ?? null;
      const h = size.h ?? size.height ?? size.H ?? null;
      if (l != null || w != null || h != null) return { l, w, h };
      return size;
    }
    return null;
  }

  function normalizePaper(paper, p) {
    if (!paper && p) {
      const type = p.paperType ?? p.paper_name ?? p.paperName ?? null;
      const sizeText = p.paperSize ?? p.paper_size ?? null;
      const parsed = parseTwoSizeText(sizeText || '');
      if (type || parsed)
        return { type: type || null, sizeW: parsed?.w ?? null, sizeH: parsed?.h ?? null, sizeText: sizeText || null };
      return null;
    }
    if (typeof paper === 'string') return { type: paper };
    if (paper && typeof paper === 'object') {
      const type = paper.type ?? paper.name ?? paper.paperType ?? null;
      const sizeW = paper.sizeW ?? paper.size_w ?? paper.width ?? null;
      const sizeH = paper.sizeH ?? paper.size_h ?? paper.height ?? null;
      if ((sizeW == null || sizeH == null) && paper.size) {
        const parsed = parseTwoSizeText(String(paper.size));
        return { type, sizeW: sizeW ?? parsed?.w ?? null, sizeH: sizeH ?? parsed?.h ?? null, sizeText: paper.size || null };
      }
      return { type, sizeW, sizeH, sizeText: paper.size ?? null };
    }
    return null;
  }

  function normalizeProcesses(processes, processDetails) {
    if (Array.isArray(processes)) {
      return processes
        .map((p) => (typeof p === 'string' ? p : p?.name || p?.label || ''))
        .filter(Boolean);
    }
    if (typeof processes === 'string') {
      return processes.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    }
    if (processDetails && typeof processDetails === 'object') {
      return Object.keys(processDetails);
    }
    return [];
  }

  function normalizeProduct(p) {
    if (!p || typeof p !== 'object') return p;
    const vendor = p.vendor ?? p.vendorName ?? p.supplier?.name ?? p.supplierName ?? p.company ?? '';
    const name = p.name ?? p.productName ?? p.title ?? '';
    const size = normalizeSize(p.size ?? p.dimensions ?? p.dimension ?? p.spec, p);
    const paper = normalizePaper(p.paper ?? p.paperInfo ?? p.paperData, p);
    const laminate = p.laminate ?? p.lamination ?? p.laminationName ?? p.laminateName ?? null;
    const laminationSize = p.laminationSize ?? p.laminateSize ?? null;
    const price = parseNumberLike(p.price ?? p.unitPrice ?? p.unit_price ?? p.cost ?? null);
    const cutCount = parseNumberLike(p.cutCount ?? p.cut ?? p.cut_count ?? p.cutCnt ?? null);
    const processes = normalizeProcesses(p.processes ?? p.processList ?? p.processSummary ?? p.process, p.processDetails);
    return {
      ...p,
      id: p.id ?? p.productId ?? p.code ?? p._id ?? null,
      name,
      vendor,
      size,
      paper,
      laminate,
      laminationSize,
      laminationSizeText: p.laminationSizeText ?? p.laminateSizeText ?? p.lamSizeText ?? p.lamSize ?? null,
      price,
      cutCount,
      processes
    };
  }

  function renderDropdown(list) {
    const dd = $('#searchDropdown');
    if (!list.length) {
      dd.innerHTML = '<div class="empty">검색 결과가 없습니다</div>';
      dd.style.display = 'block';
      return;
    }
    dd.innerHTML = list
      .map(
        (p, i) => `
      <div class="item ${i === activeIndex ? 'active' : ''}" data-i="${i}">
        <div>
          <div><strong>${escapeHtml(p.name || '-')}</strong></div>
          <div class="vendor">${escapeHtml(p.vendor || '-')}</div>
        </div>
        <div style="margin-left:auto;color:#666;font-size:12px">${p.id ? `#${p.id}` : ''}</div>
      </div>
    `
      )
      .join('');
    dd.style.display = 'block';

    dd.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        activeIndex = Number(el.dataset.i);
        highlightActive();
      });
      el.addEventListener('click', () => {
        activeIndex = Number(el.dataset.i);
        pick(list[activeIndex]);
      });
    });
  }
  function highlightActive() {
    $('#searchDropdown').querySelectorAll('.item').forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex);
    });
  }

  function pick(p) {
    selected = p;
    $('#searchInput').value = `${p.name} (${p.vendor || '-'})`;
    $('#searchDropdown').style.display = 'none';

    $('#specArea').style.display = 'block';
    $('#orderArea').style.display = 'block';
    $('#selId').textContent = p.id || '-';
    $('#spVendor').textContent = p.vendor || '-';
    $('#spName').textContent = p.name || '-';
    $('#spSize').textContent = formatSize(p.size);
    const paperType = p.paper?.type || p.paper?.name || p.paperName || '';
    const paperSizeW = p.paper?.sizeW ?? p.paper?.size_w ?? null;
    const paperSizeH = p.paper?.sizeH ?? p.paper?.size_h ?? null;
    const paperSizeText = (paperSizeW || paperSizeH) ? `${paperSizeW || ''}×${paperSizeH || ''}`.trim() : p.paper?.sizeText || p.paper?.size || '';
    const paperText = paperType ? `${paperType} ${paperSizeText}`.trim() : paperSizeText || '-';
    $('#spPaper').textContent = paperText || '-';

    const lamName = p.laminate || p.lamination?.name || p.lamination?.type || p.laminateName || '';
    const lamSize = p.laminationSize || p.laminateSize || null;
    const lamSizeText = lamSize ? `${lamSize.w || ''}×${lamSize.h || ''}`.trim() : p.laminationSizeText || p.laminateSizeText || '';
    const lamText = lamName || lamSizeText || (p.noLaminate ? '없음' : '-');
    $('#spLam').textContent = lamText;
    $('#spPrice').textContent = money(Number(p.price));
    $('#spCut').textContent = p.cutCount ?? '-';

    const procs = Array.isArray(p.processes) ? p.processes : [];
    const procWrap = $('#procWrap');
    const procList = $('#procList');
    if (procs.length) {
      procList.innerHTML = procs.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
      procWrap.style.display = 'block';
    } else {
      procList.innerHTML = '';
      procWrap.style.display = 'none';
    }

    $('#due').value = todayISO();

    updateSummary();
    renderHistory(p.id);
  }

  function formatDateTime(value) {
    if (value == null || value === '') return '-';
    let ts = value;
    if (typeof ts === 'string' && /^[0-9]+$/.test(ts)) ts = Number(ts);
    if (typeof ts === 'number') {
      if (ts < 1000000000000) ts = ts * 1000;
    }
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '-';
    const y = String(d.getFullYear()).slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
  }

  function renderHistory(prodId) {
    const wrap = $('#histWrap');
    const all = loadOrders().filter((o) => o.productId === prodId).sort((a, b) => b.createdAt - a.createdAt);
    if (all.length === 0) {
      wrap.innerHTML = '<div class="empty">이력이 없습니다</div>';
      return;
    }
    wrap.innerHTML = all
      .map((o) => {
        const ds = formatDateTime(o.createdAt);
        const mainSheets = o.sheetsQty ?? o.qty ?? 0;
        const extraSheets = o.extraSheets ?? o.extraQty ?? 0;
        const cut = o.cutCount ?? selected?.cutCount ?? 1;
        const netQty = o.netQty ?? 0;
        const totalProd = o.totalProducts ?? mainSheets * cut;
        return `
        <div class="hist-item">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div><strong>${escapeHtml(o.productName)}</strong> <span class="badge">#${o.id}</span></div>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn" data-action="edit" data-id="${o.id}">수정</button>
              <button class="btn" data-action="delete" data-id="${o.id}" style="color:#dc2626;border-color:#dc2626">삭제</button>
            </div>
            <div class="muted">${ds}</div>
          </div>
          <div class="muted" style="margin-top:6px">장수(본수) ${NF.format(mainSheets)}장, 여분 ${NF.format(extraSheets)}장</div>
          <div class="muted">절수 ${cut} → 제품 총 수량 ${NF.format(totalProd)}개</div>
          <div class="muted">정미 ${NF.format(netQty)}</div>
          <div class="muted">납기 ${o.dueDate || '-'}</div>
          ${o.amount != null ? `<div class="muted">금액 ${money(o.amount)}</div>` : ''}
        </div>`;
      })
      .join('');
  }

  function updateSummary() {
    const qtySheets = Number($('#qty').value || 0);
    const extraSheets = Number($('#extra').value || 0);
    const netQty = Number($('#net').value || 0);
    const cut = Number(selected?.cutCount ?? 1) || 1;
    const totalProducts = qtySheets * cut;
    const unit = Number(selected?.price ?? NaN);
    const amt = Number.isFinite(unit) ? unit * totalProducts : null;

    $('#kpiSheets').textContent = NF.format(qtySheets);
    $('#kpiExtra').textContent = NF.format(extraSheets);
    $('#kpiTotal').textContent = NF.format(totalProducts);
    $('#kpiNet').textContent = NF.format(netQty);
    $('#kpiAmt').textContent = amt != null ? money(amt) : '-';

    return {
      productId: selected?.id || null,
      productName: selected?.name || null,
      vendor: selected?.vendor || null,
      sheetsQty: qtySheets,
      extraSheets: extraSheets,
      netQty: netQty,
      cutCount: cut,
      totalProducts: totalProducts,
      unitPrice: Number.isFinite(unit) ? unit : null,
      amount: amt,
      dueDate: $('#due').value || null,
      note: ($('#note').value || '').trim(),
      shipping: ($('#shipAddr').value || '').trim(),
      manager: ($('#shipContact').value || '').trim(),
      phone: ($('#shipPhone').value || '').trim()
    };
  }

  function wsEnsureShape(board) {
    if (!board || typeof board !== 'object') board = {};
    if (!Array.isArray(board.pool)) board.pool = [];
    if (!Array.isArray(board.queue)) board.queue = [];
    if (!board.lanes || typeof board.lanes !== 'object') board.lanes = {};
    return board;
  }
  function wsDueMs(d) {
    const t = Date.parse(d);
    return Number.isFinite(t) ? t : Infinity;
  }
  function wsSortPool(board) {
    board.pool.sort((a, b) => wsDueMs(a.dueDate) - wsDueMs(b.dueDate) || (a.createdAt || 0) - (b.createdAt || 0));
  }
  function wsSortQueue(board) {
    board.queue.sort((a, b) => wsDueMs(a.dueDate) - wsDueMs(b.dueDate) || (a.createdAt || 0) - (b.createdAt || 0));
  }
  function wsEnforceCapacity(board) {
    wsSortPool(board);
    while (board.pool.length > 20) {
      board.queue.push(board.pool.pop());
    }
    wsSortQueue(board);
  }

  function removeOrderFromAssign(orderId) {
    if (!orderId) return;
    const keys = ['sepnp_assign_v2', 'sepnp_assign_v1'];
    keys.forEach((key) => {
      let state;
      try {
        state = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {
        state = {};
      }
      if (!state || typeof state !== 'object') state = {};
      if (Array.isArray(state.pool)) state.pool = state.pool.filter((c) => c.orderId !== orderId && c.id !== orderId);
      if (state.lanes && typeof state.lanes === 'object') {
        Object.keys(state.lanes).forEach((k) => {
          if (Array.isArray(state.lanes[k]))
            state.lanes[k] = state.lanes[k].filter((c) => c.orderId !== orderId && c.id !== orderId);
        });
      }
      if (Array.isArray(state.completed)) state.completed = state.completed.filter((c) => c.orderId !== orderId && c.id !== orderId);
      if (Array.isArray(state.history)) state.history = state.history.filter((c) => c.orderId !== orderId && c.id !== orderId);
      localStorage.setItem(key, JSON.stringify(state));
    });
  }

  function removeOrderFromWorkStatus(orderId) {
    if (!orderId) return;
    let state;
    try {
      state = JSON.parse(localStorage.getItem(WS_KEY) || '{}');
    } catch {
      state = {};
    }
    state = wsEnsurePools(state || {});
    Object.keys(state.lanes).forEach((k) => {
      if (Array.isArray(state.lanes[k])) state.lanes[k] = state.lanes[k].filter((c) => c.id !== orderId);
    });
    Object.keys(state.completed).forEach((k) => {
      if (Array.isArray(state.completed[k])) state.completed[k] = state.completed[k].filter((c) => c.id !== orderId);
    });
    localStorage.setItem(WS_KEY, JSON.stringify(state));
  }

  function removeOrderFromPrintPlan(orderId) {
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

  async function saveOrder() {
    if (!selected) {
      alert('제품을 먼저 검색하여 선택하세요.');
      return;
    }
    const q = Number($('#qty').value || 0);
    if (!q || q < 1) {
      alert('장 수(수량)를 입력하세요.');
      $('#qty').focus();
      return;
    }
    const due = $('#due').value;
    if (!due) {
      alert('납기일을 입력하세요.');
      $('#due').focus();
      return;
    }
    const shipAddr = ($('#shipAddr').value || '').trim();
    const shipPhone = ($('#shipPhone').value || '').trim();
    if (!shipAddr) {
      alert('배송지를 입력하세요.');
      $('#shipAddr').focus();
      return;
    }
    if (!shipPhone) {
      alert('연락처를 입력하세요.');
      $('#shipPhone').focus();
      return;
    }

    const sum = updateSummary();
    const now = Date.now();
    const order = {
      id: editingOrder?.id || 'O' + now,
      createdAt: editingOrder?.createdAt || now,
      updatedAt: editingOrder ? now : undefined,
      productId: selected.id,
      productName: selected.name,
      vendor: selected.vendor,
      sheetsQty: sum.sheetsQty,
      extraSheets: sum.extraSheets,
      netQty: sum.netQty,
      cutCount: sum.cutCount,
      totalProducts: sum.totalProducts,
      unitPrice: sum.unitPrice,
      amount: sum.amount,
      dueDate: sum.dueDate,
      note: sum.note,
      shipping: sum.shipping,
      manager: sum.manager,
      phone: sum.phone,
      productSnapshot: selected
    };
    try {
      if (editingOrder && editingOrder.id) {
        await window.API.updateOrder(editingOrder.id, order);
      } else {
        const created = await window.API.createOrder(order);
        if (created?.id) order.id = created.id;
      }
      await syncOrders();
      try {
        await window.API.setKV('sepnp_orders', orders);
        localStorage.setItem('sepnp_orders', JSON.stringify(orders));
      } catch {}
    } catch (e) {
      console.error(e);
      alert('오더 저장 실패: ' + (e?.message || '서버 오류'));
      return;
    }

    if (!editingOrder) {
      addToWorkStatusByRoute(order);
      addToAssignPoolIfPrint(order);
    }

    const msg = editingOrder ? '오더가 수정되었습니다.' : '오더가 등록되었습니다.';
    showToast(msg);
    alert(msg);
    editingOrder = null;
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.textContent = '오더 저장';
    renderHistory(selected.id);
  }

  function startEditOrder(orderId) {
    const target = loadOrders().find((o) => String(o.id) === String(orderId));
    if (!target) {
      alert('수정할 오더를 찾을 수 없습니다.');
      return;
    }
    editingOrder = target;

    $('#qty').value = target.sheetsQty ?? target.qty ?? 0;
    $('#extra').value = target.extraSheets ?? target.extraQty ?? 0;
    $('#net').value = target.netQty ?? 0;
    $('#due').value = target.dueDate || todayISO();
    $('#note').value = target.note || '';
    $('#shipAddr').value = target.shipping || '';
    $('#shipContact').value = target.manager || '';
    $('#shipPhone').value = target.phone || '';

    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.textContent = '오더 수정';
    updateSummary();
  }

  async function deleteOrder(orderId) {
    if (!orderId) {
      alert('삭제할 오더 ID가 없습니다.');
      return;
    }
    if (!confirm('해당 오더를 삭제하시겠습니까?')) return;
    try {
      await window.API.deleteOrder(orderId);
      await syncOrders();
      try {
        await window.API.setKV('sepnp_orders', orders);
        localStorage.setItem('sepnp_orders', JSON.stringify(orders));
      } catch {}
      removeOrderFromAssign(orderId);
      removeOrderFromWorkStatus(orderId);
      removeOrderFromPrintPlan(orderId);
      showToast('오더가 삭제되었습니다.');
      renderHistory(selected?.id);
    } catch (e) {
      console.error(e);
      alert('오더 삭제 실패: ' + (e?.message || '서버 오류'));
    }
  }

  function addToWorkStatusPrintPool(order) {
    let state;
    try {
      state = JSON.parse(localStorage.getItem(WS_KEY) || '{}');
    } catch {
      state = {};
    }
    if (!state.lanes) state.lanes = {};
    if (!state.completed) state.completed = {};
    const poolKey = 'print::pool';
    if (!Array.isArray(state.lanes[poolKey])) state.lanes[poolKey] = [];

    const exists = Object.values(state.lanes)
      .flat()
      .some((c) => c.id === order.id);
    if (exists) {
      localStorage.setItem(WS_KEY, JSON.stringify(state));
      return;
    }

    const card = {
      id: order.id,
      title: `${order.productName || '제품'} 인쇄`,
      vendor: order.vendor || '',
      qty: Number(order.sheetsQty || 0) + Number(order.extraSheets || 0),
      dueDate: order.dueDate || null,
      status: 'wait',
      createdAt: order.createdAt || Date.now()
    };

    state.lanes[poolKey].unshift(card);
    localStorage.setItem(WS_KEY, JSON.stringify(state));
  }

  function addToAssignPool(order) {
    let state;
    try {
      state = JSON.parse(localStorage.getItem(ASSIGN_KEY) || '{}');
    } catch {
      state = {};
    }
    if (!Array.isArray(state.pool)) state.pool = [];
    if (!state.lanes || typeof state.lanes !== 'object') state.lanes = {};
    if (!Array.isArray(state.completed)) state.completed = [];

    const exists = [...state.pool, ...Object.values(state.lanes).flat(), ...state.completed].some(
      (c) => c.orderId === order.id
    );
    if (exists) {
      localStorage.setItem(ASSIGN_KEY, JSON.stringify(state));
      return;
    }

    state.pool.unshift({
      id: `card_${order.id}`,
      orderId: order.id,
      productName: order.productName || '미상',
      vendor: order.vendor || '',
      quantity: Number(order.sheetsQty || 0) + Number(order.extraSheets || 0),
      dueDate: order.dueDate || '',
      status: 'wait',
      createdAt: new Date().toISOString()
    });

    localStorage.setItem(ASSIGN_KEY, JSON.stringify(state));
  }

  $('#qty').addEventListener('input', updateSummary);
  $('#extra').addEventListener('input', updateSummary);
  $('#net').addEventListener('input', updateSummary);
  $('#due').addEventListener('change', updateSummary);
  $('#note').addEventListener('input', updateSummary);
  $('#btnSave').addEventListener('click', saveOrder);
  $('#btnReset').addEventListener('click', () => {
    selected = null;
    activeIndex = -1;
    editingOrder = null;
    $('#searchInput').value = '';
    $('#searchDropdown').style.display = 'none';
    $('#specArea').style.display = 'none';
    $('#orderArea').style.display = 'none';
    $('#histWrap').innerHTML = '<div class="empty">제품을 선택하면 수주 이력이 모두 표시됩니다.</div>';
    $('#shipAddr').value = '';
    $('#shipContact').value = '';
    $('#shipPhone').value = '';
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.textContent = '오더 저장';
  });

  function refreshSearchResults() {
    const q = $('#searchInput').value.trim().toLowerCase();
    if (!q) {
      $('#searchDropdown').style.display = 'none';
      activeIndex = -1;
      return;
    }
    const list = products
      .filter((p) => (p.name || '').toLowerCase().includes(q) || (p.vendor || '').toLowerCase().includes(q))
      .slice(0, 50);
    activeIndex = 0;
    renderDropdown(list);
  }

  (async () => {
    await ensureSampleProduct();
    await syncProducts();
    if (!products.length) {
      await ensureSampleProduct();
      await syncProducts();
    }
    await syncOrders();
    refreshSearchResults();
    $('#searchInput').addEventListener('input', refreshSearchResults);
  })();
  $('#searchInput').addEventListener('keydown', (e) => {
    const dd = $('#searchDropdown');
    if (dd.style.display !== 'block') return;
    const items = Array.from(dd.querySelectorAll('.item'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      highlightActive();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightActive();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items[activeIndex]) items[activeIndex].click();
    }
    if (e.key === 'Escape') {
      dd.style.display = 'none';
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) $('#searchDropdown').style.display = 'none';
  });

  $('#histWrap').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'edit') startEditOrder(id);
    if (action === 'delete') deleteOrder(id);
  });

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 200);
    }, 1500);
  }

  $('#due').value = todayISO();
});
