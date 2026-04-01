PortalStore.hydrate(['sepnp_inventory_products', 'sepnp_inventory_papers']).then(() => {
  (function () {
    const SAMPLE_PRODUCTS = [
      {
        id: 'p1',
        name: '화장품 박스',
        length: 200,
        width: 120,
        height: 60,
        vendor: '세팍패키지',
        qty: 340,
        safety: 100,
        unit: '개',
        lastIn: '2025-01-18'
      },
      {
        id: 'p2',
        name: '식품 박스',
        length: 180,
        width: 100,
        height: 80,
        vendor: '푸드팩',
        qty: 40,
        safety: 80,
        unit: '개',
        lastIn: '2025-01-22'
      },
      {
        id: 'p3',
        name: '의류 택박스',
        length: 90,
        width: 60,
        height: 40,
        vendor: '어패럴',
        qty: 0,
        safety: 50,
        unit: '개',
        lastIn: '2024-12-30'
      }
    ];
    const SAMPLE_PAPERS = [
      {
        id: 'pp1',
        name: '아트지 250g',
        width: 900,
        height: 600,
        grain: '세로결',
        vendor: '세팍상사',
        qty: 1200,
        safety: 500,
        unit: '매',
        lastIn: '2025-01-25'
      },
      {
        id: 'pp2',
        name: '골판 A플루트',
        width: 1200,
        height: 800,
        grain: '가로결',
        vendor: '한국지류',
        qty: 80,
        safety: 100,
        unit: '매',
        lastIn: '2025-01-20'
      },
      {
        id: 'pp3',
        name: '백판지 350g',
        width: 800,
        height: 500,
        grain: '세로결',
        vendor: '대한제지',
        qty: 0,
        safety: 200,
        unit: '매',
        lastIn: '2025-01-10'
      }
    ];
    const KEY_PRODUCTS = 'sepnp_inventory_products';
    const KEY_PAPERS = 'sepnp_inventory_papers';

    const $ = (s) => document.querySelector(s);
    const tab = () => $('.tab.active')?.dataset.tab || 'product';

    const fmtNum = (v) => Number(v || 0).toLocaleString();
    const fmtBox = (l, w, h) => `${fmtNum(l)}×${fmtNum(w)}×${fmtNum(h)}mm`;
    const fmtSize = (w, h) => `${fmtNum(w)}×${fmtNum(h)}mm`;
    const statusClass = (q, s) => (q <= 0 ? 'out' : q < s ? 'low' : 'ok');
    const statusLabel = (c) => (c === 'ok' ? '정상' : c === 'low' ? '부족' : '품절');

    function load(key, sample) {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(raw) && raw.length) return raw;
      sample.forEach((item, idx) => {
        if (!item.id) item.id = `${key}_${idx}_${Date.now()}`;
      });
      localStorage.setItem(key, JSON.stringify(sample));
      return sample;
    }

    function save(key, list) {
      localStorage.setItem(key, JSON.stringify(list));
    }

    const LIMITS = { qty: 1000000, dim: 100000 };

    const normalizeText = (val) => (val || '').toString().trim().toLowerCase();

    function isDuplicateItem(list, item, type) {
      const nameKey = normalizeText(item.name);
      const vendorKey = normalizeText(item.vendor);
      return list.some((x) => {
        if (normalizeText(x.name) !== nameKey) return false;
        if (vendorKey && normalizeText(x.vendor) !== vendorKey) return false;
        if (type === 'product') {
          return Number(x.length) === item.length && Number(x.width) === item.width && Number(x.height) === item.height;
        }
        return (
          Number(x.width) === item.width &&
          Number(x.height) === item.height &&
          normalizeText(x.grain) === normalizeText(item.grain)
        );
      });
    }

    function validateItem(item, type, list, mode) {
      if (!item.name) return '품목명을 입력하세요.';
      if (type === 'product') {
        if (item.length <= 0 || item.width <= 0 || item.height <= 0) return '규격(장/폭/고)을 입력하세요.';
        if (item.length > LIMITS.dim || item.width > LIMITS.dim || item.height > LIMITS.dim)
          return `규격은 최대 ${LIMITS.dim}mm까지 입력할 수 있습니다.`;
      } else {
        if (item.width <= 0 || item.height <= 0) return '원단 크기(가로/세로)를 입력하세요.';
        if (item.width > LIMITS.dim || item.height > LIMITS.dim)
          return `원단 크기는 최대 ${LIMITS.dim}mm까지 입력할 수 있습니다.`;
      }
      if (item.qty < 0 || item.safety < 0) return '현재고/안전재고는 0 이상이어야 합니다.';
      if (item.qty > LIMITS.qty || item.safety > LIMITS.qty)
        return `재고 값은 최대 ${LIMITS.qty.toLocaleString()}까지 입력할 수 있습니다.`;
      if (mode === 'create' && isDuplicateItem(list, item, type)) return '이미 등록된 품목입니다.';
      return '';
    }

    let editingItem = null;
    let editingType = null;
    let editingMode = 'edit';

    function forceCloseModal() {
      const modal = document.getElementById('editModal');
      if (!modal) return;
      modal.setAttribute('data-open', 'false');
      modal.classList.remove('show');
      modal.style.display = 'none';
    }

    forceCloseModal();

    window.openEditModal = function (id, type) {
      editingMode = 'edit';
      editingType = type;
      const key = type === 'product' ? KEY_PRODUCTS : KEY_PAPERS;
      const list = load(key, type === 'product' ? SAMPLE_PRODUCTS : SAMPLE_PAPERS);
      const item = list.find((i) => i.id === id);
      if (!item) {
        alert('항목을 찾을 수 없습니다.');
        return;
      }

      editingItem = item;

      $('#modalTitle').textContent = type === 'product' ? '제품 재고 수정' : '용지 재고 수정';
      $('#btnDelete').style.display = '';

      if (type === 'product') {
        $('#productForm').style.display = '';
        $('#paperForm').style.display = 'none';
        $('#editProductName').value = item.name || '';
        $('#editLength').value = item.length || 0;
        $('#editWidth').value = item.width || 0;
        $('#editHeight').value = item.height || 0;
        $('#editProductUnit').value = item.unit || '개';
      } else {
        $('#productForm').style.display = 'none';
        $('#paperForm').style.display = '';
        $('#editPaperName').value = item.name || '';
        $('#editPaperWidth').value = item.width || 0;
        $('#editPaperHeight').value = item.height || 0;
        $('#editGrain').value = item.grain || '';
        $('#editPaperUnit').value = item.unit || '매';
      }

      $('#editVendor').value = item.vendor || '';
      $('#editQty').value = item.qty || 0;
      $('#editSafety').value = item.safety || 0;
      $('#editLastIn').value = item.lastIn || '';

      const modal = $('#editModal');
      modal.setAttribute('data-open', 'true');
      modal.classList.add('show');
      modal.style.display = 'flex';
    };

    function openCreateModal(type) {
      editingMode = 'create';
      editingType = type;
      const key = type === 'product' ? KEY_PRODUCTS : KEY_PAPERS;
      load(key, type === 'product' ? SAMPLE_PRODUCTS : SAMPLE_PAPERS);
      const newId = `inv_${type}_${Date.now()}`;
      editingItem = { id: newId };

      $('#modalTitle').textContent = type === 'product' ? '제품 재고 등록' : '용지 재고 등록';
      $('#btnDelete').style.display = 'none';

      if (type === 'product') {
        $('#productForm').style.display = '';
        $('#paperForm').style.display = 'none';
        $('#editProductName').value = '';
        $('#editLength').value = 0;
        $('#editWidth').value = 0;
        $('#editHeight').value = 0;
        $('#editProductUnit').value = '개';
      } else {
        $('#productForm').style.display = 'none';
        $('#paperForm').style.display = '';
        $('#editPaperName').value = '';
        $('#editPaperWidth').value = 0;
        $('#editPaperHeight').value = 0;
        $('#editGrain').value = '';
        $('#editPaperUnit').value = '매';
      }

      $('#editVendor').value = '';
      $('#editQty').value = 0;
      $('#editSafety').value = 0;
      $('#editLastIn').value = new Date().toISOString().slice(0, 10);

      const modal = $('#editModal');
      modal.setAttribute('data-open', 'true');
      modal.classList.add('show');
      modal.style.display = 'flex';
    }

    function closeEditModal() {
      const modal = $('#editModal');
      modal.setAttribute('data-open', 'false');
      modal.classList.remove('show');
      modal.style.display = 'none';
      editingItem = null;
      editingType = null;
      editingMode = 'edit';
    }

    window.closeEditModal = closeEditModal;
    window.addEventListener('pageshow', closeEditModal);

    function saveEdit() {
      if (!editingItem || !editingType) return;

      const key = editingType === 'product' ? KEY_PRODUCTS : KEY_PAPERS;
      const list = load(key, editingType === 'product' ? SAMPLE_PRODUCTS : SAMPLE_PAPERS);

      if (editingType === 'product') {
        editingItem.name = $('#editProductName').value.trim();
        editingItem.length = parseFloat($('#editLength').value) || 0;
        editingItem.width = parseFloat($('#editWidth').value) || 0;
        editingItem.height = parseFloat($('#editHeight').value) || 0;
        editingItem.unit = $('#editProductUnit').value.trim() || '개';
      } else {
        editingItem.name = $('#editPaperName').value.trim();
        editingItem.width = parseFloat($('#editPaperWidth').value) || 0;
        editingItem.height = parseFloat($('#editPaperHeight').value) || 0;
        editingItem.grain = $('#editGrain').value;
        editingItem.unit = $('#editPaperUnit').value.trim() || '매';
      }

      editingItem.vendor = $('#editVendor').value.trim();
      editingItem.qty = parseFloat($('#editQty').value) || 0;
      editingItem.safety = parseFloat($('#editSafety').value) || 0;
      editingItem.lastIn = $('#editLastIn').value;

      const err = validateItem(editingItem, editingType, list, editingMode);
      if (err) {
        alert(err);
        return;
      }

      if (editingMode === 'create') {
        list.push(editingItem);
      }

      save(key, list);
      closeEditModal();
      render();
      alert('저장되었습니다.');
    }

    function deleteItem() {
      if (!editingItem || !editingType) return;
      if (!confirm('이 항목을 삭제하시겠습니까?')) return;

      const key = editingType === 'product' ? KEY_PRODUCTS : KEY_PAPERS;
      const list = load(key, editingType === 'product' ? SAMPLE_PRODUCTS : SAMPLE_PAPERS);
      const filtered = list.filter((i) => i.id !== editingItem.id);

      save(key, filtered);
      closeEditModal();
      render();
      alert('삭제되었습니다.');
    }

    function renderHead() {
      if (tab() === 'product') {
        $('#thead').innerHTML =
          '<tr>' +
          '<th class="align-left">제품명</th>' +
          '<th class="align-center">규격(장×폭×고)</th>' +
          '<th class="align-left">거래처</th>' +
          '<th class="align-right">현재고</th>' +
          '<th class="align-right">안전재고</th>' +
          '<th class="align-center">상태</th>' +
          '<th class="align-center">최종입고일</th>' +
          '<th class="align-center">관리</th>' +
          '</tr>';
      } else {
        $('#thead').innerHTML =
          '<tr>' +
          '<th class="align-left">용지명</th>' +
          '<th class="align-center">원단 크기</th>' +
          '<th class="align-center">결</th>' +
          '<th class="align-left">거래처</th>' +
          '<th class="align-right">현재고</th>' +
          '<th class="align-right">안전재고</th>' +
          '<th class="align-center">상태</th>' +
          '<th class="align-center">최종입고일</th>' +
          '<th class="align-center">관리</th>' +
          '</tr>';
      }
    }

    function rowsTemplate(list) {
      const t = tab();
      return list
        .map((it) => {
          const st = statusClass(it.qty, it.safety);
          if (t === 'product') {
            return (
              '<tr>' +
              `<td class="align-left">${it.name}</td>` +
              `<td class="align-center">${fmtBox(it.length, it.width, it.height)}</td>` +
              `<td class="align-left">${it.vendor || ''}</td>` +
              `<td class="align-right">${fmtNum(it.qty)}${it.unit || ''}</td>` +
              `<td class="align-right">${fmtNum(it.safety)}${it.unit || ''}</td>` +
              `<td class="align-center"><span class="badge ${st}">${statusLabel(st)}</span></td>` +
              `<td class="align-center">${it.lastIn || ''}</td>` +
              `<td class="align-center"><button class="btn" style="height:28px;padding:0 10px;font-size:12px" onclick="openEditModal('${it.id}','product')">수정</button></td>` +
              '</tr>'
            );
          }
          return (
            '<tr>' +
            `<td class="align-left">${it.name}</td>` +
            `<td class="align-center">${fmtSize(it.width, it.height)}</td>` +
            `<td class="align-center">${it.grain || ''}</td>` +
            `<td class="align-left">${it.vendor || ''}</td>` +
            `<td class="align-right">${fmtNum(it.qty)}${it.unit || ''}</td>` +
            `<td class="align-right">${fmtNum(it.safety)}${it.unit || ''}</td>` +
            `<td class="align-center"><span class="badge ${st}">${statusLabel(st)}</span></td>` +
            `<td class="align-center">${it.lastIn || ''}</td>` +
            `<td class="align-center"><button class="btn" style="height:28px;padding:0 10px;font-size:12px" onclick="openEditModal('${it.id}','paper')">수정</button></td>` +
            '</tr>'
          );
        })
        .join('');
    }

    function render() {
      const t = tab();
      $('#grain').style.display = t === 'paper' ? '' : 'none';

      renderHead();

      const q = $('#q').value.trim().toLowerCase();
      const st = $('#status').value;
      const g = $('#grain').value;

      const list = t === 'product' ? load(KEY_PRODUCTS, SAMPLE_PRODUCTS) : load(KEY_PAPERS, SAMPLE_PAPERS);
      const filtered = list.filter((it) => {
        const text = (
          t === 'product'
            ? `${it.name} ${it.vendor} ${fmtBox(it.length, it.width, it.height)}`
            : `${it.name} ${it.vendor} ${fmtSize(it.width, it.height)} ${it.grain || ''}`
        ).toLowerCase();
        const okQ = !q || text.includes(q);
        const sc = statusClass(it.qty, it.safety);
        const okS = !st || sc === st;
        const okG = t === 'paper' ? !g || it.grain === g : true;
        return okQ && okS && okG;
      });

      $('#tbody').innerHTML = rowsTemplate(filtered);

      const all = list;
      $('#statTotal').textContent = `${all.length}개`;
      $('#statOk').textContent = `${all.filter((i) => statusClass(i.qty, i.safety) === 'ok').length}개`;
      $('#statLow').textContent = `${all.filter((i) => statusClass(i.qty, i.safety) === 'low').length}개`;
      $('#statOut').textContent = `${all.filter((i) => statusClass(i.qty, i.safety) === 'out').length}개`;
    }

    function initInventoryPage() {
      ['q', 'status', 'grain'].forEach((id) => {
        const el = document.getElementById(id);
        el && el.addEventListener('change', render);
        if (id === 'q') el && el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            render();
          }
        });
      });
      ['tabProduct', 'tabPaper'].forEach((id) => {
        const el = document.getElementById(id);
        el.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
          el.classList.add('active');
          render();
        });
      });
      document.getElementById('btnSearch').addEventListener('click', render);
      document.getElementById('btnRegister').addEventListener('click', () => openCreateModal(tab()));
      document.getElementById('btnExport').addEventListener('click', () => {
        const t = tab();
        const rows = t === 'product' ? load(KEY_PRODUCTS, SAMPLE_PRODUCTS) : load(KEY_PAPERS, SAMPLE_PAPERS);
        const header =
          t === 'product'
            ? ['제품명', '장(mm)', '폭(mm)', '고(mm)', '거래처', '현재고', '안전재고', '단위', '최종입고일']
            : ['용지명', '가로(mm)', '세로(mm)', '결', '거래처', '현재고', '안전재고', '단위', '최종입고일'];
        const body = rows.map((r) =>
          t === 'product'
            ? [r.name, r.length, r.width, r.height, r.vendor, r.qty, r.safety, r.unit || '', r.lastIn || '']
            : [r.name, r.width, r.height, r.grain || '', r.vendor, r.qty, r.safety, r.unit || '', r.lastIn || '']
        );
        const csv = [header]
          .concat(body)
          .map((a) => a.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `inventory_${t}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });

      $('#btnCancel').addEventListener('click', closeEditModal);
      $('#btnSave').addEventListener('click', saveEdit);
      $('#btnDelete').addEventListener('click', deleteItem);
      $('#editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeEditModal();
      });

      closeEditModal();
      render();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initInventoryPage);
    } else {
      initInventoryPage();
    }
  })();
});
