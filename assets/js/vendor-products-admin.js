(function initVendorProductsAdmin(){
  const API = window.API || ((p) => p);
  const brandName = document.getElementById('brandName');
  const brandSlug = document.getElementById('brandSlug');
  const brandSort = document.getElementById('brandSort');
  const brandSave = document.getElementById('brandSave');
  const brandReset = document.getElementById('brandReset');
  const brandHint = document.getElementById('brandHint');
  const brandTable = document.getElementById('brandTable');
  const vendorSyncImages = document.getElementById('vendorSyncImages');

  const productBrand = document.getElementById('productBrand');
  const productName = document.getElementById('productName');
  const productDesc = document.getElementById('productDesc');
  const productImage = document.getElementById('productImage');
  const productImageUrl = document.getElementById('productImageUrl');
  const productSort = document.getElementById('productSort');
  const productSave = document.getElementById('productSave');
  const productReset = document.getElementById('productReset');
  const productHint = document.getElementById('productHint');
  const productTable = document.getElementById('productTable');

  if (!brandTable || !productTable) return;

  const getUser = () => { try { return JSON.parse(localStorage.getItem('sepn_user') || 'null'); } catch { return null; } };
  const rank = (getUser()?.rank || '').toString().toLowerCase();
  const canEdit = rank === 'master';
  if (!canEdit) {
    document.getElementById('brandPanel')?.classList.add('readonly');
    document.getElementById('productPanel')?.classList.add('readonly');
  }

  let state = { brands: [], products: [] };
  let editingBrandId = null;
  let editingProductId = null;

  const setHint = (el, msg, type) => {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'error');
    if (type) el.classList.add(type);
  };

  const resetBrandForm = () => {
    editingBrandId = null;
    if (brandName) brandName.value = '';
    if (brandSlug) brandSlug.value = '';
    if (brandSort) brandSort.value = '0';
    setHint(brandHint, '');
  };

  const resetProductForm = () => {
    editingProductId = null;
    if (productName) productName.value = '';
    if (productDesc) productDesc.value = '';
    if (productImage) productImage.value = '';
    if (productImageUrl) productImageUrl.value = '';
    if (productSort) productSort.value = '0';
    setHint(productHint, '');
  };

  const load = async () => {
    try {
      const res = await fetch(API('/api/vendor_products_list.php'));
      const data = res.ok ? await res.json() : null;
      state.brands = Array.isArray(data?.brands) ? data.brands : [];
      state.products = state.brands.flatMap(b => (b.products || []).map(p => ({ ...p, brandId: b.id, brandName: b.name, brandSlug: b.slug })));
      renderBrands();
      renderProducts();
      renderBrandSelect();
    } catch {
      setHint(brandHint, '데이터를 불러오지 못했습니다.', 'error');
    }
  };

  const renderBrandSelect = () => {
    if (!productBrand) return;
    productBrand.innerHTML = '';
    if (!state.brands.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '업체가 없습니다';
      productBrand.appendChild(opt);
      return;
    }
    state.brands.forEach(b => {
      const opt = document.createElement('option');
      opt.value = String(b.id);
      opt.textContent = b.name;
      productBrand.appendChild(opt);
    });
  };

  const renderBrands = () => {
    const tbody = brandTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.brands.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${b.name}</td>
        <td>${b.slug}</td>
        <td>${b.sortOrder ?? 0}</td>
        <td>
          ${canEdit ? `
            <button type="button" class="btn btn-ghost" data-action="edit" data-id="${b.id}">수정</button>
            <button type="button" class="btn btn-ghost" data-action="delete" data-id="${b.id}">삭제</button>
          ` : '<span>읽기 전용</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const renderProducts = () => {
    const tbody = productTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.products.forEach(p => {
      const img = p.imageUrl ? `<img class="thumb" src="${p.imageUrl}" alt="${p.name}" loading="lazy" />` : '<div class="thumb"></div>';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${img}</td>
        <td>${p.brandName || ''}</td>
        <td>${p.name}</td>
        <td>${p.sortOrder ?? 0}</td>
        <td>
          ${canEdit ? `
            <button type="button" class="btn btn-ghost" data-action="edit" data-id="${p.id}">수정</button>
            <button type="button" class="btn btn-ghost" data-action="delete" data-id="${p.id}">삭제</button>
          ` : '<span>읽기 전용</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const saveBrand = async () => {
    if (!canEdit) return;
    const payload = {
      id: editingBrandId || undefined,
      name: (brandName?.value || '').trim(),
      slug: (brandSlug?.value || '').trim(),
      sortOrder: parseInt(brandSort?.value || '0', 10) || 0,
    };
    if (!payload.name) {
      setHint(brandHint, '업체명을 입력하세요.', 'error');
      return;
    }
    setHint(brandHint, '저장 중...', '');
    try {
      const res = await fetch(API('/api/vendor_brand_save.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error('save_failed');
      resetBrandForm();
      await load();
      setHint(brandHint, '저장되었습니다.', 'ok');
    } catch {
      setHint(brandHint, '저장에 실패했습니다.', 'error');
    }
  };

  const saveProduct = async () => {
    if (!canEdit) return;
    const payload = {
      id: editingProductId || undefined,
      brandId: parseInt(productBrand?.value || '0', 10) || 0,
      name: (productName?.value || '').trim(),
      description: (productDesc?.value || '').trim(),
      imageUrl: (productImageUrl?.value || '').trim(),
      sortOrder: parseInt(productSort?.value || '0', 10) || 0,
    };
    if (!payload.brandId || !payload.name) {
      setHint(productHint, '업체와 제품명을 입력하세요.', 'error');
      return;
    }
    setHint(productHint, '저장 중...', '');
    try {
      const res = await fetch(API('/api/vendor_product_save.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error('save_failed');
      resetProductForm();
      await load();
      setHint(productHint, '저장되었습니다.', 'ok');
    } catch {
      setHint(productHint, '저장에 실패했습니다.', 'error');
    }
  };

  const uploadImage = async () => {
    if (!canEdit || !productImage?.files?.length) return;
    const file = productImage.files[0];
    const fd = new FormData();
    fd.append('file', file);
    setHint(productHint, '이미지 업로드 중...', '');
    try {
      const res = await fetch(API('/api/vendor_product_upload.php'), { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      const fileInfo = data?.files?.[0];
      if (!data?.ok || !fileInfo?.url) throw new Error('upload_failed');
      if (productImageUrl) productImageUrl.value = fileInfo.url;
      setHint(productHint, '이미지가 업로드되었습니다.', 'ok');
    } catch {
      setHint(productHint, '이미지 업로드에 실패했습니다.', 'error');
    }
  };

  brandSave?.addEventListener('click', saveBrand);
  brandReset?.addEventListener('click', resetBrandForm);
  vendorSyncImages?.addEventListener('click', async () => {
    if (!canEdit) return;
    vendorSyncImages.disabled = true;
    setHint(brandHint, '이미지를 불러오는 중...', '');
    try {
      const res = await fetch(API('/api/vendor_products_sync.php'), { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!data?.ok) throw new Error('sync_failed');
      await load();
      setHint(brandHint, `이미지 ${data.added || 0}건을 추가했습니다.`, 'ok');
    } catch {
      setHint(brandHint, '이미지 불러오기에 실패했습니다.', 'error');
    }
    vendorSyncImages.disabled = false;
  });
  productSave?.addEventListener('click', saveProduct);
  productReset?.addEventListener('click', resetProductForm);
  productImage?.addEventListener('change', uploadImage);

  brandTable?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id || '0', 10);
    const action = btn.dataset.action;
    const brand = state.brands.find(b => b.id === id);
    if (!brand) return;
    if (action === 'edit') {
      editingBrandId = brand.id;
      if (brandName) brandName.value = brand.name || '';
      if (brandSlug) brandSlug.value = brand.slug || '';
      if (brandSort) brandSort.value = String(brand.sortOrder ?? 0);
    }
    if (action === 'delete') {
      if (!confirm('업체와 소속 제품을 삭제할까요?')) return;
      try {
        const res = await fetch(API('/api/vendor_brand_delete.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: brand.id }),
        });
        const data = await res.json();
        if (!data?.ok) throw new Error('delete_failed');
        await load();
      } catch {
        setHint(brandHint, '삭제에 실패했습니다.', 'error');
      }
    }
  });

  productTable?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id || '0', 10);
    const action = btn.dataset.action;
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    if (action === 'edit') {
      editingProductId = product.id;
      if (productBrand) productBrand.value = String(product.brandId || '');
      if (productName) productName.value = product.name || '';
      if (productDesc) productDesc.value = product.description || '';
      if (productImageUrl) productImageUrl.value = product.imageUrl || '';
      if (productSort) productSort.value = String(product.sortOrder ?? 0);
    }
    if (action === 'delete') {
      if (!confirm('제품을 삭제할까요?')) return;
      try {
        const res = await fetch(API('/api/vendor_product_delete.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: product.id }),
        });
        const data = await res.json();
        if (!data?.ok) throw new Error('delete_failed');
        await load();
      } catch {
        setHint(productHint, '삭제에 실패했습니다.', 'error');
      }
    }
  });

  resetBrandForm();
  resetProductForm();
  load();
})();
