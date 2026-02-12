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
        if (!href || href === '#') a.setAttribute('href', `${prefix}/contact.html`);
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
            <th>이름</th>
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
          <th>이름</th>
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
    `<li><a href="#" data-menu="products">제품소개</a></li>`,
    `<li><a href="${prefix}/pages/quote.html">견적문의</a></li>`,
    `<li><a href="${prefix}/pages/contact.html">문의 게시판</a></li>`,
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

// Require login for quote pages (견적문의)
try {
  const user = getLocalUser();
  const path = (location.pathname || '').toLowerCase();
  const needsLogin = ['/pages/quote.html', '/pages/quote-register.html', '/pages/quote-history.html']
    .some(p => path.endsWith(p));
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

// COMPANY 메가 메뉴 동작
function initCompanyMega(){
  const companyLink = document.querySelector('.site-nav a[data-menu="company"]');
  const mega = document.getElementById('companyMega');
  if (!companyLink || !mega) return;
  const position = () => {
    const rect = companyLink.getBoundingClientRect();
    const isFixed = getComputedStyle(mega).position === 'fixed';
    const top = (isFixed ? rect.bottom + 6 : rect.bottom + window.scrollY + 6);
    const left = (isFixed ? rect.left : rect.left + window.scrollX);
    mega.style.top = `${top}px`;
    mega.style.left = `${left}px`;
  };
  const open = () => { position(); mega.hidden = false; };
  const close = () => { mega.hidden = true; };
  const toggle = () => { mega.hidden ? open() : close(); };
  companyLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });
  // 바깥 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (mega.hidden) return;
    const isInside = e.target.closest('#companyMega') || e.target.closest('.site-nav a[data-menu="company"]');
    if (!isInside) close();
  });
  // ESC로 닫기
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // 창 크기/스크롤 변경 시 위치 갱신
  window.addEventListener('resize', () => { if (!mega.hidden) position(); });
  window.addEventListener('scroll', () => { if (!mega.hidden) position(); }, { passive: true });
  // 메뉴 내 링크 클릭 시 닫기
  mega.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
}

function initProductsMega(){
  const link = document.querySelector('.site-nav a[data-menu="products"]');
  const panel = document.getElementById('productsMega');
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
  link.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
  document.addEventListener('click', (e) => {
    if (panel.hidden) return;
    const inside = e.target.closest('#productsMega') || e.target.closest('.site-nav a[data-menu="products"]');
    if (!inside) close();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (!panel.hidden) position(); });
  window.addEventListener('scroll', () => { if (!panel.hidden) position(); }, { passive: true });
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
}

// ADMIN 메가 메뉴 동작
function initAdminMega(){
  const link = document.querySelector('.site-nav a[data-menu="admin"]');
  const panel = document.getElementById('adminMega');
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
  // 클릭은 본래 링크(견적접수)로 이동, 호버/포커스 시 팝오버 노출
  link.addEventListener('mouseenter', () => { open(); });
  link.addEventListener('focus', () => { open(); });
  document.addEventListener('click', (e) => {
    if (panel.hidden) return;
    const inside = e.target.closest('#adminMega') || e.target.closest('.site-nav a[data-menu="admin"]');
    if (!inside) close();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (!panel.hidden) position(); });
  window.addEventListener('scroll', () => { if (!panel.hidden) position(); }, { passive: true });
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
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
        <li><a href="${prefix}/pages/products.html#type-view">타입별 제품</a></li>
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
        <li><a href="${prefix}/pages/admin/users.html?tab=employee">직원 관리</a></li>
        <li><a href="${prefix}/pages/admin/users.html?tab=customer">고객 관리</a></li>
        <li><a href="${prefix}/pages/admin/users.html">사용자 상태</a></li>
        <li><a href="${prefix}/pages/admin/ranks.html">등급 관리</a></li>
        <li><a href="${prefix}/pages/admin/quotes.html">견적 접수</a></li>
        <li><a href="${prefix}/pages/admin/settings.html">사이트 설정</a></li>
      </ul>`;
    container.appendChild(wrap3);
  }
}

// Admin settings page wiring
function initSettingsPage() {
  const form = document.querySelector('form.settings');
  if (!form) return;
  const companyEl = document.getElementById('company');
  const phoneEl = document.getElementById('phone');
  const addressEl = document.getElementById('address');
  const btn = form.querySelector('button[type="button"]');
  // Prefill
  const s = getSiteSettings();
  if (companyEl) companyEl.value = s.company || '';
  if (phoneEl) phoneEl.value = s.phone || '';
  if (addressEl) addressEl.value = s.address || '';
  // Save
  btn?.addEventListener('click', () => {
    const next = setSiteSettings({
      company: companyEl?.value?.trim() || '',
      phone: phoneEl?.value?.trim() || '',
      address: addressEl?.value?.trim() || '',
    });
    applySiteSettingsUI();
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '저장됨';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  });
}
initSettingsPage();

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
  const ranks = ['Normal','Bronze','Silver','Gold','Platinum','VIP'];
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
  const tabWrap = document.querySelector('.admin-user-tabs');
  const tabButtons = tabWrap?.querySelectorAll('[data-user-tab]') || [];
  let rows = [];
  try {
    const res = await fetch(API('/api/admin_users_all.php'), { credentials: 'include' });
    rows = await res.json();
  } catch {}
  const employeeRoles = ['employee','staff'];
  const getActiveTab = () => {
    const active = tabWrap?.querySelector('[data-user-tab].active');
    return (active?.getAttribute('data-user-tab') || 'all');
  };
  if (tabWrap && !tabWrap.dataset.bound) {
    tabWrap.dataset.bound = '1';
    try {
      const urlTab = new URLSearchParams(location.search).get('tab');
      if (urlTab && ['all','customer','employee'].includes(urlTab)) {
        tabButtons.forEach(btn => {
          const isActive = btn.getAttribute('data-user-tab') === urlTab;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      }
    } catch {}
    tabButtons.forEach(btn => btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      initAdminUsersPage();
    }));
  }
  const q = (searchEl?.value || '').trim().toLowerCase();
  const roleFiltered = (rows || []).filter(u => {
    const role = (u.role || '').toString().toLowerCase();
    const isEmployee = employeeRoles.includes(role);
    const tab = getActiveTab();
    if (tab === 'employee') return isEmployee;
    if (tab === 'customer') return !isEmployee && role !== 'admin';
    return true;
  });
  const filtered = (roleFiltered || []).filter(u => {
    if (!q) return true;
    const username = (u.username || '').toString().toLowerCase();
    const nickname = (u.nickname || '').toString().toLowerCase();
    const status = (u.status || '').toString().toLowerCase();
    return username.includes(q) || nickname.includes(q) || status.includes(q);
  });
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = '1';
    searchEl.addEventListener('input', () => initAdminUsersPage());
  }
  const dataRows = (filtered || []).map(u => `
    <tr>
      <td>${u.username}</td>
      <td>${u.nickname || '-'}</td>
      <td>${u.status || '-'}</td>
      <td class="actions">
        <button class="btn" data-status="정상" data-id="${u.id}">정상</button>
        <button class="btn" data-status="일시정지" data-id="${u.id}">일시정지</button>
        <button class="btn btn-accent" data-status="정지" data-id="${u.id}">정지</button>
      </td>
    </tr>`).join('');
  if (!dataRows) {
    tbody.innerHTML = `<tr><td colspan="4" class="quotes-empty-inline">검색 결과가 없습니다.</td></tr>`;
  } else {
    const placeholders = Array.from({length: Math.max(0, 15 - ((filtered||[]).length))})
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
      .join('');
    tbody.innerHTML = dataRows + placeholders;
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
}
initAdminUsersPage();

// Admin coupons page wiring
function initAdminCouponsPage() {
  const userSearch = document.getElementById('adminCouponUserSearch');
  const couponSelect = document.getElementById('adminCouponSelect');
  const grantBtn = document.getElementById('adminCouponGrantBtn');
  const revokeBtn = document.getElementById('adminCouponRevokeBtn');
  const tableWrap = document.getElementById('adminCouponsTableWrap');
  let selectedUserId = null;
  let selectedCouponId = null;
  let selectedUserCouponId = null;

  // 쿠폰 목록 불러오기
  fetch('api/coupons_my.php')
    .then(r => r.json())
    .then(list => {
      couponSelect.innerHTML = list.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    });

  // 사용자 검색 및 쿠폰 목록 조회
  userSearch.addEventListener('change', () => {
    const q = userSearch.value.trim();
    if (!q) return;
    fetch(`api/admin_coupons_list.php?user_id=${encodeURIComponent(q)}`)
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
    fetch('api/admin_coupon_grant.php', {
      method: 'POST',
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
    fetch('api/admin_coupon_revoke.php', {
      method: 'POST',
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
initAdminRanksPage();
initAdminUsersPage();
initAdminCouponsPage();
// (중복 제거) 인덱스 페이지의 견적 목록은 상단부의 SSE+폴링 로직을 사용합니다.

// Board (문의 게시판)
(function initBoard(){
  const listWrap = document.getElementById('boardList');
  const writeBtn = document.getElementById('boardWriteBtn');
  if (!listWrap || !writeBtn) return;
  let page = 1;
  const pageSize = 15;
  let lastItems = [];
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('sepn_user')||'null')||null; } catch { return null; }
  };
  const isAdmin = (u) => !!(u && u.role === 'admin');
  const canView = (u, item) => !item.secret || isAdmin(u) || ((u?.username||'').toLowerCase() === (item.author_username||'').toLowerCase());

  async function load(){
    listWrap.setAttribute('aria-busy','true');
    try {
      const res = await fetch(API('/api/board_list.php'));
      const items = res.ok ? await res.json() : [];
      lastItems = Array.isArray(items) ? items : [];
      render(lastItems);
    } catch { render([]); }
    listWrap.setAttribute('aria-busy','false');
  }

  function fmtDate(ts){
    if (!ts) return '';
    const d = new Date(ts);
    const yy = String(d.getFullYear()%100).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}.${mm}.${dd}`;
  }
  function maskName(name){
    const s = (name||'').trim();
    if (s.length <= 1) return s + '*';
    return s.slice(0, -1) + '*';
  }

  function render(items){
    if (!Array.isArray(items) || items.length === 0){
      // 빈 테이블: 15행 유지, 8번째 행에 중앙 안내문 배치
      const emptyRows = Array.from({length: pageSize}).map((_, i) => (
        i === 7
          ? `<tr><td colspan="5" class="empty-inline">등록한 글이 없습니다</td></tr>`
          : `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
      )).join('');
      listWrap.innerHTML = `
        <table class="board-table"><thead><tr><th>번호</th><th>제목</th><th>작성자</th><th>작성일</th><th>처리</th></tr></thead><tbody>${emptyRows}</tbody></table>
        <div class="board-pager"></div>
      `;
      renderPager(1);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    const rows = pageItems.map((it, idx) => {
      const dateStr = fmtDate(it.timestamp);
      const lock = it.secret ? '<span class="board-lock">비밀글</span>' : '';
      const nameMasked = maskName(it.name || it.author || '-');
      const number = start + idx + 1; // 페이지 기준 번호
      const statusRaw = (it.status || '답변 대기');
      const isDone = statusRaw === '답변완료';
      const statusClass = isDone ? 'status-done' : 'status-pending';
      const statusLabel = isDone ? '답변완료' : '문의중';
      return `<tr data-id="${it.id}"><td>${number}</td><td>${it.title}${lock}</td><td>${nameMasked}</td><td>${dateStr}</td><td><span class="status-badge ${statusClass}">${statusLabel}</span></td></tr>`;
    }).join('');
    const placeholders = Array.from({length: Math.max(0, pageSize - pageItems.length)})
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('');
    listWrap.innerHTML = `
      <table class="board-table"><thead><tr><th>번호</th><th>제목</th><th>작성자</th><th>작성일</th><th>처리</th></tr></thead><tbody>${rows}${placeholders}</tbody></table>
      <div class="board-pager"></div>
    `;
    listWrap.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = Number(tr.getAttribute('data-id'))||0;
        const it = items.find(x=>x.id===id);
        openView(it);
      });
    });
    renderPager(totalPages);
  }

  function renderPager(totalPages){
    const pager = listWrap.querySelector('.board-pager');
    if (!pager) return;
    const makeBtn = (label, p, active=false) => `<button class="page-btn${active?' active':''}" data-page="${p}">${label}</button>`;
    let html = '';
    html += makeBtn('이전', Math.max(1, page-1));
    for (let i=1;i<=totalPages;i++) { html += makeBtn(String(i), i, i===page); }
    html += makeBtn('다음', Math.min(totalPages, page+1));
    pager.innerHTML = html;
    pager.querySelectorAll('.page-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const p = parseInt(e.currentTarget.getAttribute('data-page'), 10);
      if (!isNaN(p)) { page = p; render(lastItems); }
    }));
  }

  function openWrite(){
    const modal = document.getElementById('boardWriteModal');
    if (!modal) return;
    modal.hidden = false;
    modal.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click', closeWrite, { once: true }));
    const submit = document.getElementById('wSubmit');
    submit.onclick = async () => {
      const user = getUser();
      if (!user){ alert('로그인이 필요합니다. 상단 로그인 버튼을 사용하세요.'); return; }
      const title = (document.getElementById('wTitle')?.value||'').trim();
      const category = (document.getElementById('wCategory')?.value||'기타문의').trim();
      const content = (document.getElementById('wContent')?.value||'').trim();
      const secret = !!document.getElementById('wSecret')?.checked;
      const name = (document.getElementById('wName')?.value||'').trim() || (user.nickname||user.username);
      const p1 = (document.getElementById('wPhone1')?.value||'').trim();
      const p2 = (document.getElementById('wPhone2')?.value||'').trim();
      const p3 = (document.getElementById('wPhone3')?.value||'').trim();
      const phone = [p1,p2,p3].filter(Boolean).join('-');
      const password = (document.getElementById('wPassword')?.value||'').trim();
      // 파일 업로드 처리
      let attachments = [];
      try {
        const f1 = document.getElementById('wFile1');
        const f2 = document.getElementById('wFile2');
        const fd = new FormData();
        if (f1 && f1.files && f1.files[0]) fd.append('file1', f1.files[0]);
        if (f2 && f2.files && f2.files[0]) fd.append('file2', f2.files[0]);
        if ([...fd.entries()].length > 0) {
          const resUp = await fetch(API('/api/board_upload.php'), { method:'POST', body: fd });
          const jUp = await resUp.json();
          if (resUp.ok && jUp.ok && Array.isArray(jUp.files)) attachments = jUp.files;
        }
      } catch {}
      if (!title || !content){ alert('제목과 내용을 입력해 주세요.'); return; }
      try {
        const res = await fetch(API('/api/board_submit.php'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, content, secret, status: '문의중', author: user.nickname||user.username, author_username: user.username, name, phone, password, attachments })
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error('등록 실패');
        closeWrite();
        load();
      } catch (err){ alert('오류: 게시글 등록에 실패했습니다'); }
    };
  }
  function closeWrite(){ const modal = document.getElementById('boardWriteModal'); if (modal) modal.hidden = true; }

  async function openView(item){
    const modal = document.getElementById('boardViewModal');
    const body = document.getElementById('viewBody');
    const titleEl = document.getElementById('viewTitle');
    if (!modal || !body || !titleEl) return;
    titleEl.textContent = item?.title || '게시글';
    let payload = { id: item?.id };
    const u = getUser();
    // 관리자/작성자는 비밀번호 없이 시도
    try {
      let res = await fetch(API('/api/board_view.php'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (res.status === 403 && item?.secret && !(u && (u.role==='admin' || (u.username||'').toLowerCase() === (item.author_username||'').toLowerCase()))){
        const pw = window.prompt('비밀글입니다. 비밀번호를 입력하세요.');
        if (!pw) { body.innerHTML = '<div class="loading">비밀글입니다. 작성자와 관리자만 열람 가능합니다.</div>'; modal.hidden = false; return; }
        payload.password = pw;
        res = await fetch(API('/api/board_view.php'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      }
      const j = await res.json();
      if (!res.ok || !j.ok){
        body.innerHTML = '<div class="loading">열람 권한이 없습니다.</div>';
      } else {
        const it = j.item || item;
        const dateStr = it.timestamp ? new Date(it.timestamp).toLocaleString() : '';
        let attHtml = '';
        const atts = Array.isArray(it.attachments) ? it.attachments : [];
        if (atts.length){
          attHtml = '<div style="margin-top:12px;">첨부파일: ' + atts.map(a => `<a href="${a.url}" target="_blank" rel="noopener">${a.name||'파일'}</a>`).join(' · ') + '</div>';
        }
        body.innerHTML = `<div style=\"color:var(--muted);font-size:14px;margin-bottom:8px;\">작성자: ${it.author||'-'} · 등록일: ${dateStr} · 상태: ${it.status||'문의중'}</div><div style=\"white-space:pre-wrap;\">${(it.content||'')}</div>${attHtml}`;
        // 관리자 상태 토글 버튼
        const u2 = getUser();
        if (u2 && u2.role === 'admin'){
          const actions = document.createElement('div');
          actions.style.marginTop = '12px';
          const btnDone = document.createElement('button');
          btnDone.className = 'btn btn-accent';
          btnDone.textContent = '답변완료로 변경';
          btnDone.onclick = async () => { try { await fetch(API('/api/board_status.php'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: it.id, status: '답변완료' }) }); load(); openView(it); } catch {} };
          const btnPending = document.createElement('button');
          btnPending.className = 'btn';
          btnPending.style.marginLeft = '8px';
          btnPending.textContent = '문의중으로 변경';
          btnPending.onclick = async () => { try { await fetch(API('/api/board_status.php'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: it.id, status: '문의중' }) }); load(); openView(it); } catch {} };
          actions.appendChild(btnDone);
          actions.appendChild(btnPending);
          body.appendChild(actions);
        }
        // 조회수는 서버에서 증가 처리함. 목록 갱신.
        load();
      }
    } catch {
      body.innerHTML = '<div class="loading">네트워크 오류로 불러오지 못했습니다.</div>';
    }
    modal.hidden = false;
    modal.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click', ()=>{ modal.hidden = true; }, { once: true }));
  }

  writeBtn.addEventListener('click', openWrite);
  load();
})();

function showMainAdPopup() {
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
if (document.body && location.pathname.endsWith('index.html')) {
  window.addEventListener('DOMContentLoaded', showMainAdPopup);
}

function showMainAdPopupAlways() {
  let popup = document.createElement('div');
  popup.className = 'main-ad-popup';
  popup.innerHTML = `
    <div class="main-ad-content">
      <strong>🚀 테스트 팝업</strong>
      <p>이 팝업은 항상 뜹니다.<br>광고/이벤트/공지 등 원하는 내용을 넣으세요.</p>
      <div class="main-ad-actions">
        <button id="mainAdCloseBtn2">닫기</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('mainAdCloseBtn2').onclick = () => popup.remove();
}
window.onload = showMainAdPopupAlways;
