(function initNoticesList(){
  const lists = {
    all: document.querySelector('[data-notice-list="all"]'),
    notice: document.querySelector('[data-notice-list="notice"]'),
    company: document.querySelector('[data-notice-list="company"]'),
  };
  if (!lists.all) return;
  const totalEl = document.getElementById('noticeTotal');
  const searchInput = document.getElementById('noticeSearch');
  const pageSizeSelect = document.getElementById('noticePageSize');
  const pagerEl = document.getElementById('noticePager');
  const API = window.API || ((p) => p);
  const state = { items: [], tab: 'all', page: 1, pageSize: 6, q: '' };
  if (pageSizeSelect && pageSizeSelect.value) {
    state.pageSize = parseInt(pageSizeSelect.value, 10) || 6;
  }

  const createItem = (item) => {
    const li = document.createElement('li');
    li.className = 'news-item';
    const badge = document.createElement('span');
    badge.className = `news-badge${item.category === 'company' ? ' badge-news' : ''}`;
    badge.textContent = item.category === 'company' ? '소식' : '공지';
    const pin = document.createElement('span');
    pin.className = 'news-pin';
    pin.textContent = item.is_pinned ? '고정' : '';
    const body = document.createElement('div');
    body.className = 'news-item-body';
    const title = document.createElement('a');
    title.className = 'news-title';
    title.href = `notice.html?id=${item.id}`;
    title.textContent = item.title || '';
    const summary = document.createElement('p');
    summary.className = 'news-summary';
    summary.textContent = item.summary || '';
    const date = document.createElement('span');
    date.className = 'news-date';
    date.textContent = item.date ? item.date.replace(/-/g, '.') : '';
    body.append(title, summary);
    li.append(badge, body, date);
    if (item.is_pinned) li.appendChild(pin);
    return li;
  };

  const renderList = (el, items) => {
    if (!el) return;
    el.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'news-item notice-empty';
      empty.textContent = '등록된 공지가 없습니다.';
      el.appendChild(empty);
      return;
    }
    items.forEach(item => el.appendChild(createItem(item)));
  };

  const applyFilters = () => {
    const q = (state.q || '').toLowerCase();
    const byTab = state.tab === 'all'
      ? state.items
      : state.items.filter(i => i.category === state.tab);
    const filtered = byTab.filter(i => !q || (i.title || '').toLowerCase().includes(q) || (i.summary || '').toLowerCase().includes(q));
    if (totalEl) totalEl.textContent = `${filtered.length}건`;
    return filtered;
  };

  const renderPager = (total) => {
    if (!pagerEl) return;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    const makeBtn = (label, page, active = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `page-btn${active ? ' active' : ''}`;
      btn.textContent = label;
      btn.dataset.page = String(page);
      return btn;
    };
    pagerEl.innerHTML = '';
    pagerEl.appendChild(makeBtn('이전', Math.max(1, state.page - 1)));
    for (let i = 1; i <= totalPages; i += 1) {
      pagerEl.appendChild(makeBtn(String(i), i, i === state.page));
    }
    pagerEl.appendChild(makeBtn('다음', Math.min(totalPages, state.page + 1)));
  };

  const renderAll = () => {
    const filtered = applyFilters();
    const start = (state.page - 1) * state.pageSize;
    const slice = filtered.slice(start, start + state.pageSize);
    renderList(lists.all, state.tab === 'all' ? slice : []);
    renderList(lists.notice, state.tab === 'notice' ? slice : []);
    renderList(lists.company, state.tab === 'company' ? slice : []);
    renderPager(filtered.length);
  };

  const load = async () => {
    try {
      const res = await fetch(API('/api/notices_list.php?limit=100'));
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      state.items = Array.isArray(data) ? data : [];
      renderAll();
    } catch {
      renderList(lists.all, []);
      renderList(lists.notice, []);
      renderList(lists.company, []);
      if (totalEl) totalEl.textContent = '0건';
    }
  };

  searchInput?.addEventListener('input', () => {
    state.q = searchInput.value || '';
    state.page = 1;
    renderAll();
  });

  pageSizeSelect?.addEventListener('change', () => {
    state.pageSize = parseInt(pageSizeSelect.value, 10) || 6;
    state.page = 1;
    renderAll();
  });

  document.querySelectorAll('.news-tab-list .tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('aria-controls') || '';
      if (target.includes('company')) state.tab = 'company';
      else if (target.includes('notice') && !target.includes('all')) state.tab = 'notice';
      else state.tab = 'all';
      state.page = 1;
      renderAll();
    });
  });

  pagerEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-btn');
    if (!btn) return;
    const page = parseInt(btn.dataset.page, 10);
    if (Number.isNaN(page)) return;
    state.page = page;
    renderAll();
  });

  load();
})();
