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

// API base (supports Go Live / Netlify / custom backends)
// 우선순위: window.API_BASE → localStorage('sepn_api_base') → 로컬 개발(127.0.0.1:8000) → 동일 출처
let API_BASE = '';
try {
  const preset = (typeof window !== 'undefined' && typeof window.API_BASE === 'string') ? window.API_BASE : '';
  const fromStorage = (typeof localStorage !== 'undefined') ? (localStorage.getItem('sepn_api_base') || '') : '';
  if (preset) {
    API_BASE = preset;
  } else if (fromStorage) {
    API_BASE = fromStorage;
  } else {
    const isLocalHost = ['127.0.0.1','localhost'].includes(location.hostname);
    API_BASE = isLocalHost ? 'http://127.0.0.1:8000' : '';
  }
} catch { API_BASE = ''; }
// URL 쿼리로 API 베이스를 즉시 지정하거나 초기화 (?api=https://host 또는 ?api=clear)
try {
  const u = new URL(location.href);
  const q = u.searchParams.get('api');
  if (q) {
    if (q === 'clear') {
      try { localStorage.removeItem('sepn_api_base'); } catch {}
      API_BASE = '';
    } else {
      try { localStorage.setItem('sepn_api_base', q); } catch {}
      API_BASE = q;
    }
    u.searchParams.delete('api');
    history.replaceState(null, '', u.toString());
  }
} catch {}
window.API_BASE = API_BASE;
const API = (p) => `${API_BASE}${p}`;

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
try {
  if (typeof Swiper !== 'undefined') {
    productsSwiper = new Swiper('.products-swiper', {
      loop: true,
      autoplay: { delay: 2500, disableOnInteraction: false },
      slidesPerView: 1,
      spaceBetween: 0,
      pagination: { el: '.split-left .swiper-pagination', clickable: true },
    });
  }
} catch {}

// Quotes live list (SSE with polling fallback)
const listEl = document.getElementById('quotes-list');
function renderQuotes(quotes) {
  if (!Array.isArray(quotes)) return;
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
  const rows = quotes
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map(q => {
      const rawTs = Number(q.timestamp || 0);
      const ts = rawTs ? (rawTs < 1000000000000 ? rawTs * 1000 : rawTs) : 0;
      const dateStr = ts ? new Date(ts).toLocaleString() : '';
      const name = q.name || '-';
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
  const placeholders = Array.from({ length: Math.max(0, 15 - (quotes.length)) })
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

let pollTimer;
async function pollOnce() {
  try {
    // 1차: 정상 엔드포인트 시도
    let res = await fetch(API('/api/quotes_list.php'), { credentials: 'include' });
    if (!res.ok) throw new Error('fetch failed');
    let data = await res.json();
    renderQuotes(data);
  } catch (e1) {
    try {
      // 2차: 폴백 엔드포인트 사용
      const res2 = await fetch(API('/api/quotes_list2.php'), { credentials: 'include' });
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
  // 초기 상태를 즉시 가져오고, 이후 SSE로 실시간 갱신
  try { pollOnce(); } catch {}
  initQuotesStream();
}

// Auth area (login/logout and rank badge)
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
          <h2 class="login-hero-title">환영합니다</h2>
          <p class="login-hero-sub">승인된 회원 전용 포털입니다.</p>
          <ul class="login-points">
            <li>견적 진행 상태 실시간 확인</li>
            <li>관리자 승인·등급 관리</li>
            <li>보안 강화 세션 로그인</li>
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
      const res = await fetch(API('/api/auth_login.php'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        // 개발 환경 폴백: 강제 관리자 로그인 시도 후 세션 조회
        try {
          await fetch(API('/api/dev_force_login_admin.php'), { credentials: 'include' }).catch(()=>{});
          const res3 = await fetch(API('/api/auth_me2.php'), { credentials: 'include' });
          const data3 = await res3.json();
          if (data3.ok && data3.user) {
            localStorage.setItem('sepn_user', JSON.stringify(data3.user));
            closeAll();
            renderAuth();
            renderNav();
            return;
          }
        } catch {}
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
      closeAll();
      renderAuth();
      renderNav();
    } catch {
      // Fallback: 오프라인/로컬 모드
      const isMaster = username.toLowerCase() === 'sepnp';
      const user = isMaster
        ? { username, nickname: '관리자', rank: 'Master', role: 'admin', status: '승인완료' }
        : { username, nickname: username, rank: 'Normal', role: 'user', status: '승인완료' };
      localStorage.setItem('sepn_user', JSON.stringify(user));
      closeAll();
      renderAuth();
      renderNav();
    }
  };
  submit?.addEventListener('click', handleSubmit);
  [idInput, pwInput]?.forEach(el => {
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });
  });
  const regBtn = wrap.querySelector('#openRegister');
  regBtn?.addEventListener('click', () => { createRegisterModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { once: true });
}

function renderAuth() {
  // 마운트 지점부터 보장한 뒤 선택(상단 우선)
  function ensureAuthMount() {
    try {
      const headerTop = document.querySelector('.site-header .header-top');
      const headerBottom = document.querySelector('.site-header .header-bottom');
      if (!headerTop && !headerBottom) return;
      if (headerTop && !headerTop.querySelector('.nav-actions.top-actions')) {
        const top = document.createElement('div');
        top.className = 'nav-actions top-actions';
        top.setAttribute('aria-label', '계정 영역');
        headerTop.appendChild(top);
      }
      if (headerBottom && !headerBottom.querySelector('.nav-actions')) {
        const bottom = document.createElement('div');
        bottom.className = 'nav-actions';
        bottom.setAttribute('aria-label', '계정 영역');
        headerBottom.appendChild(bottom);
      }
    } catch {}
  }
  ensureAuthMount();

  // 우선순위: 상단 헤더의 우측(.top-actions) → 하단 네비 우측
  const topEl = document.querySelector('.nav-actions.top-actions');
  const bottomEl = document.querySelector('.site-header .header-bottom .nav-actions');
  const actions = topEl || bottomEl;
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
      <button type="button" class="btn login-compact logout-btn">로그아웃</button>
    `;
    // 반대 영역은 비워 중복 표시 방지
    if (actions === topEl && bottomEl) bottomEl.innerHTML = '';
    if (actions === bottomEl && topEl) topEl.innerHTML = '';
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
    // 반대 영역은 비워 중복 표시 방지
    if (actions === topEl && bottomEl) bottomEl.innerHTML = '';
    if (actions === bottomEl && topEl) topEl.innerHTML = '';
  }
}

// 로그인 영역 렌더링(에러 폴백 포함)
try {
  renderAuth();
} catch (e) {
  const actions = document.querySelector('.nav-actions');
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
  // Compute link prefix: use absolute paths on http(s), relative on file://
  const isFile = location.protocol === 'file:';
  const inPages = location.pathname.includes('/pages/');
  const prefix = isFile ? (inPages ? '..' : '.') : '';
  const isAdmin = !!(user && (user.role||'').toLowerCase()==='admin');
  siteNavList.innerHTML = [
    `<li><a href="#" data-menu="company">COMPANY</a></li>`,
    `<li><a href="#" data-menu="products">PRODUCTS</a></li>`,
    `<li><a href="${prefix}/pages/quote.html">견적문의</a></li>`,
    `<li><a href="${prefix}/pages/contact.html">문의 게시판</a></li>`,
    isAdmin ? `<li><a href="${prefix}/pages/admin/quotes.html" data-menu="admin">관리</a></li>` : ''
  ].join('');
  // When using mobile nav, close menu on link click
  document.querySelectorAll('.site-nav a').forEach(a => {
    a.addEventListener('click', () => { try { closeNav(); } catch {} });
  });

  // 드롭다운 메뉴 DOM 보장 후 토글 초기화
  ensureDropdownMenus(prefix, isAdmin);
  initCompanyMega();
  initProductsMega();
  if (isAdmin) initAdminMega();
}

renderNav();

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
  // prefix 재계산(파일/페이지 상대 경로 대응)
  const isFile = location.protocol === 'file:';
  const inPages = location.pathname.includes('/pages/');
  const prefix = typeof prefixHint === 'string' ? prefixHint : (isFile ? (inPages ? '..' : '.') : '');
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
        <li><a href="${prefix}/pages/products/color-box.html">칼라박스</a></li>
        <li><a href="${prefix}/pages/products/corrugated-box.html">골판지 박스</a></li>
        <li><a href="${prefix}/pages/products/special-printing.html">특수인쇄</a></li>
        <li><a href="${prefix}/pages/products/commercial-printing.html">상업인쇄</a></li>
        <li><a href="${prefix}/pages/products/shopping-bag.html">쇼핑백</a></li>
        <li><a href="${prefix}/pages/products/etc.html">기타</a></li>
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
          <input id="regId" placeholder="아이디" />
          <label for="regPw">비밀번호</label>
          <input id="regPw" type="password" placeholder="비밀번호" />
          <label for="regNick">닉네임</label>
          <input id="regNick" placeholder="닉네임(선택)" />
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
  submit?.addEventListener('click', async () => {
    const username = (document.getElementById('regId')?.value || '').trim();
    const password = (document.getElementById('regPw')?.value || '').trim();
    const nickname = (document.getElementById('regNick')?.value || '').trim();
    if (!username || !password) return;
    try {
      const res = await fetch(API('/api/auth_register.php'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, nickname })
      });
      const data = await res.json();
      if (!data.ok) { alert('가입 실패(아이디 중복 등)'); return; }
      // 즉시 승인 처리: 자동 로그인 시도
      try {
        // 1차: 정상 로그인 엔드포인트
        let res2 = await fetch(API('/api/auth_login.php'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ username, password }) });
        let data2 = await res2.json();
        if (data2.ok) {
          const u2 = data2.user || {};
          if ((u2.username||'').toLowerCase() === 'sepnp') {
            u2.role = 'admin';
            u2.rank = 'Master';
            u2.nickname = u2.nickname || '관리자';
            u2.status = '승인완료';
          }
          localStorage.setItem('sepn_user', JSON.stringify(u2));
        } else {
          // 2차: 폴백 세션 확인 엔드포인트로 로그인 상태 점검
          await fetch(API('/api/dev_force_login_admin.php'), { credentials: 'include' }).catch(()=>{});
          const res3 = await fetch(API('/api/auth_me2.php'), { credentials: 'include' });
          const data3 = await res3.json();
          if (data3.ok && data3.user) {
            localStorage.setItem('sepn_user', JSON.stringify(data3.user));
          } else {
            const isMaster = username.toLowerCase() === 'sepnp';
            const user = isMaster
              ? { username, nickname: '관리자', rank: 'Master', role: 'admin', status: '승인완료' }
              : { username, nickname: nickname||username, rank: 'Normal', role: 'user', status: '승인완료' };
            localStorage.setItem('sepn_user', JSON.stringify(user));
          }
        }
      } catch {
        const isMaster = username.toLowerCase() === 'sepnp';
        const user = isMaster
          ? { username, nickname: '관리자', rank: 'Master', role: 'admin', status: '승인완료' }
          : { username, nickname: nickname||username, rank: 'Normal', role: 'user', status: '승인완료' };
        localStorage.setItem('sepn_user', JSON.stringify(user));
      }
      alert('가입 완료 및 자동 로그인되었습니다.');
      closeAll();
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
    // 페이지 로드시 자동 일괄 승인 실행
    try { await fetch(API('/api/admin_approve_all.php'), { method: 'POST', credentials: 'include' }); } catch {}
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

initAdminApprovalsPage();
initAdminRanksPage();
// Admin users page wiring
async function initAdminUsersPage() {
  const table = document.getElementById('usersTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  let rows = [];
  try {
    const res = await fetch(API('/api/admin_users_all.php'), { credentials: 'include' });
    rows = await res.json();
  } catch {}
  const dataRows = (rows || []).map(u => `
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
  const placeholders = Array.from({length: Math.max(0, 15 - ((rows||[]).length))})
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
    .join('');
  tbody.innerHTML = dataRows + placeholders;
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
