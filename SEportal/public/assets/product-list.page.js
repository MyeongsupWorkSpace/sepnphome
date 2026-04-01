const empNo = sessionStorage.getItem('sepnp_emp_no');
if (!empNo) {
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('sepnp_emp_no');
      window.location.href = 'index.html';
    });
  }
});

const $ = (s) => document.querySelector(s);
const NF = new Intl.NumberFormat('ko-KR');

let products = [];
let currentProduct = null;

async function loadProducts() {
  try {
    const list = await window.API.getProducts();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function renderStats() {
  products = await loadProducts();
  $('#statTotal').textContent = products.length;

  const vendors = new Set(products.map((p) => p.vendor).filter(Boolean));
  $('#statVendors').textContent = vendors.size;
}

function renderVendorFilter() {
  const vendors = [...new Set(products.map((p) => p.vendor).filter(Boolean))].sort();
  const select = $('#filterVendor');
  const currentValue = select.value;

  select.innerHTML =
    '<option value="">전체 거래처</option>' + vendors.map((v) => `<option value="${v}">${v}</option>`).join('');

  if (currentValue) select.value = currentValue;
}

function renderTable() {
  const container = $('#tableContainer');
  const searchTerm = $('#searchInput').value.toLowerCase();
  const vendorFilter = $('#filterVendor').value;

  const filtered = products.filter((p) => {
    const matchSearch =
      !searchTerm || (p.name || '').toLowerCase().includes(searchTerm) || (p.vendor || '').toLowerCase().includes(searchTerm);
    const matchVendor = !vendorFilter || p.vendor === vendorFilter;
    return matchSearch && matchVendor;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 48px;">📦</div>
        <div style="font-size: 16px; margin-bottom: 8px;">등록된 제품이 없습니다</div>
        <div style="font-size: 14px;">제품 등록 탭에서 새 제품을 등록해보세요</div>
      </div>`;
    return;
  }

  const grouped = filtered.reduce((acc, p) => {
    const key = (p.vendor || '').trim() || '미지정';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const vendorKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ko'));
  const flat = [];

  container.innerHTML = vendorKeys
    .map((vendorName) => {
      const list = grouped[vendorName] || [];
      const rows = list
        .map((p, idx) => {
          const flatIndex = flat.length;
          flat.push(p);
          return `
        <tr data-index="${flatIndex}">
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(p.vendor || '-')}</strong></td>
          <td>${escapeHtml(p.name || '-')}</td>
          <td>${escapeHtml(p.paper?.type || '-')}</td>
          <td>${formatSize(p.size)}</td>
          <td>${formatPrice(p.price)}</td>
          <td>
            <span class="badge process">${(p.processes || []).length}개</span>
          </td>
          <td style="color: #888; font-size: 12px;">
            ${formatAudit(p.createdAt, p.createdBy)}
          </td>
          <td style="color: #888; font-size: 12px;">
            ${formatAudit(p.updatedAt, p.updatedBy)}
          </td>
        </tr>`;
        })
        .join('');

      return `
      <div class="vendor-group">
        <div class="vendor-title">${escapeHtml(vendorName)} <span class="vendor-count">${list.length}</span></div>
        <table class="product-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>거래처</th>
              <th>제품명</th>
              <th>용지</th>
              <th>크기(장×폭×고)</th>
              <th>단가</th>
              <th>공정</th>
              <th style="width: 160px;">등록</th>
              <th style="width: 160px;">수정</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>`;
    })
    .join('');

  container.querySelectorAll('tbody tr').forEach((tr) => {
    const idx = Number(tr.dataset.index);
    if (!Number.isFinite(idx) || !flat[idx]) return;
    tr.addEventListener('click', () => showDetail(flat[idx]));
  });
}

function formatSize(size) {
  if (!size) return '-';
  const l = size.l || '-';
  const w = size.w || '-';
  const h = size.h || '-';
  return `${l}×${w}×${h}`;
}

function formatPrice(price) {
  if (price == null) return '-';
  return NF.format(price) + '원';
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatAudit(timestamp, by) {
  if (!timestamp && !by) return '-';
  const dateText = timestamp ? formatDate(timestamp) : '-';
  const byText = by ? escapeHtml(by) : '-';
  return `${dateText} (${byText})`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function showDetail(product) {
  currentProduct = product;
  $('#detailTitle').textContent = product.name || '제품 상세';

  const content = $('#detailContent');
  content.innerHTML = `
    <div class="detail-item">
      <label>거래처</label>
      <div class="value">${escapeHtml(product.vendor || '-')}</div>
    </div>
    <div class="detail-item">
      <label>제품명</label>
      <div class="value">${escapeHtml(product.name || '-')}</div>
    </div>
    <div class="detail-item">
      <label>크기 (장×폭×고)</label>
      <div class="value">${formatSize(product.size)}</div>
    </div>
    <div class="detail-item">
      <label>용지</label>
      <div class="value">${escapeHtml(product.paper?.type || '-')}</div>
    </div>
    <div class="detail-item">
      <label>용지 크기</label>
      <div class="value">${product.paper?.sizeW || '-'} × ${product.paper?.sizeH || '-'} mm</div>
    </div>
    <div class="detail-item">
      <label>합지 원단</label>
      <div class="value">${escapeHtml(product.laminate || '-')}</div>
    </div>
    <div class="detail-item">
      <label>원단 크기</label>
      <div class="value">${product.laminationSize ? `${product.laminationSize.w || '-'} × ${product.laminationSize.h || '-'} mm` : '-'}</div>
    </div>
    <div class="detail-item">
      <label>단가</label>
      <div class="value">${formatPrice(product.price)}</div>
    </div>
    <div class="detail-item">
      <label>절 수</label>
      <div class="value">${product.cutCount || '-'}</div>
    </div>
    <div class="detail-item">
      <label>칼규격</label>
      <div class="value">${product.knifeSize ? `${product.knifeSize.w || '-'} × ${product.knifeSize.h || '-'} mm` : '-'}</div>
    </div>
    <div class="detail-item">
      <label>배송지</label>
      <div class="value">${escapeHtml(product.shipping || '-')}</div>
    </div>
    <div class="detail-item">
      <label>담당자</label>
      <div class="value">${escapeHtml(product.manager || '-')}</div>
    </div>
    <div class="detail-item">
      <label>연락처</label>
      <div class="value">${escapeHtml(product.phone || product.managerPhone || '-')}</div>
    </div>
    <div class="detail-item">
      <label>등록</label>
      <div class="value">${formatAudit(product.createdAt, product.createdBy)}</div>
    </div>
    <div class="detail-item">
      <label>수정</label>
      <div class="value">${formatAudit(product.updatedAt, product.updatedBy)}</div>
    </div>
  `;

  const processList = $('#processList');
  if (product.processes && product.processes.length > 0) {
    processList.innerHTML = product.processes.map((p) => `<li>${escapeHtml(p)}</li>`).join('');
  } else {
    processList.innerHTML = '<li style="background: #f0f0f0; border-color: #ddd;">등록된 공정이 없습니다</li>';
  }

  $('#detailModal').classList.add('show');
}

async function deleteProduct() {
  if (!currentProduct) return;
  if (!confirm(`"${currentProduct.name}" 제품을 삭제하시겠습니까?`)) return;
  try {
    await window.API.deleteProduct(currentProduct.id);
  } catch {
    alert('삭제 실패');
    return;
  }
  products = await loadProducts();

  $('#detailModal').classList.remove('show');
  await renderStats();
  renderVendorFilter();
  renderTable();

  alert('제품이 삭제되었습니다.');
}

$('#searchInput').addEventListener('input', renderTable);
$('#filterVendor').addEventListener('change', renderTable);
$('#btnRefresh').addEventListener('click', async () => {
  await renderStats();
  renderVendorFilter();
  renderTable();
});

const detailModalEl = $('#detailModal');
if (detailModalEl) detailModalEl.classList.remove('show');

$('#btnDetailClose').addEventListener('click', () => {
  $('#detailModal').classList.remove('show');
});

$('#detailModal').addEventListener('click', (e) => {
  if (e.target === $('#detailModal')) {
    $('#detailModal').classList.remove('show');
  }
});

$('#btnDelete').addEventListener('click', deleteProduct);

$('#btnEdit').addEventListener('click', () => {
  if (!currentProduct) return;
  const id = currentProduct.id;
  if (!id) {
    alert('수정할 제품의 ID가 없습니다.');
    return;
  }
  window.location.href = `product-register.html?id=${encodeURIComponent(id)}`;
});

(async () => {
  await renderStats();
  renderVendorFilter();
  renderTable();
})();
