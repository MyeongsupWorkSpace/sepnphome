/* 제품 등록 페이지 스크립트 (인라인 제거 버전) */
(function(){
  // 유틸
  const ID_MAP = {
    vendorListArea: 'vendorList',
    btnVendorManage: 'btnVendorModal',
    btnVendorComplete: 'btnVendorClose',
    prodPaperType: 'prodPaper',
    prodLaminateType: 'prodLaminate',
    paperModal: 'paperModal',
    paperTypeInput: 'paperTypeInput',
    paperWeightInput: 'paperWeightInput',
    btnPaperCancel: 'btnPaperCancel',
    btnPaperSave: 'btnPaperSave',
    btnVendorUpdate: null,
    btnVendorDelete: null
  };
  const $ = id => {
    if (id in ID_MAP) {
      const mapped = ID_MAP[id];
      return mapped ? document.getElementById(mapped) : null;
    }
    return document.getElementById(id);
  };
  const qs = sel => document.querySelector(sel);

  // 상태
  let selectedVendor = null;
  let editingProduct = null;
  window.getEditingProduct = () => editingProduct;

  function getCurrentUserName(){
    const fromSession = sessionStorage.getItem('sepnp_emp_name');
    if(fromSession) return fromSession;
    try{
      const authData = localStorage.getItem('sepnp_auth');
      if(authData){
        const parsed = JSON.parse(authData);
        if(parsed?.user?.name) return parsed.user.name;
      }
    }catch{}
    return '관리자';
  }

  window.getCurrentUserName = getCurrentUserName;

  // --- VENDOR (거래처) 관리 ---
  let allowVendorModal = false;
  async function fetchVendors(){
    try{
      return (await window.API?.listSuppliers?.('')) || [];
    }catch(e){
      console.warn('fetchVendors failed', e);
      return [];
    }
  }

  function renderVendorList(list){
    const wrap = $('vendorListArea');
    wrap.innerHTML = '';
    if(!list.length){
      wrap.innerHTML = '<div class="mini">거래처가 없습니다.</div>';
      return;
    }
    list.forEach(v=>{
      const el = document.createElement('div');
      el.style.padding='8px';
      el.style.borderBottom='1px solid #eee';
      el.style.display='flex';
      el.style.justifyContent='space-between';
      el.style.alignItems='center';
      el.innerHTML = `<div style="min-width:0">
                        <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.name}</div>
                        <div class="mini">${v.contact||''} ${v.phone||''}</div>
                      </div>
                      <div style="margin-left:8px">
                        <button class="btn select-vendor" data-id="${v.id}">선택</button>
                      </div>`;
      wrap.appendChild(el);
    });
    // 바인딩
    wrap.querySelectorAll('.select-vendor').forEach(b=>{
      b.addEventListener('click', async e=>{
        const id = b.dataset.id;
        const chosen = list.find(x=>String(x.id)===String(id));
        if(chosen){
          selectVendor(chosen);
          closeVendorModal();
        }
      });
    });
  }

  async function openVendorModal(){
    if (!allowVendorModal) return;
    allowVendorModal = false;
    const modal = $('vendorModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('show');
    setVendorTab('search');
    if ($('vendorSearch')) $('vendorSearch').value = '';
    const list = await fetchVendors();
    renderVendorList(list);
    $('vendorSearch')?.focus();
  }
  function closeVendorModal(){
    allowVendorModal = false;
    const modal = $('vendorModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  function selectVendor(v){
    selectedVendor = v;
    $('prodVendor').value = v.name;
    $('prodVendor').dataset.vendorId = v.id;
  }

  async function handleVendorSearch(){
    const q = $('vendorSearch').value.trim().toLowerCase();
    const list = await fetchVendors();
    const filtered = list.filter(v => (v.name||'').toLowerCase().includes(q) || (v.contact||'').toLowerCase().includes(q));
    renderVendorList(filtered);
  }

  // Vendor add/update/delete (간단 구현)
  async function vendorAdd(){
    const name = ($('vendorNameInput')?.value || '').trim();
    const contact = ($('vendorContactInput')?.value || '').trim();
    const phone = ($('vendorPhoneInput')?.value || '').trim();
    if(!name){ alert('거래처명을 입력하세요.'); return; }
    try{
      await window.API?.postSupplier?.({ name, contact, phone });
      if ($('vendorNameInput')) $('vendorNameInput').value = '';
      if ($('vendorContactInput')) $('vendorContactInput').value = '';
      if ($('vendorPhoneInput')) $('vendorPhoneInput').value = '';
      const list = await fetchVendors();
      renderVendorList(list);
      setVendorTab('search');
    }catch(e){ alert('거래처 추가 실패'); console.error(e); }
  }

  function setVendorTab(tab){
    const tabs = document.querySelectorAll('#vendorTabs .modal-tab');
    const sections = document.querySelectorAll('#vendorModal .modal-section');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    sections.forEach(s => s.classList.toggle('active', s.dataset.section === tab));
  }

  async function vendorDelete(){
    const id = $('vendorListArea').querySelector('.select-vendor')?.dataset?.id;
    // 단순화: 삭제는 리스트에서 선택후 처리 별도 구현 권장
    alert('거래처 삭제는 목록에서 항목 선택 후 구현하세요.');
  }

  // --- PAPER (용지 / 합지) 관리 ---
  async function loadPapers(){
    try{
      const list = (await window.API?.listPapers?.()) || [];
      populatePaperSelects(list);
      return list;
    }catch(e){
      console.warn('loadPapers failed', e);
      return [];
    }
  }

  function populatePaperSelects(list){
    const selP = $('prodPaperType');
    const selL = $('prodLaminateType');
    const makeOpt = (p) => {
      const weight = p.weight ?? p.grammage ?? p.gsm ?? p.basisWeight ?? null;
      const o = document.createElement('option');
      o.value = p.id ?? (`local:${p.name}`);
      if (weight) {
        o.textContent = `${p.name} (${weight}g)`;
      } else {
        o.textContent = p.name + (p.size ? ` (${p.size})` : '');
      }
      return o;
    };
    // 기본 초기화
    [selP, selL].forEach(s => { s.innerHTML = '<option value="">용지 선택</option>'; });
    list.forEach(p=>{
      selP.appendChild(makeOpt(p));
      selL.appendChild(makeOpt(p));
    });
  }

  async function openPaperModal(){
    const modal = $('paperModal');
    if (!modal) return;
    modal.classList.add('show');
    if ($('paperTypeInput')) $('paperTypeInput').value = '';
    if ($('paperWeightInput')) $('paperWeightInput').value = '';
    $('paperTypeInput')?.focus();
  }
  function closePaperModal(){ $('paperModal')?.classList.remove('show'); }

  // 저장: 용지 + 평량
  async function savePaperEntries(){
    const rawType = ($('paperTypeInput')?.value || '').trim();
    const type = rawType.toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
    const weightRaw = ($('paperWeightInput')?.value || '').trim();
    const weight = weightRaw.replace(/[^0-9.]/g, '');

    if(!type){ alert('용지를 입력하세요.'); return; }
    if(!weight){ alert('평량을 입력하세요.'); return; }

    try{
      let createdId = null;
      try{
        const created = await window.API?.postPaper?.({ name: type, weight: weight });
        createdId = created?.id || null;
      }catch(e){
        console.warn('create paper failed', e);
      }

      // 3) reload select list and select created item if possible
      const list = await loadPapers();
      if(createdId){
        // 선택
        ['prodPaperType','prodLaminateType'].forEach(sid=>{
          const s = $(sid);
          const opt = Array.from(s.options).find(o => String(o.value) === String(createdId));
          if(opt) s.value = createdId;
        });
      } else {
        // fallback: select option by matching text
        ['prodPaperType','prodLaminateType'].forEach(sid=>{
          const s = $(sid);
          const targetText = `${type} (${weight}g)`;
          const opt = Array.from(s.options).find(o => o.textContent === targetText);
          if(opt) s.value = opt.value;
        });
      }

      alert('용지 등록 완료');
      closePaperModal();
    }catch(e){
      console.error(e);
      alert('용지 등록 중 오류');
    }
  }

  // --- 초기화 바인딩 ---
  function setSelectByValueOrText(selectEl, value, text){
    if(!selectEl) return;
    if(value){
      const match = Array.from(selectEl.options).find(o => String(o.value) === String(value));
      if(match){ selectEl.value = match.value; return; }
    }
    if(text){
      const match = Array.from(selectEl.options).find(o => (o.textContent || '').includes(text));
      if(match){ selectEl.value = match.value; }
    }
  }

  function setEditModeUI(){
    const h2 = document.querySelector('main h2');
    if(h2) h2.textContent = '제품 수정';
    const submitBtn = document.querySelector('button[form="productForm"]');
    if(submitBtn) submitBtn.textContent = '수정 저장';
  }

  async function hydrateEditMode(){
    const id = new URLSearchParams(location.search).get('id');
    if(!id) return;
    let list = [];
    try{ list = await window.API?.getProducts?.(); }catch{ list = []; }
    const product = (Array.isArray(list) ? list : []).find(p => String(p.id) === String(id));
    if(!product){ alert('수정할 제품을 찾을 수 없습니다.'); return; }
    editingProduct = product;
    window.getEditingProduct = () => editingProduct;
    setEditModeUI();

    $('prodVendor').value = product.vendor || '';
    if(product.vendorId) $('prodVendor').dataset.vendorId = product.vendorId;
    $('prodName').value = product.name || '';

    if(product.size){
      $('prodL').value = product.size.l ?? product.size.length ?? '';
      $('prodW').value = product.size.w ?? product.size.width ?? '';
      $('prodH').value = product.size.h ?? product.size.height ?? '';
    }

    const paper = product.paper || {};
    setSelectByValueOrText($('prodPaperType'), paper.id, paper.type || paper.name);
    $('paperW').value = paper.sizeW ?? paper.size_w ?? '';
    $('paperH').value = paper.sizeH ?? paper.size_h ?? '';

    const noLaminate = !!product.noLaminate || product.laminate === '없음';
    const noLaminateEl = document.getElementById('noLaminate');
    if(noLaminateEl){
      noLaminateEl.checked = noLaminate;
      noLaminateEl.dispatchEvent(new Event('change'));
    }
    if(!noLaminate){
      setSelectByValueOrText($('prodLaminateType'), product.laminateId, product.laminate || product.lamination?.name || product.lamination?.type);
      $('lamW').value = product.laminationSize?.w ?? '';
      $('lamH').value = product.laminationSize?.h ?? '';
    }

    $('prodPrice').value = product.price ?? '';
    $('prodCut').value = product.cutCount ?? '';
    $('knifeW').value = product.knifeSize?.w ?? '';
    $('knifeH').value = product.knifeSize?.h ?? '';

    if(typeof window.setProcessPayload === 'function'){
      window.setProcessPayload({
        processes: product.processes || [],
        processDetails: product.processDetails || {}
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    // 안전장치: 로드시 열려있는 모달 강제 닫기
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));

    const vendorModal = $('vendorModal');
    if (vendorModal) {
      vendorModal.classList.remove('show');
      vendorModal.style.display = 'none';
    }

    // 모달 배경 클릭/ESC 닫기
    const vendorModalEl = $('vendorModal');
    if (vendorModalEl) {
      vendorModalEl.addEventListener('click', (e) => {
        if (e.target === vendorModalEl) closeVendorModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVendorModal();
        closePaperModal();
      }
    });

    const paperModalEl = $('paperModal');
    if (paperModalEl) {
      paperModalEl.addEventListener('click', (e) => {
        if (e.target === paperModalEl) closePaperModal();
      });
    }

    // vendor modal open
    $('btnVendorManage')?.addEventListener('click', () => {
      allowVendorModal = true;
      openVendorModal();
    });
    $('btnVendorClose')?.addEventListener('click', closeVendorModal);
    $('btnVendorComplete')?.addEventListener('click', ()=>{ closeVendorModal(); });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btnVendorClose') closeVendorModal();
    });

    document.querySelectorAll('#vendorTabs .modal-tab').forEach(btn => {
      btn.addEventListener('click', () => setVendorTab(btn.dataset.tab));
    });

    $('vendorSearch')?.addEventListener('input', debounce(handleVendorSearch, 250));
    $('btnVendorAdd')?.addEventListener('click', vendorAdd);
    $('btnVendorUpdate')?.addEventListener('click', ()=>alert('거래처 수정 기능은 추후 구현하세요.'));
    $('btnVendorDelete')?.addEventListener('click', vendorDelete);

    // paper modal open
    $('btnAddPaper')?.addEventListener('click', openPaperModal);
    $('btnAddLaminate')?.addEventListener('click', openPaperModal);
    $('btnPaperCancel')?.addEventListener('click', closePaperModal);
    $('btnPaperSave')?.addEventListener('click', savePaperEntries);

    $('paperTypeInput')?.addEventListener('input', (e) => {
      const val = e.target.value || '';
      e.target.value = val.toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ');
    });
    $('paperWeightInput')?.addEventListener('input', (e) => {
      const val = e.target.value || '';
      e.target.value = val.replace(/[^0-9.]/g, '');
    });

    // load initial lists
    await loadPapers();
    await hydrateEditMode();
    await seedSampleProduct();
  });

  async function seedSampleProduct(){
    const seedKey = 'sepnp_products_sample_seeded';
    if(localStorage.getItem(seedKey)) return;
    let list = [];
    try{ list = await window.API?.getProducts?.(); }catch{ list = []; }
    if(Array.isArray(list) && list.length) return;

    const nowIso = new Date().toISOString();
    const currentUser = getCurrentUserName();
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
      processes: ['인쇄','코팅','톰슨','접착'],
      processDetails: {},
      createdAt: nowIso,
      createdBy: currentUser
    };

    try{
      await window.API?.createProduct?.(payload);
      localStorage.setItem(seedKey, '1');
    }catch(e){
      console.warn('sample product seed failed', e);
    }
  }

  // debounce
  function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

  // expose for debugging
  window._pr = { openVendorModal, openPaperModal, loadPapers };

})();

// 제품 등록
async function submitProductForm(evt) {
  evt.preventDefault();

  const getNum = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const v = (el.value || '').trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const getText = (sel) => {
    const el = document.querySelector(sel);
    return el ? (el.value || '').trim() : '';
  };

  const getSelectText = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return '';
    if (!el.value) return '';
    return el.options?.[el.selectedIndex]?.textContent?.trim() || '';
  };

  const splitNameAndSize = (text) => {
    if (!text) return { name: '', sizeText: '' };
    const m = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m) return { name: m[1].trim(), sizeText: m[2].trim() };
    return { name: text.trim(), sizeText: '' };
  };

  const vendorInput = document.querySelector('#prodVendor');
  const vendor = (vendorInput?.value || '').trim();
  const vendorId = vendorInput?.dataset?.vendorId || null;
  const name = getText('#prodName');

  if (!name) {
    alert('제품명을 입력하세요.');
    return;
  }

  const size = {
    l: getNum('#prodL'),
    w: getNum('#prodW'),
    h: getNum('#prodH')
  };
  const sizeHas = [size.l, size.w, size.h].some(v => v != null);

  const paperText = getSelectText('#prodPaper');
  const paperSplit = splitNameAndSize(paperText);
  const paperType = paperSplit.name;
  const paperId = document.querySelector('#prodPaper')?.value || null;
  const paperW = getNum('#paperW');
  const paperH = getNum('#paperH');
  const paperSizeText = paperSplit.sizeText || '';
  const paperWeightNum = paperSizeText ? Number(paperSizeText.replace(/[^0-9.]/g, '')) : null;
  const paperWeight = Number.isFinite(paperWeightNum) ? paperWeightNum : null;
  const paper = (paperType || paperW != null || paperH != null || paperWeight != null) ? {
    id: paperId,
    type: paperType || null,
    sizeW: paperW,
    sizeH: paperH,
    sizeText: paperSizeText || null,
    size: paperSizeText || null,
    weight: paperWeight,
    weightText: paperSizeText || null
  } : null;

  const noLaminate = document.querySelector('#noLaminate')?.checked;
  const laminateText = noLaminate ? '' : getSelectText('#prodLaminate');
  const laminateSplit = splitNameAndSize(laminateText);
  const laminateName = noLaminate ? null : laminateSplit.name;
  const laminateId = noLaminate ? null : (document.querySelector('#prodLaminate')?.value || null);
  const lamW = getNum('#lamW');
  const lamH = getNum('#lamH');
  const laminationSize = (!noLaminate && (lamW != null || lamH != null)) ? { w: lamW, h: lamH } : null;
  const laminationSizeText = (!noLaminate && !laminationSize && laminateSplit.sizeText) ? laminateSplit.sizeText : null;

  const price = getNum('#prodPrice');
  const cutCount = getNum('#prodCut');
  const knifeW = getNum('#knifeW');
  const knifeH = getNum('#knifeH');

  const processPayload = window.getProcessPayload?.() || { processes: [], processDetails: {} };

  const nowIso = new Date().toISOString();
  const currentUser = getCurrentUserName();
  const payload = {
    name,
    vendor: vendor || null,
    vendorId,
    size: sizeHas ? size : null,
    paper,
    noLaminate: !!noLaminate,
    laminate: noLaminate ? '없음' : (laminateName || null),
    laminateId,
    laminationSize,
    laminationSizeText,
    price,
    cutCount,
    knifeSize: (knifeW != null || knifeH != null) ? { w: knifeW, h: knifeH } : null,
    processes: processPayload.processes || [],
    processDetails: processPayload.processDetails || {}
  };

  const editingProduct = typeof window.getEditingProduct === 'function' ? window.getEditingProduct() : null;

  if(editingProduct){
    payload.updatedAt = nowIso;
    payload.updatedBy = currentUser;
    payload.createdAt = editingProduct.createdAt || nowIso;
    payload.createdBy = editingProduct.createdBy || currentUser;
  }else{
    payload.createdAt = nowIso;
    payload.createdBy = currentUser;
  }

  try {
    let id = '로컬';
    if(editingProduct){
      await window.API?.updateProduct?.(editingProduct.id, payload);
      id = editingProduct.id || id;
    }else{
      const created = await window.API?.createProduct?.(payload);
      id = created?.id || created?.data?.id || id;
    }
    try {
      const list = await window.API?.getProducts?.();
      if (Array.isArray(list)) {
        await window.API.setKV('sepnp_products', list);
        localStorage.setItem('sepnp_products', JSON.stringify(list));
      }
    } catch {}
    alert(editingProduct ? '제품 수정 완료: ' + id : '제품 등록 완료: ' + id);
  } catch (e) {
    console.error(e);
    alert(editingProduct ? '수정 실패' : '등록 실패');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('productForm')?.addEventListener('submit', submitProductForm);
});

