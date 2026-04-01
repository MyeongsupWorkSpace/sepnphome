PortalStore.hydrate(['sepnp_inventory_products','sepnp_dispatches','sepnp_vehicles','sepnp_customers','sepnp_destinations']).then(() => {
  const KEY_PRODUCTS  = 'sepnp_inventory_products';
  const KEY_DISPATCH  = 'sepnp_dispatches';
  const KEY_VEHICLES  = 'sepnp_vehicles';
  const KEY_CUSTOMERS = 'sepnp_customers';
  const KEY_DESTS     = 'sepnp_destinations';

  const SAMPLE_PRODUCTS = [
    {id:'p1', name:'화장품 박스', length:200, width:120, height:60, vendor:'세팍패키지', qty:340, safety:100, unit:'개', lastIn:'2025-01-18'},
    {id:'p2', name:'식품 박스',   length:180, width:100, height:80, vendor:'푸드팩',   qty:40,  safety:80,  unit:'개', lastIn:'2025-01-22'},
    {id:'p3', name:'의류 택박스', length:90,  width:60,  height:40, vendor:'어패럴',   qty:12,  safety:50,  unit:'개', lastIn:'2024-12-30'}
  ];

  const $ = s=>document.querySelector(s);
  const fmtNum = v => Number(v||0).toLocaleString();
  const fmtBox = (l,w,h)=>`${fmtNum(l)}×${fmtNum(w)}×${fmtNum(h)}`;
  const today = () => new Date().toISOString().slice(0,10);

  let currentEditId = null;

  function loadProducts(){
    let list = JSON.parse(localStorage.getItem(KEY_PRODUCTS)||'null');
    if(!Array.isArray(list) || !list.length){ list = SAMPLE_PRODUCTS; localStorage.setItem(KEY_PRODUCTS, JSON.stringify(list)); }
    list.forEach(p=>{ if(!p.id) p.id = `${p.name}|${p.length}x${p.width}x${p.height}`; });
    return list;
  }
  function saveProducts(list){ localStorage.setItem(KEY_PRODUCTS, JSON.stringify(list)); }
  function loadDispatch(){ return JSON.parse(localStorage.getItem(KEY_DISPATCH)||'[]'); }
  function saveDispatch(list){ localStorage.setItem(KEY_DISPATCH, JSON.stringify(list)); }
  function loadVehicles(){ return JSON.parse(localStorage.getItem(KEY_VEHICLES)||'[]'); }
  function saveVehicles(list){ localStorage.setItem(KEY_VEHICLES, JSON.stringify(list)); }
  function loadCustomers(){ return JSON.parse(localStorage.getItem(KEY_CUSTOMERS)||'[]'); }
  function saveCustomers(list){ localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(list)); }
  function loadDests(){ return JSON.parse(localStorage.getItem(KEY_DESTS)||'[]'); }
  function saveDests(list){ localStorage.setItem(KEY_DESTS, JSON.stringify(list)); }

  // 통계 업데이트
  function updateStats(){
    const list = loadDispatch();
    const todayStr = today();
    
    const todayCount = list.filter(r => r.date === todayStr && r.status !== 'cancel').length;
    const progressCount = list.filter(r => r.status === 'progress').length;
    const doneCount = list.filter(r => r.status === 'done').length;
    const cancelCount = list.filter(r => r.status === 'cancel').length;

    $('#statToday').textContent = todayCount;
    $('#statProgress').textContent = progressCount;
    $('#statDone').textContent = doneCount;
    $('#statCancel').textContent = cancelCount;
  }

  // 차량/기사 모달
  function showVehicleModal(){
    const modal = $('#vehicleModal');
    modal.setAttribute('data-open', 'true');
    modal.classList.add('show');
    modal.style.display = 'flex';
    $('#newVehicle').value = '';
    $('#newDriver').value = '';
    $('#newVehicle').focus();
  }

  function closeVehicleModal(){
    const modal = $('#vehicleModal');
    modal.setAttribute('data-open', 'false');
    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  function addVehicle(){
    const vehicle = $('#newVehicle').value.trim();
    const driver = $('#newDriver').value.trim();
    if(!vehicle || !driver){ alert('차량번호와 기사명을 모두 입력하세요.'); return; }
    
    const list = loadVehicles();
    list.push({vehicle, driver});
    saveVehicles(list);
    
    renderVehicleSelects();
    closeVehicleModal();
    
    $('#vehicleSel').value = vehicle;
    $('#driverSel').value = driver;
  }

  function renderVehicleSelects(){
    const list = loadVehicles();
    const vSel = $('#vehicleSel');
    const dSel = $('#driverSel');
    const evSel = $('#editVehicle');
    const edSel = $('#editDriver');
    
    const currentV = vSel?.value;
    const currentD = dSel?.value;
    const editV = evSel?.value;
    const editD = edSel?.value;

    const vOptions = '<option value="">-- 선택 --</option>' + list.map(v=>`<option value="${v.vehicle}">${v.vehicle}</option>`).join('');
    const dOptions = '<option value="">-- 선택 --</option>' + list.map(v=>`<option value="${v.driver}">${v.driver}</option>`).join('');

    if(vSel) vSel.innerHTML = vOptions;
    if(dSel) dSel.innerHTML = dOptions;
    if(evSel) evSel.innerHTML = vOptions;
    if(edSel) edSel.innerHTML = dOptions;

    if(currentV && vSel) vSel.value = currentV;
    if(currentD && dSel) dSel.value = currentD;
    if(editV && evSel) evSel.value = editV;
    if(editD && edSel) edSel.value = editD;
  }

  $('#vehicleSel')?.addEventListener('change', ()=>{
    const veh = $('#vehicleSel').value;
    if(!veh) return;
    const list = loadVehicles();
    const found = list.find(v=>v.vehicle === veh);
    if(found) $('#driverSel').value = found.driver;
  });

  $('#driverSel')?.addEventListener('change', ()=>{
    const drv = $('#driverSel').value;
    if(!drv) return;
    const list = loadVehicles();
    const found = list.find(v=>v.driver === drv);
    if(found) $('#vehicleSel').value = found.vehicle;
  });

  // 거래처 모달
  function showCustomerModal(){
    const modal = $('#customerModal');
    modal.setAttribute('data-open', 'true');
    modal.classList.add('show');
    modal.style.display = 'flex';
    $('#newCustomer').value = '';
    $('#newCustomer').focus();
  }

  function closeCustomerModal(){
    const modal = $('#customerModal');
    modal.setAttribute('data-open', 'false');
    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  function addCustomer(){
    const customer = $('#newCustomer').value.trim();
    if(!customer){ alert('거래처명을 입력하세요.'); return; }
    
    const list = loadCustomers();
    if(list.includes(customer)){ alert('이미 등록된 거래처입니다.'); return; }
    
    list.push(customer);
    saveCustomers(list);
    
    renderCustomerSelect();
    closeCustomerModal();
    
    $('#customerSel').value = customer;
  }

  function renderCustomerSelect(){
    const list = loadCustomers();
    const sel = $('#customerSel');
    const editSel = $('#editCustomer');
    const current = sel?.value;
    const editCurrent = editSel?.value;

    const options = '<option value="">-- 선택 --</option>' + list.map(c=>`<option value="${c}">${c}</option>`).join('');

    if(sel) sel.innerHTML = options;
    if(editSel) editSel.innerHTML = options;

    if(current && sel) sel.value = current;
    if(editCurrent && editSel) editSel.value = editCurrent;
  }

  // 배송지 모달
  function showDestModal(){
    const modal = $('#destModal');
    modal.setAttribute('data-open', 'true');
    modal.classList.add('show');
    modal.style.display = 'flex';
    $('#newDest').value = '';
    $('#newDest').focus();
  }

  function closeDestModal(){
    const modal = $('#destModal');
    modal.setAttribute('data-open', 'false');
    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  function addDest(){
    const dest = $('#newDest').value.trim();
    if(!dest){ alert('배송지를 입력하세요.'); return; }
    
    const list = loadDests();
    if(list.includes(dest)){ alert('이미 등록된 배송지입니다.'); return; }
    
    list.push(dest);
    saveDests(list);
    
    renderDestSelect();
    closeDestModal();
    
    $('#destSel').value = dest;
  }

  function renderDestSelect(){
    const list = loadDests();
    const sel = $('#destSel');
    const editSel = $('#editDest');
    const current = sel?.value;
    const editCurrent = editSel?.value;

    const options = '<option value="">-- 선택 --</option>' + list.map(d=>`<option value="${d}">${d}</option>`).join('');

    if(sel) sel.innerHTML = options;
    if(editSel) editSel.innerHTML = options;

    if(current && sel) sel.value = current;
    if(editCurrent && editSel) editSel.value = editCurrent;
  }

  // 제품 선택
  function renderProductSelect(){
    const list = loadProducts();
    $('#productSel').innerHTML = list.map(p => 
      `<option value="${p.id}">${p.name} (재고: ${fmtNum(p.qty)}${p.unit||''})</option>`
    ).join('');
    onProductChange();
  }

  function onProductChange(){
    const id = $('#productSel').value;
    const p = loadProducts().find(x=>x.id===id);
    if(!p){ 
      $('#stockNow').textContent='-'; 
      $('#specNow').textContent=''; 
      $('#unitNow').textContent=''; 
      return; 
    }
    $('#stockNow').textContent = fmtNum(p.qty);
    $('#unitNow').textContent  = p.unit||'';
    $('#specNow').textContent  = ` · ${fmtBox(p.length,p.width,p.height)}`;
    $('#qtyOut').max = p.qty;
    $('#qtyOut').placeholder = `최대 ${fmtNum(p.qty)}`;
  }

  // 등록
  function registerDispatch(){
    if(!Permissions.has('dispatch.create')){ alert('권한이 없습니다.'); return; }
    const id = $('#productSel').value;
    const list = loadProducts();
    const p = list.find(x=>x.id===id);
    if(!p){ alert('제품을 선택하세요.'); return; }

    const qty = parseInt($('#qtyOut').value||'0',10);
    if(!qty || qty<=0){ alert('출고 수량을 입력하세요.'); return; }
    if(qty > p.qty){ alert('재고보다 많은 수량을 출고할 수 없습니다.'); return; }

    const vehicle = $('#vehicleSel').value.trim();
    const driver = $('#driverSel').value.trim();
    const customer = $('#customerSel').value.trim();
    const dest = $('#destSel').value.trim();

    const rec = {
      id: 'd'+Date.now(),
      date: $('#shipDate').value || today(),
      productId: p.id,
      productName: p.name,
      spec: fmtBox(p.length,p.width,p.height),
      qty, unit: p.unit||'',
      customer,
      dest,
      vehicle,
      driver,
      memo: $('#memo').value.trim(),
      status: 'wait',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };

    p.qty = (p.qty||0) - qty;
    saveProducts(list);

    const ds = loadDispatch();
    ds.unshift(rec);
    saveDispatch(ds);

    alert('배차가 등록되었습니다.');
    onProductChange();
    renderTable();
    updateStats();
    resetForm(false);
  }

  // 수정 모달
  function showEditModal(id){
    const ds = loadDispatch();
    const rec = ds.find(r=>r.id===id);
    if(!rec){ alert('기록을 찾을 수 없습니다.'); return; }
    
    currentEditId = id;
    
    $('#editProductName').value = `${rec.productName} (${rec.spec})`;
    $('#editDate').value = rec.date;
    $('#editQty').value = rec.qty;
    $('#editCustomer').value = rec.customer || '';
    $('#editDest').value = rec.dest || '';
    $('#editVehicle').value = rec.vehicle || '';
    $('#editDriver').value = rec.driver || '';
    $('#editStatus').value = rec.status === 'cancel' ? 'wait' : rec.status;
    $('#editMemo').value = rec.memo || '';
    
    // 취소된 배차는 상태 변경 불가
    $('#editStatus').disabled = rec.status === 'cancel';
    
    const modal = $('#editModal');
    modal.setAttribute('data-open', 'true');
    modal.classList.add('show');
    modal.style.display = 'flex';
    // 모달 내부 버튼 권한 적용
    Permissions.applyGates($('#editModal'));
  }

  function closeEditModal(){
    currentEditId = null;
    const modal = $('#editModal');
    modal.setAttribute('data-open', 'false');
    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  function saveEdit(){
    if(!Permissions.has('dispatch.edit')){ alert('권한이 없습니다.'); return; }
    if(!currentEditId){ alert('오류가 발생했습니다.'); return; }
    
    const ds = loadDispatch();
    const rec = ds.find(r=>r.id===currentEditId);
    if(!rec){ alert('기록을 찾을 수 없습니다.'); return; }
    
    if(rec.status === 'cancel'){
      alert('취소된 배차는 수정할 수 없습니다.');
      return;
    }
    
    const newQty = parseInt($('#editQty').value||'0',10);
    if(!newQty || newQty<=0){ alert('수량을 입력하세요.'); return; }
    
    const oldStatus = rec.status;
    const newStatus = $('#editStatus').value;
    
    // 수량이 변경된 경우 재고 조정
    if(newQty !== rec.qty){
      const diff = newQty - rec.qty;
      const list = loadProducts();
      const p = list.find(x=>x.id===rec.productId);
      if(p){
        if(diff > 0 && p.qty < diff){
          alert('재고가 부족합니다.');
          return;
        }
        p.qty = (p.qty||0) - diff;
        saveProducts(list);
      }
    }
    
    // 상태별 타임스탬프 업데이트
    if(newStatus === 'progress' && oldStatus === 'wait'){
      rec.startedAt = new Date().toISOString();
    }
    if(newStatus === 'done' && oldStatus !== 'done'){
      rec.completedAt = new Date().toISOString();
    }
    
    rec.date = $('#editDate').value;
    rec.qty = newQty;
    rec.customer = $('#editCustomer').value.trim();
    rec.dest = $('#editDest').value.trim();
    rec.vehicle = $('#editVehicle').value.trim();
    rec.driver = $('#editDriver').value.trim();
    rec.status = newStatus;
    rec.memo = $('#editMemo').value.trim();
    
    saveDispatch(ds);
    
    alert('수정되었습니다.');
    closeEditModal();
    renderTable();
    updateStats();
    onProductChange();
  }

  function cancelDispatchFromEdit(){
    if(!Permissions.has('dispatch.cancel')){ alert('권한이 없습니다.'); return; }
    if(!currentEditId){ alert('오류가 발생했습니다.'); return; }
    if(!confirm('배차를 취소하고 재고를 복원할까요?')) return;
    
    cancelDispatch(currentEditId);
    closeEditModal();
  }

  function removeDispatchFromEdit(){
    if(!Permissions.has('dispatch.delete')){ alert('권한이 없습니다.'); return; }
    if(!currentEditId){ alert('오류가 발생했습니다.'); return; }
    if(!confirm('이 배차를 삭제할까요?')) return;
    
    removeDispatch(currentEditId);
    closeEditModal();
  }

  // 상태 변경
  function changeStatus(id, newStatus){
    if(!Permissions.has('dispatch.edit')){ alert('권한이 없습니다.'); return; }
    const ds = loadDispatch();
    const rec = ds.find(r=>r.id===id);
    if(!rec){ alert('기록을 찾을 수 없습니다.'); return; }
    
    const oldStatus = rec.status;
    
    // 취소 상태에서는 변경 불가
    if(oldStatus === 'cancel'){
      alert('취소된 배차는 상태를 변경할 수 없습니다.');
      return;
    }

    // 상태별 타임스탬프 업데이트
    if(newStatus === 'progress' && oldStatus === 'wait'){
      rec.startedAt = new Date().toISOString();
    }
    if(newStatus === 'done' && oldStatus !== 'done'){
      rec.completedAt = new Date().toISOString();
    }

    rec.status = newStatus;
    saveDispatch(ds);
    renderTable();
    updateStats();
  }

  function cancelDispatch(id){
    if(!Permissions.has('dispatch.cancel')){ alert('권한이 없습니다.'); return; }
    const ds = loadDispatch();
    const rec = ds.find(r=>r.id===id);
    if(!rec){ alert('기록을 찾을 수 없습니다.'); return; }
    if(rec.status==='cancel'){ alert('이미 취소된 배차입니다.'); return; }

    const list = loadProducts();
    const p = list.find(x=>x.id===rec.productId);
    if(p){ p.qty = (p.qty||0) + (rec.qty||0); saveProducts(list); }

    rec.status='cancel';
    saveDispatch(ds);

    renderTable();
    updateStats();
    onProductChange();
  }

  function removeDispatch(id){
    if(!Permissions.has('dispatch.delete')){ alert('권한이 없습니다.'); return; }
    const ds = loadDispatch();
    const rec = ds.find(r=>r.id===id);
    if(!rec){ alert('기록을 찾을 수 없습니다.'); return; }
    if(rec.status==='done' || rec.status==='progress'){
      if(!confirm('완료/진행 중 기록을 삭제하면 재고 복원이 되지 않습니다. 계속할까요?')) return;
    }
    const next = ds.filter(r=>r.id!==id);
    saveDispatch(next);
    renderTable();
    updateStats();
  }

  function getStatusLabel(status){
    const labels = {
      'wait': '대기',
      'progress': '진행',
      'done': '완료',
      'cancel': '취소'
    };
    return labels[status] || status;
  }

  function renderTable(){
    const q = $('#q').value.trim().toLowerCase();
    const st = $('#st').value;
    const from = $('#from').value;
    const to = $('#to').value;

    let rows = loadDispatch();
    rows = rows.filter(r=>{
      const text = `${r.productName} ${r.customer} ${r.dest} ${r.spec}`.toLowerCase();
      const passQ = !q || text.includes(q);
      const passS = !st || r.status === st;
      const passFrom = !from || r.date >= from;
      const passTo   = !to   || r.date <= to;
      return passQ && passS && passFrom && passTo;
    });

    $('#tbody').innerHTML = rows.map(r=>{
      const canEditStatus = Permissions.has('dispatch.edit') && r.status !== 'cancel';
      const statusDropdown = canEditStatus ? `
        <div class="status-dropdown">
          <select onchange="changeStatus('${r.id}', this.value)" style="background:${getStatusColor(r.status)};color:${getStatusTextColor(r.status)}">
            <option value="wait" ${r.status==='wait'?'selected':''}>대기</option>
            <option value="progress" ${r.status==='progress'?'selected':''}>진행</option>
            <option value="done" ${r.status==='done'?'selected':''}>완료</option>
          </select>
        </div>
      ` : `<span class="status ${r.status}">${getStatusLabel(r.status)}</span>`;

      const editBtn = `<button class="btn sm primary" onclick="showEditModal('${r.id}')" ${Permissions.has('dispatch.edit') ? '' : 'disabled title="권한이 없습니다"'}>수정</button>`;

      return `
      <tr>
        <td>${r.date}</td>
        <td>${r.productName}</td>
        <td>${r.spec}</td>
        <td>${r.customer||'-'}</td>
        <td>${r.dest||'-'}</td>
        <td class="align-right">${fmtNum(r.qty)}${r.unit||''}</td>
        <td>${r.vehicle||'-'}</td>
        <td>${r.driver||'-'}</td>
        <td>${statusDropdown}</td>
        <td>${editBtn}</td>
      </tr>`;
    }).join('');
  }

  function getStatusColor(status){
    const colors = {
      'wait': '#fef3c7',
      'progress': '#dbeafe',
      'done': '#d1fae5',
      'cancel': '#fee2e2'
    };
    return colors[status] || '#fff';
  }

  function getStatusTextColor(status){
    const colors = {
      'wait': '#92400e',
      'progress': '#1e40af',
      'done': '#065f46',
      'cancel': '#991b1b'
    };
    return colors[status] || '#111';
  }

  function exportCSV(){
    const rows = loadDispatch();
    const header = ['배차일','제품명','규격','거래처','배송지','수량','단위','차량','기사','상태','출발시각','완료시각','비고'];
    const body = rows.map(r=>{
      const statusText = getStatusLabel(r.status);
      const startTime = r.startedAt ? new Date(r.startedAt).toLocaleString('ko-KR') : '-';
      const endTime = r.completedAt ? new Date(r.completedAt).toLocaleString('ko-KR') : '-';
      return [r.date,r.productName,r.spec,r.customer||'',r.dest||'',r.qty,r.unit||'',r.vehicle||'',r.driver||'',statusText,startTime,endTime,r.memo||''];
    });
    const csv = [header].concat(body).map(a=>a.map(v=>`"${(v??'').toString().replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dispatch_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  function resetForm(hard=true){
    if(hard) $('#productSel').selectedIndex = 0;
    $('#qtyOut').value='';
    $('#customerSel').selectedIndex = 0;
    $('#destSel').selectedIndex = 0;
    $('#vehicleSel').selectedIndex = 0;
    $('#driverSel').selectedIndex = 0;
    $('#memo').value='';
    $('#shipDate').value = today();
    onProductChange();
  }

  function forceCloseModals(){
    ['vehicleModal','customerModal','destModal','editModal'].forEach(id => {
      const modal = document.getElementById(id);
      if(!modal) return;
      modal.setAttribute('data-open', 'false');
      modal.classList.remove('show');
      modal.style.display = 'none';
    });
  }

  window.addEventListener('pageshow', forceCloseModals);

  function initDispatchPage(){
    forceCloseModals();
    renderVehicleSelects();
    renderCustomerSelect();
    renderDestSelect();
    renderProductSelect();
    $('#shipDate').value = today();
    renderTable();
    updateStats();

    $('#productSel').addEventListener('change', onProductChange);
    $('#btnRegister').addEventListener('click', registerDispatch);
    $('#btnReset').addEventListener('click', ()=>resetForm(false));
    $('#btnExport').addEventListener('click', exportCSV);
    $('#btnSearch').addEventListener('click', renderTable);
    
    ['q','from','to','st'].forEach(id=>{
      const el = document.getElementById(id);
      el && el.addEventListener('change', renderTable);
      if(id==='q') el && el.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); renderTable(); } });
    });

    $('#vehicleModal').addEventListener('click', e=>{ if(e.target.id === 'vehicleModal') closeVehicleModal(); });
    $('#customerModal').addEventListener('click', e=>{ if(e.target.id === 'customerModal') closeCustomerModal(); });
    $('#destModal').addEventListener('click', e=>{ if(e.target.id === 'destModal') closeDestModal(); });
    $('#editModal').addEventListener('click', e=>{ if(e.target.id === 'editModal') closeEditModal(); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initDispatchPage);
  }else{
    initDispatchPage();
  }

  window.receiveProduction = function(payload){
    const {id,name,length,width,height,qty,unit} = payload||{};
    if(!name || !qty) return;
    const list = loadProducts();
    let p = list.find(x=> x.id===id) || list.find(x=> x.name===name && x.length==length && x.width==width && x.height==height);
    if(!p){
      p = { id: id || `${name}|${length}x${width}x${height}`, name, length, width, height, vendor:'', qty:0, safety:0, unit: unit||'개', lastIn: new Date().toISOString().slice(0,10) };
      list.push(p);
    }
    p.qty = (p.qty||0) + Number(qty||0);
    p.unit = p.unit || unit || '개';
    p.lastIn = new Date().toISOString().slice(0,10);
    saveProducts(list);
  };
});
