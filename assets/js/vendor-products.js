(function initVendorProducts(){
  const tabBar = document.querySelector('.tab-bar[role="tablist"]');
  const panelsWrap = document.getElementById('vendorProductsPanels');
  if (!tabBar || !panelsWrap) return;
  const API = window.API || ((p) => p);

  const setActiveTab = (slug) => {
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tabTarget === slug;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panelsWrap.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('is-active', panel.dataset.tabPanel === slug);
    });
  };

  const createEmptyCard = (label) => {
    const article = document.createElement('article');
    article.className = 'product-card-link is-static';
    article.innerHTML = `
      <div class="product-body">
        <h2 class="product-title">${label} 제품 준비중</h2>
        <p class="product-desc">이미지 추가 시 자동으로 표시됩니다.</p>
      </div>
    `;
    return article;
  };

  const createProductCard = (item) => {
    const article = document.createElement('article');
    article.className = 'product-card-link is-static';
    const imgHtml = item.imageUrl
      ? `<div class="product-thumb"><img src="${item.imageUrl}" alt="${item.name}" loading="lazy" /></div>`
      : '<div class="product-thumb"></div>';
    const descHtml = item.description ? `<p class="product-desc">${item.description}</p>` : '';
    article.innerHTML = `
      ${imgHtml}
      <div class="product-body">
        <h2 class="product-title">${item.name || ''}</h2>
        ${descHtml}
      </div>
    `;
    return article;
  };

  const render = (brands) => {
    tabBar.innerHTML = '';
    panelsWrap.innerHTML = '';
    if (!brands.length) {
      const empty = document.createElement('div');
      empty.className = 'section-subtle';
      empty.textContent = '등록된 제품이 없습니다.';
      panelsWrap.appendChild(empty);
      return;
    }

    brands.forEach((brand, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn${idx === 0 ? ' is-active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      btn.dataset.tabTarget = brand.slug;
      btn.textContent = brand.name;
      btn.addEventListener('click', () => setActiveTab(brand.slug));
      tabBar.appendChild(btn);

      const panel = document.createElement('section');
      panel.className = `products-grid tab-panel${idx === 0 ? ' is-active' : ''}`;
      panel.dataset.tabPanel = brand.slug;
      panel.setAttribute('aria-label', `${brand.name} 제품`);
      if (Array.isArray(brand.products) && brand.products.length) {
        brand.products.forEach(item => panel.appendChild(createProductCard(item)));
      } else {
        panel.appendChild(createEmptyCard(brand.name));
      }
      panelsWrap.appendChild(panel);
    });

    try {
      const url = new URL(location.href);
      const brand = (url.searchParams.get('brand') || '').trim().toLowerCase();
      if (brand) {
        const exists = brands.find(b => (b.slug || '').toLowerCase() === brand);
        if (exists) setActiveTab(exists.slug);
      }
    } catch {}
  };

  const load = async () => {
    try {
      const res = await fetch(API('/api/vendor_products_list.php'));
      const data = await res.json();
      const brands = Array.isArray(data?.brands) ? data.brands : [];
      render(brands);
    } catch {
      render([]);
    }
  };

  load();
})();
