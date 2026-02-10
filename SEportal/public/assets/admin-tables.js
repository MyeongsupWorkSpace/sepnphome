(function(){
  const tabs = document.getElementById('resourceTabs');
  const search = document.getElementById('searchInput');
  const btnCreate = document.getElementById('btnCreate');
  const btnRefresh = document.getElementById('btnRefresh');
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');
  const editModal = document.getElementById('editModal');
  const editTitle = document.getElementById('editTitle');
  const editForm = document.getElementById('editForm');
  const btnCancel = document.getElementById('btnCancel');
  const btnSave = document.getElementById('btnSave');

  let currentResource = 'suppliers';
  let currentData = [];
  let currentItem = null;

  const STORAGE_KEYS = {
    suppliers: 'sepmp_suppliers',
    papers: 'sepmp_papers',
    materials: 'sepmp_materials',
    products: 'sepnp_products',
    users: 'sepmp_users'
  };
  const lsGet = (key, fallback=[]) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  };
  const lsSet = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const nextId = (list) => (list.reduce((m, x) => Math.max(m, Number(x.id)||0), 0) + 1);
  const loadResource = (r) => lsGet(STORAGE_KEYS[r] || r, []);
  const saveResource = (r, data) => lsSet(STORAGE_KEYS[r] || r, data);

  const schema = {
    suppliers: { cols:['id','name','contact','phone','email','created_at'], editable:['name','contact','phone','email'], title:'거래처' },
    papers:    { cols:['id','name','size','weight','description','created_at'], editable:['name','size','weight','description'], title:'용지' },
    materials: { cols:['id','name','type','unit','note','created_at'], editable:['name','type','unit','note'], title:'자재' },
    products:  { cols:['id','code','name','price','supplier_id','paper_id','created_at'], editable:['code','name','description','price','supplier_id','paper_id'], title:'제품' },
    users:     { cols:['id','username','display_name','email','role_id','is_active','created_at'], editable:['username','password','display_name','email','role_id','is_active'], title:'사용자' }
  };

  // 탭 클릭
  tabs.addEventListener('click', (e)=>{
    const t = e.target.closest('button[data-r]');
    if(!t) return;
    tabs.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    t.classList.add('active');
    currentResource = t.dataset.r;
    loadList();
  });

  btnRefresh.addEventListener('click', ()=> loadList());
  btnCreate.addEventListener('click', ()=> openEdit(null));

  search.addEventListener('input', debounce(()=> renderTable(currentData, search.value.trim()), 200));

  btnCancel.addEventListener('click', ()=> { editModal.classList.remove('show'); currentItem=null; });

  btnSave.addEventListener('click', async ()=>{
    const payload = {};
    const ed = schema[currentResource].editable;
    ed.forEach(k=>{
      const el = editForm.querySelector(`[name="${k}"]`);
      if(!el) return;
      if(el.type==='checkbox') payload[k] = el.checked ? 1 : 0;
      else payload[k] = el.value;
    });

    try {
      const list = loadResource(currentResource);
      if(currentItem && currentItem.id){
        const idx = list.findIndex(x => String(x.id) === String(currentItem.id));
        if(idx >= 0) list[idx] = { ...list[idx], ...payload };
      } else {
        list.push({ id: nextId(list), ...payload, created_at: new Date().toISOString() });
      }
      saveResource(currentResource, list);
      editModal.classList.remove('show');
      await loadList();
    } catch (err) {
      alert('저장 실패: ' + (err.message || err));
      console.error(err);
    }
  });

  async function loadList(){
    tableHead.innerHTML = '';
    tableBody.innerHTML = '<tr><td colspan="10">로딩...</td></tr>';
    const s = schema[currentResource];
    try {
      const data = loadResource(currentResource);
      currentData = Array.isArray(data) ? data : [];
      renderTable(currentData, search.value.trim());
    } catch (e) {
      console.error(e);
      tableBody.innerHTML = `<tr><td colspan="10">조회 중 오류: ${e.message}</td></tr>`;
    }
  }

  function renderTable(rows, q){
    const s = schema[currentResource];
    // header
    tableHead.innerHTML = '<tr>' + s.cols.map(c=>`<th>${c}</th>`).join('') + '<th>작업</th></tr>';
    // filter
    let filtered = rows;
    if(q){
      const ql = q.toLowerCase();
      filtered = rows.filter(r => Object.values(r).join(' ').toLowerCase().includes(ql));
    }
    // body
    if(!filtered.length){
      tableBody.innerHTML = `<tr><td colspan="${s.cols.length+1}">항목 없음</td></tr>`;
      return;
    }
    tableBody.innerHTML = filtered.map(row=>{
      const cells = s.cols.map(c=>`<td>${escapeHtml(row[c]===null||row[c]===undefined?'':String(row[c]))}</td>`).join('');
      return `<tr data-id="${row.id}">${cells}<td class="actions">
        <button class="btn" data-act="edit">편집</button>
        <button class="btn" data-act="del">삭제</button>
      </td></tr>`;
    }).join('');
    // 바인딩
    tableBody.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const tr = e.target.closest('tr');
        const id = tr.dataset.id;
        const act = e.target.dataset.act;
        const item = currentData.find(x=>String(x.id)===String(id));
        if(act==='edit') openEdit(item);
        if(act==='del') {
          if(!confirm('정말 삭제합니까?')) return;
          try{
            const list = loadResource(currentResource).filter(x => String(x.id) !== String(id));
            saveResource(currentResource, list);
            await loadList();
          }catch(err){ alert('삭제 실패'); console.error(err); }
        }
      });
    });
  }

  function openEdit(item){
    currentItem = item;
    editTitle.textContent = item ? `${schema[currentResource].title} 편집` : `${schema[currentResource].title} 생성`;
    editForm.innerHTML = '';
    const ed = schema[currentResource].editable;
    ed.forEach(k=>{
      const val = item && (item[k]!==undefined) ? item[k] : '';
      const row = document.createElement('div');
      row.className = 'form-row';
      const label = document.createElement('label');
      label.textContent = k;
      let input;
      if(k==='description' || k==='note') {
        input = document.createElement('textarea'); input.rows=3;
      } else if(k==='is_active') {
        input = document.createElement('input'); input.type='checkbox'; input.checked = !!val;
      } else if(k==='role_id' || k==='supplier_id' || k==='paper_id') {
        input = document.createElement('input'); input.type='text'; input.placeholder='id 입력 또는 생략';
        input.value = val || '';
      } else {
        input = document.createElement('input'); input.type='text'; input.value = val || '';
      }
      input.name = k;
      row.appendChild(label);
      row.appendChild(input);
      editForm.appendChild(row);
    });
    editModal.classList.add('show');
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function debounce(fn, t){ let h; return (...a)=>{ clearTimeout(h); h=setTimeout(()=>fn(...a), t); }; }

  // 초기 로드
  loadList();

})();