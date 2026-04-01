// Year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Site settings helpers
function getSiteSettings() {
  try {
    const raw = localStorage.getItem('sepn_site_settings');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function setSiteSettings(settings) {
  const prev = getSiteSettings();
  const next = { ...prev, ...settings };
  localStorage.setItem('sepn_site_settings', JSON.stringify(next));
  return next;
}
function applySiteSettingsUI() {
  const s = getSiteSettings();
  // Footer company name
  const fb = document.querySelector('.footer-bottom');
  if (fb && s.company) {
    fb.innerHTML = `© <span id="year"></span> ${s.company}.`;
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }
  // Contact/info placeholders
  const map = [
    ['site-company','company'],
    ['site-phone','phone'],
    ['site-address','address'],
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (el && s[key]) el.textContent = s[key];
  }
}
applySiteSettingsUI();

// Footer policy links
function applyFooterPolicyLinks() {
  try {
    const prefix = '/pages';
    const links = document.querySelectorAll('.footer-links .footer-link');
    if (!links.length) return;
    links.forEach((a) => {
      const label = (a.textContent || '').trim();
      const href = (a.getAttribute('href') || '').trim();
      if (label.includes('개인정보처리방침')) {
        if (!href || href === '#') a.setAttribute('href', `${prefix}/privacy.html`);
      } else if (label.includes('이용약관')) {
        if (!href || href === '#') a.setAttribute('href', `${prefix}/terms.html`);
      } else if (label.includes('문의하기')) {
        if (!href || href === '#') a.setAttribute('href', `${prefix}/quote.html`);
      }
    });
  } catch {}
}
applyFooterPolicyLinks();

// API base: always use same-origin paths
const API_BASE = '';
window.API_BASE = API_BASE;
const API = (p) => `${p}`;

function getPortalUrl() {
  return '/SEportal/public/index.html';
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

function getLocalUser() {
  try { return JSON.parse(localStorage.getItem('sepn_user') || 'null'); } catch { return null; }
}

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
let navBackdrop = null;

function closeNav() {
  siteNav?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
  if (navBackdrop) {
    navBackdrop.remove();
    navBackdrop = null;
  }
  document.body.classList.remove('no-scroll');
}

function openNav() {
  siteNav?.classList.add('open');
  navToggle?.setAttribute('aria-expanded', 'true');
  if (!navBackdrop) {
    navBackdrop = document.createElement('div');
    navBackdrop.className = 'nav-backdrop';
    navBackdrop.addEventListener('click', closeNav);
    document.body.appendChild(navBackdrop);
  }
  document.body.classList.add('no-scroll');
}

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.contains('open');
    (isOpen ? closeNav : openNav)();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });
}

// Close mobile nav on link click
try {
  siteNav?.querySelectorAll('a')?.forEach(link => {
    link.addEventListener('click', () => { closeNav(); });
  });
} catch {}

// Skip link + main id
try {
  const mainEl = document.querySelector('main');
  if (mainEl && !mainEl.id) mainEl.id = 'mainContent';
  if (!document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#mainContent';
    skip.textContent = '본문 바로가기';
    document.body.prepend(skip);
  }
} catch {}

// Back to top button
try {
  if (!document.getElementById('toTopBtn')) {
    const btn = document.createElement('button');
    btn.id = 'toTopBtn';
    btn.className = 'to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', '맨 위로 이동');
    btn.textContent = '↑';
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
    const toggle = () => {
      const show = window.scrollY > 400;
      btn.classList.toggle('show', show);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }
} catch {}

// Swiper init (guard when Swiper not loaded on some pages)
let heroSwiper = null;
try {
  if (typeof Swiper !== 'undefined') {
    heroSwiper = new Swiper('.hero-swiper', {
      loop: true,
      autoplay: { delay: 7500, disableOnInteraction: false, pauseOnMouseEnter: true },
      speed: 900,
      effect: 'fade',
      fadeEffect: { crossFade: true },
      keyboard: { enabled: true },
      pagination: { el: '.hero .swiper-pagination', clickable: true },
    });
  }
} catch {}

// Click anywhere on a hero slide to go to the next slide
try {
  document.querySelectorAll('.hero .swiper-slide').forEach(slide => {
    slide.addEventListener('click', (e) => {
      if (e.target.closest('.swiper-button-prev, .swiper-button-next, .swiper-pagination')) return;
      heroSwiper.slideNext(600);
    });
  });
} catch {}

// Respect reduced motion preference: stop autoplay if requested
try {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) { heroSwiper.autoplay.stop(); }
} catch {}

// Add a pause/resume toggle to hero actions
try {
  const heroActions = document.querySelector('.hero-actions');
  if (heroActions) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn';
    let paused = false;
    const sync = () => { toggleBtn.textContent = paused ? '재생' : '일시정지'; };
    sync();
    toggleBtn.addEventListener('click', () => {
      paused = !paused;
      if (paused) { heroSwiper.autoplay.stop(); } else { heroSwiper.autoplay.start(); }
      sync();
    });
    heroActions.appendChild(toggleBtn);
  }
} catch {}

let productsSwiper = null;
function initProductShowcaseSlides() {
  const wrapper = document.querySelector('.products-swiper .swiper-wrapper');
  if (!wrapper) return;
  const prefix = '';
  const slides = [
    { title: '빼빼로 (롯데)', img: `${prefix}/assets/img/%EB%A1%AF%EB%8D%B0/%EB%B9%BC%EB%B9%BC%EB%A1%9C.png`, link: `${prefix}/pages/vendor-products.html?brand=lotte` },
    { title: '가나 마일드 (롯데)', img: `${prefix}/assets/img/%EB%A1%AF%EB%8D%B0/%EA%B0%80%EB%82%98%20%EB%A7%88%EC%9D%BC%EB%93%9C.png`, link: `${prefix}/pages/vendor-products.html?brand=lotte` },
    { title: '카프리썬 오렌지 (농심)', img: `${prefix}/assets/img/%EB%86%8D%EC%8B%AC/%EC%B9%B4%ED%94%84%EB%A6%AC%EC%8D%AC%20%EC%98%A4%EB%A0%8C%EC%A7%80.jpg`, link: `${prefix}/pages/vendor-products.html?brand=nongshim` },
    { title: '카프리썬 오렌지망고 (농심)', img: `${prefix}/assets/img/%EB%86%8D%EC%8B%AC/%EC%B9%B4%ED%94%84%EB%A6%AC%EC%8D%AC%20%EC%98%A4%EB%A0%8C%EC%A7%80%EB%A7%9D%EA%B3%A0.jfif`, link: `${prefix}/pages/vendor-products.html?brand=nongshim` },
    { title: '빅파이 딸기 (크라운)', img: `${prefix}/assets/img/%ED%81%AC%EB%9D%BC%EC%9A%B4/%EB%B9%85%ED%8C%8C%EC%9D%B4%20%EB%94%B8%EA%B8%B0.jpg`, link: `${prefix}/pages/vendor-products.html?brand=crown` },
    { title: '참크래커 (크라운)', img: `${prefix}/assets/img/%ED%81%AC%EB%9D%BC%EC%9A%B4/%EC%B0%B8%ED%81%AC%EB%9E%98%EC%BB%A4.jpg`, link: `${prefix}/pages/vendor-products.html?brand=crown` },
    { title: '네스카페 수프리모 블랙 (네슬레)', img: `${prefix}/assets/img/%EB%84%A4%EC%8A%AC%EB%A0%88/%EB%84%A4%EC%8A%A4%EC%B9%B4%ED%8E%98%20%EC%88%98%ED%94%84%EB%A6%AC%EB%AA%A8%20%EC%95%84%EB%A9%94%EB%A6%AC%EC%B9%B4%EB%85%B8%20%EB%B8%94%EB%9E%99.webp`, link: `${prefix}/pages/vendor-products.html?brand=nestle` },
    { title: '스타벅스 미디엄로스트 (네슬레)', img: `${prefix}/assets/img/%EB%84%A4%EC%8A%AC%EB%A0%88/%EC%8A%A4%ED%83%80%EB%B2%85%EC%8A%A4%20%EB%AF%B8%EB%94%94%EC%97%84%EB%A1%9C%EC%8A%A4%ED%8A%B8.webp`, link: `${prefix}/pages/vendor-products.html?brand=nestle` },
  ];
  for (let i = slides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slides[i], slides[j]] = [slides[j], slides[i]];
  }
  wrapper.innerHTML = slides.map(s => `
    <div class="swiper-slide">
      <a class="product-slide" href="${s.link}" aria-label="${s.title} 보러가기">
        <img src="${s.img}" alt="${s.title}" loading="lazy" />
        <div class="product-slide-overlay" aria-hidden="true">
          <div class="product-slide-title">${s.title}</div>
          <span class="btn btn-accent product-slide-btn">보러가기</span>
        </div>
      </a>
    </div>
  `).join('');
}

function bindProductShowcaseHover(swiperInstance) {
  const slides = document.querySelectorAll('.product-slide');
  if (!slides.length) return;
  const pause = () => { try { swiperInstance?.autoplay?.stop(); } catch {} };
  const resume = () => { try { swiperInstance?.autoplay?.start(); } catch {} };
  slides.forEach(el => {
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', resume);
  });
}

try {
  initProductShowcaseSlides();
  if (typeof Swiper !== 'undefined') {
    productsSwiper = new Swiper('.products-swiper', {
      loop: true,
      autoplay: { delay: 2500, disableOnInteraction: false },
      slidesPerView: 1,
      spaceBetween: 0,
      pagination: { el: '.split-left .swiper-pagination', clickable: true },
    });
    bindProductShowcaseHover(productsSwiper);
  }
} catch {}

// Quotes live list (SSE with polling fallback)
const listEl = document.getElementById('quotes-list');
function renderQuotes(quotes) {
  if (!Array.isArray(quotes)) return;
  const maskName = (name) => {
    const s = (name || '').toString().trim();
    if (!s) return '-';
    if (s.length === 1) return '*';
    if (s.length === 2) return s[0] + '*';
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
  };
  // 빈 목록: 15행 유지, 8번째 줄에 안내문 중앙 배치
  if (!quotes.length) {
    const emptyRows = Array.from({ length: 15 }).map((_, i) => (
      i === 7
        ? `<tr><td colspan="4" class="quotes-empty-inline">아직 등록된 견적문의가 없습니다.</td></tr>`
        : `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
    )).join('');
    const table = `
      <table class="quotes-table" aria-label="견적 문의 내역">
        <thead>
          <tr>
            <th>등록 날짜</th>
            <th>성명</th>
            <th>제목</th>
            <th>처리상태</th>
          </tr>
        </thead>
        <tbody>
          ${emptyRows}
        </tbody>
      </table>
    `;
    listEl.innerHTML = table;
    listEl.setAttribute('aria-busy', 'false');
    return;
  }
  const maxRows = 15;
  const view = quotes
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, maxRows);
  const rows = view
    .map(q => {
      const rawTs = Number(q.timestamp || 0);
      const ts = rawTs ? (rawTs < 1000000000000 ? rawTs * 1000 : rawTs) : 0;
      const dateStr = ts ? new Date(ts).toLocaleString() : '';
      const name = maskName(q.name || '-');
      const title = q.product || (q.message ? (q.message + '').slice(0, 40) + '…' : '-');
      const statusRaw = (q.status || '문의중');
      const isDone = statusRaw === '답변완료';
      const statusClass = isDone ? 'status-done' : 'status-pending';
      const statusLabel = isDone ? '답변완료' : '문의중';
      return `
        <tr>
          <td>${dateStr}</td>
          <td>${name}</td>
          <td>${title}</td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        </tr>
      `;
    })
    .join('');
  const placeholders = Array.from({ length: Math.max(0, maxRows - (view.length)) })
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
    .join('');
  const table = `
    <table class="quotes-table" aria-label="견적 문의 내역">
      <thead>
        <tr>
          <th>등록 날짜</th>
          <th>성명</th>
          <th>제목</th>
          <th>처리상태</th>
        </tr>
      </thead>
      <tbody>
        ${rows}${placeholders}
      </tbody>
    </table>
  `;
  listEl.innerHTML = table;
  listEl.setAttribute('aria-busy', 'false');
}

function initQuotesStream() {
  // Netlify Functions는 장기 SSE 스트림을 지원하지 않으므로 Netlify 도메인에서는 폴링 사용
  const isNetlify = /netlify\.app$|netlify\.com$/.test(location.hostname);
  if (isNetlify) { initQuotesPolling(); return; }
  try {
    const es = new EventSource(API('/api/quotes_sse.php'), { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        renderQuotes(data);
      } catch {}
    };
    es.onerror = () => {
      es.close();
      initQuotesPolling();
    };
  } catch {
    initQuotesPolling();
  }
}

// My quotes page
(function initMyQuotes(){
  const listWrap = document.getElementById('my-quotes-list');
  if (!listWrap) return;
  const getUser = () => { try { return JSON.parse(localStorage.getItem('sepn_user')||'null')||null; } catch { return null; } };
  const u = getUser();
  const nameKey = (u?.nickname || u?.username || '').toString().trim().toLowerCase();
  const emailKey = (u?.email || '').toString().trim().toLowerCase();

  function fmtDate(ts){
    if (!ts) return '';
    const raw = Number(ts);
    const ms = raw < 1000000000000 ? raw * 1000 : raw;
    return new Date(ms).toLocaleString();
  }

  function render(items){
    if (!Array.isArray(items) || items.length === 0){
      const emptyRows = Array.from({ length: 12 }).map((_, i) => (
        i === 5
          ? `<tr><td colspan="4" class="quotes-empty-inline">등록된 견적이 없습니다.</td></tr>`
          : `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
      )).join('');
      listWrap.innerHTML = `
        <table class="quotes-table" aria-label="내 견적 내역">
          <thead>
            <tr>
              <th>등록 날짜</th>
              <th>제품명</th>
              <th>처리상태</th>
              <th>요약</th>
            </tr>
          </thead>
          <tbody>${emptyRows}</tbody>
        </table>
      `;
      listWrap.setAttribute('aria-busy', 'false');
      return;
    }
    const rows = items.map(q => {
      const dateStr = fmtDate(q.timestamp || 0);
      const statusRaw = (q.status || '문의중');
      const isDone = statusRaw === '답변완료';
      const statusClass = isDone ? 'status-done' : 'status-pending';
      const statusLabel = isDone ? '답변완료' : '문의중';
      const summary = (q.message || q.product || '').toString().slice(0, 50);
      return `
        <tr>
          <td>${dateStr}</td>
          <td>${q.product || '-'}</td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td>${summary || '-'}</td>
        </tr>
      `;
    }).join('');
    listWrap.innerHTML = `
      <table class="quotes-table" aria-label="내 견적 내역">
        <thead>
          <tr>
            <th>등록 날짜</th>
            <th>제품명</th>
            <th>처리상태</th>
            <th>요약</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    listWrap.setAttribute('aria-busy', 'false');
  }

  async function load(){
    listWrap.setAttribute('aria-busy', 'true');
    try {
      const res = await fetchWithTimeout(API('/api/quotes_list.php'));
      const items = res.ok ? await res.json() : [];
      const filtered = (items || []).filter(q => {
        const name = (q.name || '').toString().trim().toLowerCase();
        const email = (q.email || '').toString().trim().toLowerCase();
        if (emailKey && email === emailKey) return true;
        if (nameKey && name === nameKey) return true;
        return false;
      });
      render(filtered);
    } catch {
      render([]);
    }
  }
  load();
})();

// My coupons panel
(function initMyCoupons(){
  const wrap = document.getElementById('couponList');
  if (!wrap) return;
  async function load(){
    wrap.setAttribute('aria-busy', 'true');
    try {
      const res = await fetchWithTimeout(API('/api/coupons_my.php'), { credentials: 'include' });
      const data = await res.json();
      if (!data.ok) throw new Error('failed');
      const items = Array.isArray(data.coupons) ? data.coupons : [];
      if (items.length === 0) {
        wrap.innerHTML = `<div class="quotes-empty-inline">보유 쿠폰이 없습니다.</div>`;
      } else {
        wrap.innerHTML = items.map(c => `
          <div class="coupon-card">
            <div class="coupon-title">${c.title || c.code || '쿠폰'}</div>
            <div class="coupon-desc">${c.description || ''}</div>
            <div class="coupon-qty">보유 수량: ${c.qty ?? 0}장</div>
          </div>
        `).join('');
      }
    } catch {
      wrap.innerHTML = `<div class="quotes-empty-inline">쿠폰 정보를 불러올 수 없습니다.</div>`;
    }
    wrap.setAttribute('aria-busy', 'false');
  }
  load();
})();

let pollTimer;
async function pollOnce() {
  try {
    // 1차: 정상 엔드포인트 시도
    let res = await fetchWithTimeout(API('/api/quotes_list.php'), { credentials: 'include' });
    if (!res.ok) throw new Error('fetch failed');
    let data = await res.json();
    renderQuotes(data);
  } catch (e1) {
    try {
      // 2차: 폴백 엔드포인트 사용
      const res2 = await fetchWithTimeout(API('/api/quotes_list2.php'), { credentials: 'include' });
      if (!res2.ok) throw new Error('fallback failed');
      const data2 = await res2.json();
      renderQuotes(data2);
    } catch (e2) {
      // keep last known state
    }
  }
}
function initQuotesPolling() {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, 5000);
}

if (listEl) {
  // 초기 상태를 즉시 가져오고, 이후 폴링으로 갱신 (SSE 비활성화)
  try { pollOnce(); } catch {}
  initQuotesPolling();
}

function initSimpleTabs() {
  const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
  if (!tabButtons.length || !tabPanels.length) return;
  function activateTab(nextId) {
    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('aria-controls') === nextId;
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle('is-active', panel.id === nextId);
    });
  }
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');
      if (targetId) activateTab(targetId);
    });
  });
}

function initNoticeBoard() {
  const section = document.querySelector('.news-section');
  if (!section) return;
  const API = window.API || ((p) => p);
  const lists = {
    all: section.querySelector('[data-news-list="all"]'),
    notice: section.querySelector('[data-news-list="notice"]'),
    company: section.querySelector('[data-news-list="company"]'),
  };

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
    title.href = `/pages/notice.html?id=${item.id}`;
    title.textContent = item.title;
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

  const render = (listEl, listItems) => {
    if (!listEl) return;
    listEl.innerHTML = '';
    listItems.forEach(item => listEl.appendChild(createItem(item)));
  };

  const load = async () => {
    try {
      const res = await fetch(API('/api/notices_list.php?limit=30'));
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      const maxItems = 6;
      render(lists.all, data.slice(0, maxItems));
      render(lists.notice, data.filter(i => i.category === 'notice').slice(0, maxItems));
      render(lists.company, data.filter(i => i.category === 'company').slice(0, maxItems));
    } catch {}
  };
  load();
}

function initMapBannerClose() {
  const btn = document.querySelector('.map-banner-close');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const banner = document.querySelector('.map-banner');
    if (banner) banner.style.display = 'none';
  });
}

function initLoginPageModal() {
  const path = (location.pathname || '').toLowerCase();
  if (!path.endsWith('/pages/login.html') && !path.endsWith('login.html')) return;
  window.addEventListener('DOMContentLoaded', () => {
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;
    if (!actions.querySelector('#openLogin')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn login-compact';
      btn.id = 'openLogin';
      btn.textContent = '로그인';
      btn.addEventListener('click', () => { if (typeof createLoginModal === 'function') createLoginModal(); });
      actions.appendChild(btn);
    }
    if (typeof createLoginModal === 'function') createLoginModal();
  });
}

function initQuoteRegisterPage() {
  const form = document.getElementById('quoteForm');
  const statusEl = document.getElementById('status');
  if (!form || !statusEl) return;

  const finCoating = document.getElementById('finCoating');
  const coatingRow = document.getElementById('coatingOptions');
  function updateCoatingVisibility(){
    const show = !!(finCoating && finCoating.checked);
    if (coatingRow){
      coatingRow.classList.toggle('is-hidden', !show);
      if (!show){
        coatingRow.querySelectorAll('input[name="coating[]"]').forEach(cb => { cb.checked = false; });
      }
    }
  }
  finCoating && finCoating.addEventListener('change', updateCoatingVisibility);
  updateCoatingVisibility();
  const baseCoatingValues = new Set(['무광CR', '유광CR', '무광라미', '유광라미', '오버코팅']);
  function enforceSingleBaseCoating(target){
    if (!target || !baseCoatingValues.has(target.value) || !target.checked) return;
    coatingRow?.querySelectorAll('input[name="coating[]"]').forEach(cb => {
      if (cb !== target && baseCoatingValues.has(cb.value)) cb.checked = false;
    });
  }
  let coatingWarned = false;
  function checkCoatingConflict(){
    if (!coatingRow || coatingRow.classList.contains('is-hidden')) {
      coatingWarned = false;
      return;
    }
    const glossySelected = Array.from(coatingRow.querySelectorAll('input[name="coating[]"]'))
      .some(cb => cb.checked && (cb.value === '유광CR' || cb.value === '유광라미'));
    const partialSelected = Array.from(coatingRow.querySelectorAll('input[name="coating[]"]'))
      .some(cb => cb.checked && cb.value === '부분유광코팅(실크)');
    if (glossySelected && partialSelected && !coatingWarned) {
      coatingWarned = true;
      alert('부분유광코팅은 무광코팅을 선택해야 부분유광코팅이 돋보입니다.');
    }
    if (!glossySelected || !partialSelected) {
      coatingWarned = false;
    }
  }
  coatingRow?.querySelectorAll('input[name="coating[]"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      enforceSingleBaseCoating(e.currentTarget);
      checkCoatingConflict();
    });
  });

  const finFoil = document.getElementById('finFoil');
  const foilRow = document.getElementById('foilOptions');
  function updateFoilVisibility(){
    const show = !!(finFoil && finFoil.checked);
    if (foilRow){
      foilRow.classList.toggle('is-hidden', !show);
      if (!show){
        const fw = document.getElementById('foil_w');
        const fh = document.getElementById('foil_h');
        if (fw) fw.value = '';
        if (fh) fh.value = '';
      }
    }
  }
  finFoil && finFoil.addEventListener('change', updateFoilVisibility);
  updateFoilVisibility();

  const finEmboss = document.getElementById('finEmboss');
  const embossRow = document.getElementById('embossOptions');
  function updateEmbossVisibility(){
    const show = !!(finEmboss && finEmboss.checked);
    if (embossRow){
      embossRow.classList.toggle('is-hidden', !show);
      if (!show){
        const ew = document.getElementById('emboss_w');
        const eh = document.getElementById('emboss_h');
        if (ew) ew.value = '';
        if (eh) eh.value = '';
      }
    }
  }
  finEmboss && finEmboss.addEventListener('change', updateEmbossVisibility);
  updateEmbossVisibility();

  const phone1 = document.getElementById('phone1');
  const phone2 = document.getElementById('phone2');
  const phone3 = document.getElementById('phone3');
  function onlyDigits(el){ if (!el) return; el.value = el.value.replace(/\D+/g, ''); }
  phone1?.addEventListener('input', () => {
    onlyDigits(phone1);
    if (phone1.value.length >= 3) phone2?.focus();
  });
  phone2?.addEventListener('input', () => {
    onlyDigits(phone2);
    if (phone2.value.length >= 4) phone3?.focus();
  });
  phone3?.addEventListener('input', () => { onlyDigits(phone3); });

  const emailDomainSelect = document.getElementById('emailDomainSelect');
  const emailDomainCustom = document.getElementById('emailDomainCustom');
  function updateEmailDomainUI(){
    const direct = emailDomainSelect?.value === 'direct';
    if (emailDomainCustom){
      emailDomainCustom.classList.toggle('is-hidden', !direct);
      if (!direct) emailDomainCustom.value = '';
    }
  }
  emailDomainSelect?.addEventListener('change', updateEmailDomainUI);
  updateEmailDomainUI();

  const previewImg = document.getElementById('boxTypePreview');
  const previewLabel = document.getElementById('boxTypePreviewLabel');
  function updateBoxPreview(){
    const selected = document.querySelector('input[name="box_type"]:checked');
    if (!selected || !previewImg || !previewLabel) return;
    const src = selected.getAttribute('data-preview') || '../assets/img/PD_3.jpg';
    const label = selected.value || '박스타입 미리보기';
    previewImg.src = src;
    previewImg.alt = label + ' 미리보기';
    previewLabel.textContent = label + ' 미리보기';
  }
  document.querySelectorAll('input[name="box_type"]').forEach(radio => {
    radio.addEventListener('change', updateBoxPreview);
  });
  updateBoxPreview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '등록 중…';
    const fd = new FormData(form);
    const emailId = (fd.get('email_id') || '').toString().trim();
    const domainSelect = (fd.get('email_domain_select') || '').toString().trim();
    const domainCustom = (fd.get('email_domain_custom') || '').toString().trim();
    const domain = domainSelect === 'direct' ? domainCustom : domainSelect;
    if (emailId && domain) {
      fd.set('email', `${emailId}@${domain}`);
    }
    fd.delete('email_id');
    fd.delete('email_domain_select');
    fd.delete('email_domain_custom');
    const p1 = (fd.get('phone1') || '').toString().trim();
    const p2 = (fd.get('phone2') || '').toString().trim();
    const p3 = (fd.get('phone3') || '').toString().trim();
    if (p1 || p2 || p3) {
      const joined = [p1, p2, p3].filter(Boolean).join('-');
      fd.set('phone', joined);
    }
    fd.delete('phone1');
    fd.delete('phone2');
    fd.delete('phone3');
    const finishings = fd.getAll('finishing[]'); fd.delete('finishing[]');
    const coatings = fd.getAll('coating[]'); fd.delete('coating[]');
    const data = Object.fromEntries(fd.entries());
    if (finishings.length) data.finishing = finishings;
    if (coatings.length) data.coating = coatings;
    const parts = [];
    if (coatings.length) parts.push('코팅:' + coatings.join(', '));
    const fw = data.foil_w||''; const fh = data.foil_h||'';
    if (finishings.includes('금박') && (fw || fh)) parts.push(`금박:${fw||0}x${fh||0}mm`);
    const ew = data.emboss_w||''; const eh = data.emboss_h||'';
    if (finishings.includes('형압') && (ew || eh)) parts.push(`형압:${ew||0}x${eh||0}mm`);
    if (parts.length) data.finishing_detail = parts.join(' | ');
    try {
      const res = await fetch(API('/api/submit_quote.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('서버 오류');
      const j = await res.json();
      if (j && j.ok) {
        statusEl.textContent = '등록되었습니다. 홈페이지에서 실시간으로 확인 가능합니다.';
        statusEl.className = 'note success';
        form.reset();
      } else {
        throw new Error(j?.error || '등록 실패');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        statusEl.textContent = '서버 응답이 없습니다. 네트워크 상태를 확인해 주세요.';
      } else {
        statusEl.textContent = '오류: ' + (err?.message || '등록에 실패했습니다');
      }
      statusEl.className = 'note error';
    }
  });
}

function initProductsPageTabs() {
  const path = (location.pathname || '').toLowerCase();
  if (!path.endsWith('/pages/products.html') && !path.endsWith('products.html')) return;
  const tabBars = document.querySelectorAll('.tab-bar[data-tab-group]');
  if (!tabBars.length) return;
  const resizeIframe = (frame) => {
    if (!frame) return;
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (!doc) return;
      const height = Math.max(
        doc.body?.scrollHeight || 0,
        doc.documentElement?.scrollHeight || 0
      );
      if (height) frame.style.height = `${height}px`;
    } catch {}
  };
  document.querySelectorAll('.product-iframe').forEach((frame) => {
    frame.addEventListener('load', () => resizeIframe(frame));
  });
  tabBars.forEach((bar) => {
    const group = bar.dataset.tabGroup;
    const tabs = bar.querySelectorAll('.tab-btn[data-tab-target]');
    const panels = document.querySelectorAll(`.tab-panel[data-tab-group="${group}"]`);
    const applyTab = (target, activeTab) => {
      tabs.forEach((btn) => {
        const isActive = btn === activeTab;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        const isAll = target === 'all';
        const isMatch = panel.dataset.tabPanel === target;
        panel.classList.toggle('is-active', isAll || isMatch);
      });
      if (group === 'type') {
        const activePanel = document.querySelector(`.tab-panel.is-active[data-tab-group="${group}"]`);
        const frame = activePanel?.querySelector('.product-iframe');
        if (frame) {
          setTimeout(() => resizeIframe(frame), 50);
        }
      }
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        applyTab(tab.dataset.tabTarget, tab);
      });
    });
    const defaultTab = bar.querySelector('.tab-btn.is-active') || tabs[0];
    if (defaultTab) {
      applyTab(defaultTab.dataset.tabTarget, defaultTab);
    }
  });
}

function initVendorProductsTabs() {
  const path = (location.pathname || '').toLowerCase();
  if (!path.endsWith('/pages/vendor-products.html') && !path.endsWith('vendor-products.html')) return;
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabs.length || !panels.length) return;
  const applyTab = (target, activeTab) => {
    tabs.forEach((btn) => {
      const isActive = btn === activeTab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.tabPanel === target);
    });
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      applyTab(tab.dataset.tabTarget, tab);
    });
  });
  let defaultTab = document.querySelector('.tab-btn.is-active') || tabs[0];
  try {
    const url = new URL(location.href);
    const brand = (url.searchParams.get('brand') || '').trim().toLowerCase();
    if (brand) {
      const byBrand = Array.from(tabs).find(t => (t.dataset.tabTarget || '').toLowerCase() === brand);
      if (byBrand) defaultTab = byBrand;
    }
  } catch {}
  if (defaultTab) {
    applyTab(defaultTab.dataset.tabTarget, defaultTab);
  }
}

function initAdminQuotesPage() {
  const wrap = document.getElementById('quotesAdminTableWrap');
  if (!wrap) return;
  const state = { all: [], filtered: [], page: 1, pageSize: 15, q: '', status: '' };
  const pager = document.getElementById('quotesPager');
  const qSearch = document.getElementById('qSearch');
  const qStatus = document.getElementById('qStatus');
  const qCount = document.getElementById('qCount');

  async function loadQuotes(){
    wrap.setAttribute('aria-busy','true');
    try {
      const res = await fetch(API('/api/quotes_list.php'), { credentials: 'include' });
      state.all = res.ok ? await res.json() : [];
      state.page = 1;
      applyFilters();
    } catch { wrap.innerHTML = '<div class="error">불러오기에 실패했습니다.</div>'; }
    wrap.setAttribute('aria-busy','false');
  }
  function applyFilters(){
    const q = (qSearch?.value||'').trim().toLowerCase();
    const status = qStatus?.value || '';
    state.q = q; state.status = status;
    state.filtered = (state.all||[]).filter(r => {
      const matchQ = !q || [r.company, r.position, r.name, r.email, r.product, r.message, r.finishing_detail]
        .some(v => (v||'').toLowerCase().includes(q));
      const matchS = !status || (r.status||'') === status;
      return matchQ && matchS;
    }).sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
    if (qCount) qCount.textContent = `${state.filtered.length}건`;
    renderTable();
    renderPager();
  }
  function renderTable(){
    const start = (state.page - 1) * state.pageSize;
    const rows = state.filtered.slice(start, start + state.pageSize);
    const htmlRows = (rows||[]).map(q => `
      <tr data-id="${q.id}">
        <td>${q.timestamp ? new Date(q.timestamp*1000).toLocaleString() : ''}</td>
        <td>${q.company||''}</td>
        <td>${q.position||''}</td>
        <td>${q.name||''}</td>
        <td>${q.phone||''}</td>
        <td>
          <div class="status-toggle" data-id="${q.id}">
            <button type="button" class="status-btn status-pending ${((q.status||'')==='문의중')?'is-active':''}" data-status="문의중">문의중</button>
            <button type="button" class="status-btn status-done ${((q.status||'')==='답변완료')?'is-active':''}" data-status="답변완료">답변완료</button>
          </div>
        </td>
      </tr>
    `).join('');
    const table = `
      <table class="quotes-admin-table" aria-label="견적 접수 목록">
        <thead>
          <tr>
            <th>등록일</th>
            <th>회사명</th>
            <th>직급</th>
            <th>성명</th>
            <th>연락처</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    `;
    wrap.innerHTML = table;
    wrap.querySelectorAll('.status-toggle')?.forEach(group => {
      group.querySelectorAll('.status-btn')?.forEach(btn => btn.addEventListener('click', async (e) => {
        const g = e.currentTarget.closest('.status-toggle');
        if (!g) return;
        const id = parseInt(g.getAttribute('data-id'), 10);
        const status = e.currentTarget.getAttribute('data-status') || '';
        const current = state.all.find(x=>x.id===id)?.status || '문의중';
        if (!status || status === current) return;
        g.classList.add('is-busy');
        try {
          const res = await fetch(API('/api/quotes_status.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, status }) });
          const j = await res.json(); if (!j.ok) throw new Error('failed');
          const idx = state.all.findIndex(x=>x.id===id);
          if (idx>=0) state.all[idx].status = status;
          applyFilters();
        } catch {
          applyFilters();
        }
      }));
    });
    wrap.querySelectorAll('tbody tr')?.forEach(tr => tr.addEventListener('click', (e) => {
      const interactive = e.target.closest('select, button, a, input, textarea, label');
      if (interactive) return;
      const idAttr = tr.getAttribute('data-id');
      const id = idAttr ? parseInt(idAttr,10) : 0;
      const item = state.all.find(x=>x.id===id);
      if (item) openDetail(item);
    }));
  }
  function renderPager(){
    if (!pager) return;
    const total = state.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    const makeBtn = (label, p, active=false) => `<button class="page-btn${active?' active':''}" data-page="${p}">${label}</button>`;
    let html = '';
    html += makeBtn('이전', Math.max(1, state.page-1));
    for (let i=1;i<=totalPages;i++) { html += makeBtn(String(i), i, i===state.page); }
    html += makeBtn('다음', Math.min(totalPages, state.page+1));
    pager.innerHTML = html;
    pager.querySelectorAll('.page-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const p = parseInt(e.currentTarget.getAttribute('data-page'), 10);
      if (!isNaN(p)) { state.page = p; renderTable(); renderPager(); }
    }));
  }
  function exportCSV(){
    const cols = ['회사명','직급','성명','이메일','연락처','제품명','수량','장(mm)','폭(mm)','고(mm)','후가공','후가공 상세','요청사항','상태','등록일'];
    const lines = [cols.join(',')];
    state.filtered.forEach(q => {
      const vals = [q.company,q.position,q.name,q.email,q.phone,q.product,q.qty,q.length,q.width,q.height,(Array.isArray(q.finishing)?q.finishing.join(' / '):q.finishing||''),q.finishing_detail,q.message,q.status,(q.timestamp?new Date(q.timestamp*1000).toLocaleString():'')];
      const esc = (s) => {
        const t = (s==null? '': String(s));
        return '"' + t.replace(/"/g,'""') + '"';
      };
      lines.push(vals.map(esc).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `quotes_${Date.now()}.csv`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }
  function openDetail(item){
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="quoteDetailTitle">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title" id="quoteDetailTitle">견적 상세</div>
          <button class="modal-close" type="button" aria-label="닫기" data-modal-close>×</button>
        </div>
        <div class="modal-body">
          <div class="detail-meta">등록일: ${item.timestamp?new Date(item.timestamp*1000).toLocaleString():''} · 상태: ${item.status||''}</div>
          <label>회사명</label><input value="${item.company||''}" disabled>
          <label>직급</label><input value="${item.position||''}" disabled>
          <label>성명</label><input value="${item.name||''}" disabled>
          <label>이메일</label><input value="${item.email||''}" disabled>
          <label>연락처</label><input value="${item.phone||''}" disabled>
          <label>제품명</label><input value="${item.product||''}" disabled>
          <label>수량</label><input value="${item.qty||''}" disabled>
          <div class="detail-grid">
            <div><label>장(mm)</label><input value="${item.length||''}" disabled></div>
            <div><label>폭(mm)</label><input value="${item.width||''}" disabled></div>
            <div><label>고(mm)</label><input value="${item.height||''}" disabled></div>
          </div>
          <label>후가공</label><input value="${Array.isArray(item.finishing)? item.finishing.join(', ') : (item.finishing||'')}" disabled>
          <label>후가공 상세</label><input value="${item.finishing_detail||''}" disabled>
          <label>요청사항</label><textarea disabled>${item.message||''}</textarea>
          <div class="modal-actions">
            <div class="status-toggle detail-status" data-status="${item.status||'문의중'}">
              <button type="button" class="status-btn status-pending ${(item.status==='문의중' || !item.status)?'is-active':''}" data-status="문의중">문의중</button>
              <button type="button" class="status-btn status-done ${(item.status==='답변완료')?'is-active':''}" data-status="답변완료">답변완료</button>
            </div>
            <button class="btn btn-accent ml-8" id="detailApply">적용</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const closeAll = () => { wrap.remove(); };
    wrap.querySelectorAll('[data-modal-close]')?.forEach(el => el.addEventListener('click', closeAll));
    const detailToggle = wrap.querySelector('.detail-status');
    let selectedStatus = item.status || '문의중';
    detailToggle?.querySelectorAll('.status-btn')?.forEach(btn => btn.addEventListener('click', (e) => {
      const next = e.currentTarget.getAttribute('data-status') || '문의중';
      selectedStatus = next;
      detailToggle.querySelectorAll('.status-btn').forEach(b => {
        b.classList.toggle('is-active', b.getAttribute('data-status') === selectedStatus);
      });
    }));
    wrap.querySelector('#detailApply')?.addEventListener('click', async ()=>{
      const status = selectedStatus || item.status || '문의중';
      try {
        const res = await fetch(API('/api/quotes_status.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id:item.id, status }) });
        const j = await res.json(); if (!j.ok) throw new Error('failed');
        const idx = state.all.findIndex(x=>x.id===item.id);
        if (idx>=0) state.all[idx].status = status;
        applyFilters(); closeAll();
      } catch {}
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { once: true });
  }

  qSearch?.addEventListener('input', () => { state.page = 1; applyFilters(); });
  qStatus?.addEventListener('change', () => { state.page = 1; applyFilters(); });
  document.getElementById('qRefresh')?.addEventListener('click', () => loadQuotes());
  document.getElementById('qExport')?.addEventListener('click', () => exportCSV());
  loadQuotes();
}

initSimpleTabs();
initNoticeBoard();
initMapBannerClose();
initLoginPageModal();
initQuoteRegisterPage();
initAdminQuotesPage();
initProductsPageTabs();
initVendorProductsTabs();

// Auth area (login/logout and rank badge)
function closeAuthModals() {
  try { document.getElementById('loginModal')?.remove(); } catch {}
  try { document.getElementById('registerModal')?.remove(); } catch {}
}

function createLoginModal() {
  if (document.getElementById('loginModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'loginModal';
  wrap.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <div class="modal-card login-card">
        <div class="login-hero" aria-hidden="true">
          <div class="login-badge">SEPNP 멤버</div>
          <h2 class="login-hero-title">성은지기인쇄에 오신걸 환영합니다.</h2>
          <p class="login-hero-sub">브랜드를 살리는 패키지, 고객을 끌어당기는 박스를 만듭니다.</p>
          <ul class="login-points">
            <li>맞춤형 패키지 컨설팅 제공</li>
            <li>퀄리티·납기·단가를 함께 설계</li>
            <li>브랜드 경험을 높이는 박스 디자인</li>
          </ul>
        </div>
        <div class="login-panel">
          <div class="login-panel-header">
            <div>
              <div class="login-title" id="loginTitle">로그인</div>
              <div class="login-subtitle">아이디와 비밀번호를 입력해 주세요.</div>
            </div>
            <button class="modal-close" type="button" aria-label="닫기" data-modal-close>×</button>
          </div>
          <div class="login-form">
            <label class="login-label" for="modalLoginId">아이디</label>
            <div class="login-input">
              <input id="modalLoginId" placeholder="아이디" autocomplete="username" />
            </div>
            <label class="login-label" for="modalLoginPw">비밀번호</label>
            <div class="login-input">
              <input id="modalLoginPw" type="password" placeholder="비밀번호" autocomplete="current-password" />
            </div>
            <div class="login-options">
              <label class="login-check">
                <input type="checkbox" id="rememberLogin" />
                <span>아이디 저장</span>
              </label>
              <button type="button" class="link-btn" id="openRegister">회원가입</button>
            </div>
            <div class="login-actions">
              <button type="button" class="btn" data-modal-close>취소</button>
              <button type="button" class="btn btn-accent" id="modalLoginSubmit">로그인</button>
            </div>
            <div class="login-help">승인 대기 중이면 관리자 승인 후 로그인 가능합니다.</div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const closeAll = () => { wrap.remove(); };
  wrap.querySelectorAll('[data-modal-close]')?.forEach(el => el.addEventListener('click', closeAll));
  const idInput = document.getElementById('modalLoginId');
  const pwInput = document.getElementById('modalLoginPw');
  const rememberEl = document.getElementById('rememberLogin');
  try {
    const saved = localStorage.getItem('sepn_login_id');
    if (saved && idInput && rememberEl) {
      idInput.value = saved;
      rememberEl.checked = true;
      pwInput?.focus();
    } else {
      idInput?.focus();
    }
  } catch {}
  const submit = wrap.querySelector('#modalLoginSubmit');
  const handleSubmit = async () => {
    const username = (idInput?.value || '').trim();
    const password = (pwInput?.value || '').trim();
    if (!username || !password) return;
    try {
      if (rememberEl?.checked) localStorage.setItem('sepn_login_id', username);
      else localStorage.removeItem('sepn_login_id');
    } catch {}
    try {
      const res = await fetchWithTimeout(API('/api/auth_login.php'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error === 'pending_approval' ? '승인 대기 중입니다.' : '로그인 실패');
        return;
      }
      const u = data.user || {};
      if ((u.username||'').toLowerCase() === 'sepnp') {
        u.role = 'admin';
        u.rank = 'Master';
        u.nickname = u.nickname || '관리자';
        u.status = '승인완료';
      }
      localStorage.setItem('sepn_user', JSON.stringify(u));
      closeAuthModals();
      // 직원 계정이면 포털로 이동
      if (['employee','staff'].includes((u.role || '').toLowerCase())) {
        window.location.href = getPortalUrl();
        return;
      }
      renderAuth();
      renderNav();
    } catch {
      alert('서버 응답이 없습니다. 잠시 후 다시 시도하세요.');
      return;
    }
  };
  submit?.addEventListener('click', handleSubmit);
  [idInput, pwInput]?.forEach(el => {
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });
  });
  const regBtn = wrap.querySelector('#openRegister');
  regBtn?.addEventListener('click', () => { closeAll(); createRegisterModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { once: true });
}

function renderAuth() {
  function dedupeAuthUI() {
    try {
      const header = document.querySelector('.site-header');
      if (!header) return;
      // 헤더 내부 nav-actions 중복 제거
      const bottom = header.querySelector('.header-bottom');
      if (bottom) {
        const list = bottom.querySelectorAll('.nav-actions');
        list.forEach((el, idx) => { if (idx > 0) el.remove(); });
      }
      header.querySelectorAll('.header-top .nav-actions').forEach(el => el.remove());
      // 로그인 버튼 중복 제거
      const actions = header.querySelector('.header-bottom .nav-actions');
      if (actions) {
        const loginBtns = actions.querySelectorAll('#openLogin');
        loginBtns.forEach((btn, idx) => { if (idx > 0) btn.remove(); });
      }
    } catch {}
  }
  // 마운트 지점부터 보장한 뒤 선택(상단 우선)
  function ensureAuthMount() {
    try {
      const headerTop = document.querySelector('.site-header .header-top');
      const headerBottom = document.querySelector('.site-header .header-bottom');
      if (!headerTop && !headerBottom) return;
      // 상단 액션 영역은 사용하지 않음(중복 버튼 방지)
      headerTop?.querySelectorAll('.nav-actions')?.forEach(el => el.remove());
      if (headerBottom) {
        const bottomList = headerBottom.querySelectorAll('.nav-actions');
        if (bottomList.length === 0) {
          const bottom = document.createElement('div');
          bottom.className = 'nav-actions';
          bottom.setAttribute('aria-label', '계정 영역');
          headerBottom.appendChild(bottom);
        } else if (bottomList.length > 1) {
          bottomList.forEach((el, idx) => { if (idx > 0) el.remove(); });
        }
      }
    } catch {}
  }
  ensureAuthMount();

  // 하단 네비 우측만 사용
  const actions = document.querySelector('.site-header .header-bottom .nav-actions');
  if (!actions) return;
  const raw = localStorage.getItem('sepn_user');
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch {}
  if (user && user.nickname) {
    let rank = (user.rank || '').toLowerCase();
    let rankClass = ['bronze','silver','gold','platinum','vip','master','normal'].includes(rank) ? `rank-${rank}` : 'rank-normal';
    let rankLabel = rank === 'normal' ? '노말등급' : (user.rank || 'SILVER').toUpperCase();
    // 관리자 표시 강제: 언제나 MASTER 등급 배지로 표기
    if ((user.role || '').toLowerCase() === 'admin') {
      rank = 'master';
      rankClass = 'rank-master';
      rankLabel = 'MASTER';
    }
    actions.innerHTML = `
      <span class="user-info">
        <span class="rank-badge ${rankClass}">${rankLabel}</span>
        <span class="nickname">${user.nickname}</span>
      </span>
      ${['employee','staff'].includes((user.role || '').toLowerCase())
        ? '<a class="btn login-compact" id="portalLink" href="#">SE포털</a>'
        : ''}
      <button type="button" class="btn login-compact logout-btn">로그아웃</button>
    `;
    const portalLink = actions.querySelector('#portalLink');
    portalLink?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = getPortalUrl();
    });
    const logout = actions.querySelector('.logout-btn');
    logout?.addEventListener('click', () => {
      // 서버 세션도 종료
      try { fetch(API('/api/auth_logout.php'), { method: 'POST', credentials: 'include' }).catch(()=>{}); } catch {}
      localStorage.removeItem('sepn_user');
      renderAuth();
      renderNav();
      const redirectHomeIfOnLogin = () => {
        const p = (location.pathname || '').toLowerCase();
        if (p.endsWith('/pages/login.html') || p.endsWith('login.html')) {
          // 홈으로 이동 (index.html)
          window.location.href = '/';
        }
      };
    });
  } else {
    actions.innerHTML = `<button type="button" class="btn login-compact" id="openLogin">로그인</button>`;
    const btn = actions.querySelector('#openLogin');
    btn?.addEventListener('click', () => { createLoginModal(); });
  }
  dedupeAuthUI();
}

// 임베드(iframe)에서는 헤더/푸터 숨김용 클래스
try {
  if (window.self !== window.top) {
    document.body.classList.add('embedded');
  }
} catch {}

// 로그인 영역 렌더링(에러 폴백 포함)
try {
  renderAuth();
} catch (e) {
  const actions = document.querySelector('.site-header .header-bottom .nav-actions');
  if (actions) {
    actions.innerHTML = `<button type="button" class="btn login-compact" id="openLogin">로그인</button>`;
    const btn = actions.querySelector('#openLogin');
    btn?.addEventListener('click', () => { try { createLoginModal(); } catch {} });
  }
}

// Dynamic navigation: admin vs normal
function renderNav() {
  const siteNavList = document.querySelector('.site-nav ul');
  if (!siteNavList) return;
  const raw = localStorage.getItem('sepn_user');
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch {}
  // 모든 페이지에서 동일한 네비게이션(Company/Products/견적문의/문의 게시판)으로 통일
  const prefix = '';
  const roleLower = (user?.role || '').toLowerCase();
  const isAdmin = !!(user && roleLower==='admin');
  const isEmployee = isAdmin || ['employee','staff'].includes(roleLower);
  siteNavList.innerHTML = [
    isEmployee ? `<li><a href="${getPortalUrl()}" data-menu="portal">SE포털</a></li>` : '',
    `<li><a href="#" data-menu="company">회사소개</a></li>`,
    `<li><a href="${prefix}/pages/facility.html">시설 및 공정</a></li>`,
    `<li><a href="#" data-menu="products">제품소개</a></li>`,
    `<li><a href="${prefix}/pages/notices.html">공지사항</a></li>`,
    `<li><a href="${prefix}/pages/quote.html">견적문의</a></li>`,
    isAdmin ? `<li><a href="${prefix}/pages/admin/index.html" data-menu="admin">관리</a></li>` : ''
  ].filter(Boolean).join('');
  // When using mobile nav, close menu on link click
  document.querySelectorAll('.site-nav a').forEach(a => {
    a.addEventListener('click', () => { try { closeNav(); } catch {} });
  });

  // 드롭다운 메뉴 DOM 보장 후 토글 초기화
  ensureDropdownMenus(prefix, isAdmin);
  initCompanyMega();
  initProductsMega();
  if (isAdmin) initAdminMega();
  try { renderAuth(); } catch {}
}

renderNav();

// Require login for selected pages
try {
  const user = getLocalUser();
  const path = (location.pathname || '').toLowerCase();
  const guarded = [
    '/pages/quote.html',
    '/pages/quote-register.html',
    '/pages/quote-history.html',
    '/pages/contact.html',
  ];
  const needsLogin = guarded.some(p => path.endsWith(p));
  if (!user && needsLogin) {
    alert('로그인이 필요합니다. 상단 로그인 버튼을 사용하세요.');
    try { if (typeof createLoginModal === 'function') createLoginModal(); } catch {}
    const loginPath = '/pages/login.html';
    const ret = encodeURIComponent(location.pathname + location.search);
    location.replace(`${loginPath}?return=${ret}`);
  }
} catch {}

// Intercept quote links when not logged in
try {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (!/quote\.html|quote-register\.html|quote-history\.html/.test(href)) return;
    if (getLocalUser()) return;
    e.preventDefault();
    alert('로그인이 필요합니다. 상단 로그인 버튼을 사용하세요.');
    try { if (typeof createLoginModal === 'function') createLoginModal(); } catch {}
  });
} catch {}

function initMegaMenu({ linkSelector, panelId, openOnClick = false, openOnHover = false }) {
  const link = document.querySelector(linkSelector);
  const panel = document.getElementById(panelId);
  if (!link || !panel) return;
  const position = () => {
    const rect = link.getBoundingClientRect();
    const isFixed = getComputedStyle(panel).position === 'fixed';
    const top = (isFixed ? rect.bottom + 6 : rect.bottom + window.scrollY + 6);
    const left = (isFixed ? rect.left : rect.left + window.scrollX);
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  };
  const open = () => { position(); panel.hidden = false; };
  const close = () => { panel.hidden = true; };
  const toggle = () => { panel.hidden ? open() : close(); };

  if (openOnClick) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      toggle();
    });
  }
  if (openOnHover) {
    link.addEventListener('mouseenter', () => { open(); });
    link.addEventListener('focus', () => { open(); });
  }

  document.addEventListener('click', (e) => {
    if (panel.hidden) return;
    const inside = e.target.closest(`#${panelId}`) || e.target.closest(linkSelector);
    if (!inside) close();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (!panel.hidden) position(); });
  window.addEventListener('scroll', () => { if (!panel.hidden) position(); }, { passive: true });
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
}

// COMPANY 메가 메뉴 동작
function initCompanyMega(){
  initMegaMenu({ linkSelector: '.site-nav a[data-menu="company"]', panelId: 'companyMega', openOnClick: true });
}

function initProductsMega(){
  initMegaMenu({ linkSelector: '.site-nav a[data-menu="products"]', panelId: 'productsMega', openOnClick: true });
}

// ADMIN 메가 메뉴 동작
function initAdminMega(){
  // 클릭은 본래 링크(견적접수)로 이동, 호버/포커스 시 팝오버 노출
  initMegaMenu({ linkSelector: '.site-nav a[data-menu="admin"]', panelId: 'adminMega', openOnHover: true });
}

// 페이지마다 존재하지 않을 수 있는 드롭다운 메뉴를 동적으로 생성
function ensureDropdownMenus(prefixHint, isAdmin){
  const prefix = typeof prefixHint === 'string' ? prefixHint : '';
  const container = document.querySelector('.site-header .header-bottom') || document.body;

  if (!document.getElementById('companyMega')){
    const wrap = document.createElement('div');
    wrap.id = 'companyMega';
    wrap.className = 'menu-popover';
    wrap.hidden = true;
    wrap.innerHTML = `
      <ul class="menu-list" aria-label="Company 섹션">
        <li><a href="${prefix}/pages/company/ceo.html">CEO인사말</a></li>
        <li><a href="${prefix}/pages/company/history.html">연혁</a></li>
        <li><a href="${prefix}/pages/company/awards.html">수상내역</a></li>
        <li><a href="${prefix}/pages/company/organization.html">조직도</a></li>
        <li><a href="${prefix}/pages/company/location.html">오시는길</a></li>
      </ul>`;
    container.appendChild(wrap);
  }
  if (!document.getElementById('productsMega')){
    const wrap2 = document.createElement('div');
    wrap2.id = 'productsMega';
    wrap2.className = 'menu-popover';
    wrap2.hidden = true;
    wrap2.innerHTML = `
      <ul class="menu-list" aria-label="Products 카테고리">
        <li><a href="${prefix}/pages/vendor-products.html">업체별 제품</a></li>
        <li class="is-hidden"><a href="${prefix}/pages/products.html#type-view">타입별 제품</a></li>
      </ul>`;
    container.appendChild(wrap2);
  }
  // ADMIN 메뉴 (관리자일 때만 보장)
  if (isAdmin && !document.getElementById('adminMega')){
    const wrap3 = document.createElement('div');
    wrap3.id = 'adminMega';
    wrap3.className = 'menu-popover';
    wrap3.hidden = true;
    wrap3.innerHTML = `
      <ul class="menu-list" aria-label="Admin 관리">
        <li><a href="${prefix}/pages/admin/approvals.html">승인 관리</a></li>
        <li><a href="${prefix}/pages/admin/customers.html">고객 관리</a></li>
        <li><a href="${prefix}/pages/admin/quotes.html">견적 관리</a></li>
        <li><a href="${prefix}/pages/admin/notices.html">공지 관리</a></li>
      </ul>`;
    container.appendChild(wrap3);
  }
}

// Register modal
function createRegisterModal() {
  if (document.getElementById('registerModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'registerModal';
  wrap.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="registerTitle">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title" id="registerTitle">회원가입</div>
          <button class="modal-close" type="button" aria-label="닫기" data-modal-close>×</button>
        </div>
        <div class="modal-body">
          <label for="regId">아이디</label>
          <div class="input-check-row">
            <input id="regId" placeholder="아이디" />
            <button type="button" class="btn btn-ghost" id="regIdCheck">중복확인</button>
          </div>
          <div class="input-hint" id="regIdHint" aria-live="polite"></div>
          <label for="regPw">비밀번호</label>
          <input id="regPw" type="password" placeholder="비밀번호" />
          <label for="regPw2">비밀번호 확인</label>
          <input id="regPw2" type="password" placeholder="비밀번호 확인" />
          <label for="regNick">닉네임</label>
          <div class="input-check-row">
            <input id="regNick" placeholder="닉네임(선택)" />
            <button type="button" class="btn btn-ghost" id="regNickCheck">중복확인</button>
          </div>
          <div class="input-hint" id="regNickHint" aria-live="polite"></div>
          <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>취소</button>
            <button type="button" class="btn btn-accent" id="regSubmit">가입</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const closeAll = () => { wrap.remove(); };
  wrap.querySelectorAll('[data-modal-close]')?.forEach(el => el.addEventListener('click', closeAll));
  const submit = wrap.querySelector('#regSubmit');
  const idInput = wrap.querySelector('#regId');
  const nickInput = wrap.querySelector('#regNick');
  const idCheckBtn = wrap.querySelector('#regIdCheck');
  const nickCheckBtn = wrap.querySelector('#regNickCheck');
  const idHint = wrap.querySelector('#regIdHint');
  const nickHint = wrap.querySelector('#regNickHint');

  const setHint = (el, msg, type) => {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'error', 'pending');
    if (type) el.classList.add(type);
  };

  const checkAvailability = async ({ username, nickname }) => {
    try {
      const params = new URLSearchParams();
      if (username) params.set('username', username);
      if (nickname) params.set('nickname', nickname);
      const url = API(`/api/auth_check.php?${params.toString()}`);
      const res = await fetchWithTimeout(url, { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  idCheckBtn?.addEventListener('click', async () => {
    const val = (idInput?.value || '').trim();
    if (!val) { setHint(idHint, '아이디를 입력하세요.', 'error'); return; }
    setHint(idHint, '확인 중...', 'pending');
    const data = await checkAvailability({ username: val });
    if (!data?.ok || typeof data.usernameAvailable !== 'boolean') {
      setHint(idHint, '확인 실패', 'error');
      return;
    }
    setHint(idHint, data.usernameAvailable ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.', data.usernameAvailable ? 'ok' : 'error');
  });

  nickCheckBtn?.addEventListener('click', async () => {
    const val = (nickInput?.value || '').trim();
    if (!val) { setHint(nickHint, '닉네임을 입력하세요.', 'error'); return; }
    setHint(nickHint, '확인 중...', 'pending');
    const data = await checkAvailability({ nickname: val });
    if (!data?.ok || typeof data.nicknameAvailable !== 'boolean') {
      setHint(nickHint, '확인 실패', 'error');
      return;
    }
    setHint(nickHint, data.nicknameAvailable ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.', data.nicknameAvailable ? 'ok' : 'error');
  });

  submit?.addEventListener('click', async () => {
    const username = (document.getElementById('regId')?.value || '').trim();
    const password = (document.getElementById('regPw')?.value || '').trim();
    const passwordConfirm = (document.getElementById('regPw2')?.value || '').trim();
    const nickname = (document.getElementById('regNick')?.value || '').trim();
    if (!username || !password || !passwordConfirm) return;
    if (password !== passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    const check = await checkAvailability({ username, nickname: nickname || undefined });
    if (!check?.ok) { alert('중복 확인에 실패했습니다.'); return; }
    if (check.usernameAvailable === false) {
      setHint(idHint, '이미 사용 중인 아이디입니다.', 'error');
      alert('이미 사용 중인 아이디입니다.');
      return;
    }
    if (nickname && check.nicknameAvailable === false) {
      setHint(nickHint, '이미 사용 중인 닉네임입니다.', 'error');
      alert('이미 사용 중인 닉네임입니다.');
      return;
    }
    try {
      const res = await fetchWithTimeout(API('/api/auth_register.php'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, password_confirm: passwordConfirm, nickname })
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === 'username_taken') {
          setHint(idHint, '이미 사용 중인 아이디입니다.', 'error');
          alert('이미 사용 중인 아이디입니다.');
        } else if (data.error === 'nickname_taken') {
          setHint(nickHint, '이미 사용 중인 닉네임입니다.', 'error');
          alert('이미 사용 중인 닉네임입니다.');
        } else {
          alert('가입 실패(아이디/닉네임 중복 등)');
        }
        return;
      }
      alert('가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.');
      closeAuthModals();
      renderAuth();
      renderNav();
      // 회원가입 직후 login 페이지라면 홈으로 이동
      try {
        const p = (location.pathname || '').toLowerCase();
        if (p.endsWith('/pages/login.html') || p.endsWith('login.html')) {
          window.location.href = '/';
        }
      } catch {}
    } catch { alert('네트워크 오류'); }
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { once: true });
}

// Admin pages wiring
async function initAdminApprovalsPage() {
  const table = document.getElementById('pendingTable');
  if (!table) return;
  // 일괄 승인 버튼을 페이지에 추가 (중복 방지)
  if (!document.getElementById('approveAllBtn')) {
    const btnWrap = document.createElement('div');
    btnWrap.style.margin = '8px 0';
    const btn = document.createElement('button');
    btn.id = 'approveAllBtn';
    btn.className = 'btn btn-accent';
    btn.textContent = '전체 승인';
    btn.addEventListener('click', async () => {
      try {
        await fetch(API('/api/admin_approve_all.php'), { method: 'POST', credentials: 'include' });
        initAdminApprovalsPage();
      } catch {}
    });
    table.parentElement?.insertBefore(btnWrap, table);
    btnWrap.appendChild(btn);
  }
  const tbody = table.querySelector('tbody');
  let rows = [];
  try {
    const res = await fetch(API('/api/admin_users_pending.php'), { credentials: 'include' });
    rows = await res.json();
  } catch {}
  const dataRows = (rows || []).map(u => `
    <tr>
      <td>${u.username}</td>
      <td>${u.nickname || '-'}</td>
      <td>${new Date((u.created_at||0)*1000).toLocaleString()}</td>
      <td class="actions">
        <button class="btn btn-accent" data-approve="${u.id}">승인</button>
        <button class="btn" data-deny="${u.id}">거절</button>
      </td>
    </tr>`).join('');
  const placeholdersA = Array.from({length: Math.max(0, 15 - ((rows||[]).length))})
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
    .join('');
  tbody.innerHTML = dataRows + placeholdersA;
  tbody.querySelectorAll('[data-approve]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-approve'), 10);
    await fetch(API('/api/admin_approve_user.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, action:'approve' }) });
    initAdminApprovalsPage();
  }));
  tbody.querySelectorAll('[data-deny]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-deny'), 10);
    await fetch(API('/api/admin_approve_user.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, action:'deny' }) });
    initAdminApprovalsPage();
  }));
}

async function initAdminRanksPage() {
  const table = document.getElementById('ranksTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  let rows = [];
  try {
    const res = await fetch(API('/api/admin_users_all.php'), { credentials: 'include' });
    rows = await res.json();
  } catch {}
  const ranks = ['Normal','Bronze','Silver','Gold','Platinum','VIP','Manager'];
  const dataRows = (rows || []).map(u => {
    const opts = ranks.map(r => `<option ${u.rank===r?'selected':''}>${r}</option>`).join('');
    return `
      <tr>
        <td>${u.username}</td>
        <td>${u.nickname || '-'}</td>
        <td>${u.rank || '-'}</td>
        <td>
          <select data-sel="${u.id}">${opts}</select>
          <button class="btn btn-accent" data-apply="${u.id}" style="margin-left:8px;">적용</button>
        </td>
      </tr>`;
  }).join('');
  const placeholdersR = Array.from({length: Math.max(0, 15 - ((rows||[]).length))})
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
    .join('');
  tbody.innerHTML = dataRows + placeholdersR;
  tbody.querySelectorAll('[data-apply]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-apply'), 10);
    const sel = tbody.querySelector(`[data-sel="${id}"]`);
    const rank = sel?.value || 'Silver';
    await fetch(API('/api/admin_update_rank.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, rank }) });
    initAdminRanksPage();
  }));
}

// Admin users page wiring
async function initAdminUsersPage() {
  const table = document.getElementById('usersTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const searchEl = document.getElementById('userSearch');
  const tabWrap = null;
  const tabButtons = [];
  const pagerEl = document.getElementById('userPager');
  const pageSize = 15;
  window.__adminUsersPageState = window.__adminUsersPageState || { page: 1, lastQuery: '' };
  let rows = [];
  let loadError = '';
  try {
    const res = await fetch(API('/api/admin_users_all.php'), { credentials: 'include' });
    if (!res.ok) {
      loadError = res.status === 403 ? '관리자 로그인 상태가 필요합니다.' : '데이터를 불러올 수 없습니다.';
    } else {
      rows = await res.json();
    }
  } catch {
    loadError = 'DB 연결 또는 네트워크 오류입니다.';
  }
  if (loadError) {
    tbody.innerHTML = `<tr><td colspan="7" class="quotes-empty-inline">${loadError}</td></tr>`;
    if (pagerEl) pagerEl.innerHTML = '';
    return;
  }
  const q = (searchEl?.value || '').trim().toLowerCase();
  const pageState = window.__adminUsersPageState;
  if (pageState.lastQuery !== q) {
    pageState.page = 1;
    pageState.lastQuery = q;
  }
  const filtered = (rows || []).filter(u => {
    if (!q) return true;
    const username = (u.username || '').toString().toLowerCase();
    const nickname = (u.nickname || '').toString().toLowerCase();
    return username.includes(q) || nickname.includes(q);
  });
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = '1';
    searchEl.addEventListener('input', () => initAdminUsersPage());
  }
  const fmtDate = (ts) => {
    if (!ts) return '-';
    const raw = Number(ts);
    const ms = raw < 1000000000000 ? raw * 1000 : raw;
    return new Date(ms).toLocaleString();
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const ranks = ['Normal','Bronze','Silver','Gold','Platinum','VIP','Manager'];
  const applyPagination = !!q;
  const total = filtered.length;
  const totalPages = applyPagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(pageState.page, totalPages);
  pageState.page = currentPage;
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = applyPagination ? filtered.slice(pageStart, pageStart + pageSize) : filtered;

  const dataRows = (pageItems || []).map(u => {
    const rankOptions = ranks.map(r => `<option ${u.rank===r?'selected':''}>${r}</option>`).join('');
    return `
    <tr>
      <td>${esc(u.username)}</td>
      <td><input class="admin-nick" data-nick-id="${u.id}" value="${esc(u.nickname || '')}" placeholder="닉네임"></td>
      <td><select class="admin-rank" data-rank-id="${u.id}">${rankOptions}</select></td>
      <td>${esc(u.role || '-')}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${esc(u.status || '-')}</td>
      <td class="actions">
        <button class="btn" data-status="정상" data-id="${u.id}">정상</button>
        <button class="btn" data-status="일시정지" data-id="${u.id}">일시정지</button>
        <button class="btn btn-accent" data-status="정지" data-id="${u.id}">정지</button>
        <button class="btn" data-save-rank="${u.id}">등급저장</button>
        <button class="btn" data-save-nick="${u.id}">닉네임저장</button>
        <button class="btn" data-reset="${u.id}">초기화</button>
        <button class="btn" data-setpw="${u.id}">비번변경</button>
      </td>
    </tr>`;
  }).join('');
  if (!dataRows) {
    tbody.innerHTML = `<tr><td colspan="7" class="quotes-empty-inline">검색 결과가 없습니다.</td></tr>`;
  } else {
    const placeholders = Array.from({length: Math.max(0, pageSize - ((pageItems||[]).length))})
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');
    tbody.innerHTML = dataRows + placeholders;
  }

  function renderPager(){
    if (!pagerEl) return;
    if (!applyPagination) { pagerEl.innerHTML = ''; return; }
    pagerEl.innerHTML = `
      <button type="button" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
      <div class="page-info">${currentPage} / ${totalPages} (총 ${total})</div>
      <button type="button" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음</button>
    `;
    pagerEl.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-page');
        if (dir === 'prev' && pageState.page > 1) pageState.page -= 1;
        if (dir === 'next' && pageState.page < totalPages) pageState.page += 1;
        initAdminUsersPage();
      });
    });
  }
  renderPager();

  function flashRow(el){
    if (!el) return;
    el.classList.add('row-saved');
    setTimeout(() => el.classList.remove('row-saved'), 800);
  }
  tbody.querySelectorAll('[data-status]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
    const status = e.currentTarget.getAttribute('data-status');
    try {
      const res = await fetch(API('/api/admin_update_status.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, status }) });
      const j = await res.json();
      if (!j.ok) { alert(j.error ? `오류: ${j.error}` : '상태 변경 실패'); }
      initAdminUsersPage();
    } catch { alert('네트워크 오류'); }
  }));

  tbody.querySelectorAll('[data-save-nick]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-save-nick'), 10);
    const input = tbody.querySelector(`[data-nick-id="${id}"]`);
    const nickname = (input?.value || '').trim();
    try {
      const res = await fetch(API('/api/admin_update_nickname.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, nickname }) });
      const j = await res.json();
      if (!j.ok) { alert(j.error ? `오류: ${j.error}` : '닉네임 변경 실패'); return; }
      flashRow(input?.closest('tr'));
      alert('닉네임이 변경되었습니다.');
    } catch { alert('네트워크 오류'); }
  }));

  tbody.querySelectorAll('[data-save-rank]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-save-rank'), 10);
    const sel = tbody.querySelector(`[data-rank-id="${id}"]`);
    const rank = sel?.value || 'Normal';
    try {
      const res = await fetch(API('/api/admin_update_rank.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, rank }) });
      const j = await res.json();
      if (!j.ok) { alert(j.error ? `오류: ${j.error}` : '등급 변경 실패'); return; }
      flashRow(sel?.closest('tr'));
      alert('등급이 변경되었습니다.');
    } catch { alert('네트워크 오류'); }
  }));

  tbody.querySelectorAll('[data-nick-id]')?.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const id = input.getAttribute('data-nick-id');
      const btn = tbody.querySelector(`[data-save-nick="${id}"]`);
      btn?.click();
    });
  });

  tbody.querySelectorAll('[data-reset]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-reset'), 10);
    if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
    try {
      const res = await fetch(API('/api/admin_reset_password.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id }) });
      const j = await res.json();
      if (!j.ok) { alert(j.error ? `오류: ${j.error}` : '초기화 실패'); return; }
      alert(`임시 비밀번호: ${j.temp_password}`);
    } catch { alert('네트워크 오류'); }
  }));

  tbody.querySelectorAll('[data-setpw]')?.forEach(btn => btn.addEventListener('click', async (e) => {
    const id = parseInt(e.currentTarget.getAttribute('data-setpw'), 10);
    const pw = prompt('새 비밀번호를 입력하세요.');
    if (!pw) return;
    try {
      const res = await fetch(API('/api/admin_update_password.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id, password: pw }) });
      const j = await res.json();
      if (!j.ok) { alert(j.error ? `오류: ${j.error}` : '변경 실패'); return; }
      alert('비밀번호가 변경되었습니다.');
    } catch { alert('네트워크 오류'); }
  }));
}
initAdminUsersPage();

// Admin customers page wiring
async function initAdminCustomersPage() {
  const table = document.getElementById('customersTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const searchEl = document.getElementById('customerSearch');
  const pagerEl = document.getElementById('customerPager');
  const pageSize = 15;
  window.__adminCustomersPageState = window.__adminCustomersPageState || { page: 1, lastQuery: '' };
  let rows = [];
  let loadError = '';
  let needsLogin = false;
  try {
    const res = await fetch(API('/api/admin_users_all.php'), { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 403) {
        loadError = '관리자 로그인 상태가 필요합니다.';
        needsLogin = true;
      } else {
        loadError = '데이터를 불러올 수 없습니다.';
      }
    } else {
      rows = await res.json();
    }
  } catch {
    loadError = 'DB 연결 또는 네트워크 오류입니다.';
  }
  if (loadError) {
    tbody.innerHTML = `<tr><td colspan="5" class="quotes-empty-inline">${loadError}</td></tr>`;
    if (pagerEl) pagerEl.innerHTML = '';
    if (needsLogin && typeof createLoginModal === 'function') {
      createLoginModal();
    }
    return;
  }
  const q = (searchEl?.value || '').trim().toLowerCase();
  const pageState = window.__adminCustomersPageState;
  if (pageState.lastQuery !== q) {
    pageState.page = 1;
    pageState.lastQuery = q;
  }
  const filtered = (rows || []).filter(u => {
    if (!q) return true;
    const username = (u.username || '').toString().toLowerCase();
    const nickname = (u.nickname || '').toString().toLowerCase();
    return username.includes(q) || nickname.includes(q);
  });
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = '1';
    searchEl.addEventListener('input', () => initAdminCustomersPage());
  }
  const fmtDate = (ts) => {
    if (!ts) return '-';
    const raw = Number(ts);
    const ms = raw < 1000000000000 ? raw * 1000 : raw;
    return new Date(ms).toLocaleString();
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
  })[c]);
  const ranks = ['Normal','Bronze','Silver','Gold','Platinum','VIP','Manager'];
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(pageState.page, totalPages);
  pageState.page = currentPage;
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  const dataRows = (pageItems || []).map(u => `
    <tr data-id="${u.id}">
      <td>${esc(u.username)}</td>
      <td>${esc(u.nickname || '-')}</td>
      <td>${esc(u.rank || '-')}</td>
      <td>${esc(u.status || '-')}</td>
      <td>${fmtDate(u.created_at)}</td>
    </tr>`
  ).join('');
  if (!dataRows) {
    tbody.innerHTML = `<tr><td colspan="5" class="quotes-empty-inline">검색 결과가 없습니다.</td></tr>`;
  } else {
    const placeholders = Array.from({length: Math.max(0, pageSize - ((pageItems||[]).length))})
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');
    tbody.innerHTML = dataRows + placeholders;
  }

  function renderPager(){
    if (!pagerEl) return;
    pagerEl.innerHTML = `
      <button type="button" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
      <div class="page-info">${currentPage} / ${totalPages} (총 ${total})</div>
      <button type="button" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>다음</button>
    `;
    pagerEl.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-page');
        if (dir === 'prev' && pageState.page > 1) pageState.page -= 1;
        if (dir === 'next' && pageState.page < totalPages) pageState.page += 1;
        initAdminCustomersPage();
      });
    });
  }
  renderPager();

  function openCustomerDetail(item){
    const wrap = document.createElement('div');
    const rankOptions = ranks.map(r => `<option ${item.rank===r?'selected':''}>${r}</option>`).join('');
    wrap.innerHTML = `
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="customerDetailTitle">
        <div class="modal-card modal-lg">
          <div class="modal-header">
            <div class="modal-title" id="customerDetailTitle">고객 상세</div>
            <button class="modal-close" type="button" aria-label="닫기" data-modal-close>×</button>
          </div>
          <div class="modal-body">
            <div class="detail-meta">가입일: ${fmtDate(item.created_at)} · 권한: ${esc(item.role || '-')}</div>
            <label>아이디</label><input value="${esc(item.username)}" disabled>
            <label>닉네임</label><input id="custNickname" value="${esc(item.nickname || '')}">
            <label>등급</label><select id="custRank">${rankOptions}</select>
            <label>상태</label>
            <select id="custStatus">
              <option value="정상" ${(item.status==='정상')?'selected':''}>정상</option>
              <option value="일시정지" ${(item.status==='일시정지')?'selected':''}>일시정지</option>
              <option value="정지" ${(item.status==='정지')?'selected':''}>정지</option>
            </select>
            <label>비밀번호 변경</label><input id="custPassword" type="password" placeholder="새 비밀번호 입력" />
            <div class="modal-actions">
              <button class="btn" id="custResetPw">비밀번호 초기화</button>
              <button class="btn btn-accent ml-8" id="custApply">적용</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const closeAll = () => { wrap.remove(); };
    wrap.querySelectorAll('[data-modal-close]')?.forEach(el => el.addEventListener('click', closeAll));
    wrap.querySelector('#custResetPw')?.addEventListener('click', async () => {
      if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
      try {
        const res = await fetch(API('/api/admin_reset_password.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id: item.id }) });
        const j = await res.json();
        if (!j.ok) { alert(j.error ? `오류: ${j.error}` : '초기화 실패'); return; }
        alert(`임시 비밀번호: ${j.temp_password}`);
      } catch { alert('네트워크 오류'); }
    });
    wrap.querySelector('#custApply')?.addEventListener('click', async () => {
      const nickname = (wrap.querySelector('#custNickname')?.value || '').trim();
      const rank = wrap.querySelector('#custRank')?.value || item.rank || 'Normal';
      const status = wrap.querySelector('#custStatus')?.value || item.status || '정상';
      const password = wrap.querySelector('#custPassword')?.value || '';
      try {
        if (nickname !== (item.nickname || '')) {
          await fetch(API('/api/admin_update_nickname.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id: item.id, nickname }) });
        }
        if (rank !== (item.rank || '')) {
          await fetch(API('/api/admin_update_rank.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id: item.id, rank }) });
        }
        if (status !== (item.status || '')) {
          await fetch(API('/api/admin_update_status.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id: item.id, status }) });
        }
        if (password) {
          await fetch(API('/api/admin_update_password.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ id: item.id, password }) });
        }
        initAdminCustomersPage();
        closeAll();
      } catch {
        alert('저장에 실패했습니다.');
      }
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { once: true });
  }

  tbody.querySelectorAll('tr[data-id]')?.forEach(tr => tr.addEventListener('click', () => {
    const id = parseInt(tr.getAttribute('data-id'), 10);
    const item = (rows || []).find(x => x.id === id);
    if (item) openCustomerDetail(item);
  }));
}
initAdminCustomersPage();

// Admin coupons page wiring
function initAdminCouponsPage() {
  const userSearch = document.getElementById('adminCouponUserSearch');
  const couponSelect = document.getElementById('adminCouponSelect');
  const grantBtn = document.getElementById('adminCouponGrantBtn');
  const revokeBtn = document.getElementById('adminCouponRevokeBtn');
  const tableWrap = document.getElementById('adminCouponsTableWrap');
  if (!userSearch || !couponSelect || !grantBtn || !revokeBtn || !tableWrap) return;
  let selectedUserId = null;
  let selectedCouponId = null;
  let selectedUserCouponId = null;

  // 쿠폰 목록 불러오기
  fetch(API('/api/coupons_my.php'), { credentials: 'include' })
    .then(r => r.json())
    .then(list => {
      couponSelect.innerHTML = list.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    });

  // 사용자 검색 및 쿠폰 목록 조회
  userSearch.addEventListener('change', () => {
    const q = userSearch.value.trim();
    if (!q) return;
    fetch(API(`/api/admin_coupons_list.php?user_id=${encodeURIComponent(q)}`), { credentials: 'include' })
      .then(r => r.json())
      .then(rows => {
        selectedUserId = q;
        renderTable(rows);
      });
  });

  function renderTable(rows) {
    let html = `<table class="admin-coupons-table"><thead><tr><th>쿠폰명</th><th>수량</th><th>발급일</th><th>회수일</th><th>선택</th></tr></thead><tbody>`;
    for (const r of rows) {
      html += `<tr><td>${r.coupon_name}</td><td>${r.qty ?? 1}</td><td>${r.granted_at ?? '-'}</td><td>${r.revoked_at ?? '-'}</td><td><input type="radio" name="user_coupon" value="${r.user_coupon_id}"></td></tr>`;
    }
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
    // 라디오 선택 이벤트
    tableWrap.querySelectorAll('input[name="user_coupon"]').forEach(input => {
      input.addEventListener('change', e => {
        selectedUserCouponId = input.value;
      });
    });
  }

  grantBtn.addEventListener('click', () => {
    if (!selectedUserId || !couponSelect.value) return alert('사용자와 쿠폰을 선택하세요');
    fetch(API('/api/admin_coupon_grant.php'), {
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams({ user_id: selectedUserId, coupon_id: couponSelect.value })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        alert('쿠폰 발급 완료');
        userSearch.dispatchEvent(new Event('change'));
      } else {
        alert(res.error || '발급 실패');
      }
    });
  });

  revokeBtn.addEventListener('click', () => {
    if (!selectedUserCouponId) return alert('회수할 쿠폰을 선택하세요');
    fetch(API('/api/admin_coupon_revoke.php'), {
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams({ user_coupon_id: selectedUserCouponId })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        alert('쿠폰 회수 완료');
        userSearch.dispatchEvent(new Event('change'));
      } else {
        alert(res.error || '회수 실패');
      }
    });
  });
}

initAdminApprovalsPage();
initAdminUsersPage();
initAdminCouponsPage();
// (중복 제거) 인덱스 페이지의 견적 목록은 상단부의 SSE+폴링 로직을 사용합니다.

function showMainAdPopup() {
  if (document.querySelector('.main-ad-popup')) return;
  if (localStorage.getItem('hideMainAdToday') === getTodayStr()) return;
  let popup = document.createElement('div');
  popup.className = 'main-ad-popup';
  popup.innerHTML = `
    <div class="main-ad-content">
      <strong>🎉 SEPNP 특별 이벤트!</strong>
      <p>지금 회원가입 시 <b>목형비 면제 쿠폰</b> 증정!<br>견적 문의도 빠르게!</p>
      <div class="main-ad-actions">
        <button id="mainAdCloseBtn">닫기</button>
        <button id="mainAdHideTodayBtn">오늘 하루 보지 않기</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('mainAdCloseBtn').onclick = () => popup.remove();
  document.getElementById('mainAdHideTodayBtn').onclick = () => {
    localStorage.setItem('hideMainAdToday', getTodayStr());
    popup.remove();
  };
}
function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
function isHomePage() {
  const path = location.pathname.replace(/\\/g, '/');
  return path.endsWith('/index.html') || path === '/' || path.endsWith('/SEPNPHP/');
}

if (document.body && isHomePage()) {
  window.addEventListener('DOMContentLoaded', showMainAdPopup);
}
