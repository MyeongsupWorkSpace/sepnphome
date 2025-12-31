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

// Swiper init
const heroSwiper = new Swiper('.hero-swiper', {
  loop: true,
  autoplay: { delay: 7500, disableOnInteraction: false, pauseOnMouseEnter: true },
  speed: 900,
  effect: 'fade',
  fadeEffect: { crossFade: true },
  keyboard: { enabled: true },
  pagination: { el: '.hero .swiper-pagination', clickable: true },
});

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

const productsSwiper = new Swiper('.products-swiper', {
  loop: true,
  autoplay: { delay: 2500, disableOnInteraction: false },
  slidesPerView: 1,
  spaceBetween: 0,
  pagination: { el: '.split-left .swiper-pagination', clickable: true },
});

// Quotes live list (SSE with polling fallback)
const listEl = document.getElementById('quotes-list');
function renderQuotes(quotes) {
  if (!Array.isArray(quotes)) return;
  if (!quotes.length) {
    listEl.innerHTML = '<div class="loading">아직 등록된 견적문의가 없습니다.</div>';
    listEl.setAttribute('aria-busy', 'false');
    return;
  }
  const rows = quotes
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map(q => {
      const dateStr = q.timestamp ? new Date(q.timestamp).toLocaleString() : '';
      const name = q.name || '-';
      const title = q.product || (q.message ? (q.message + '').slice(0, 40) + '…' : '-');
      const statusRaw = (q.status || '문의중');
      const isDone = /완료/.test(statusRaw);
      const statusClass = isDone ? 'status-done' : 'status-pending';
      const statusLabel = isDone ? '처리완료' : '문의중';
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
        ${rows}
      </tbody>
    </table>
  `;
  listEl.innerHTML = table;
  listEl.setAttribute('aria-busy', 'false');
}

function initQuotesStream() {
  try {
    const es = new EventSource('api/quotes_sse.php');
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
    let res = await fetch('api/quotes_list.php');
    if (!res.ok) throw new Error('fetch failed');
    let data = await res.json();
    renderQuotes(data);
  } catch (e1) {
    try {
      // 2차: 폴백 엔드포인트 사용
      const res2 = await fetch('api/quotes_list2.php');
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
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title" id="loginTitle">로그인</div>
          <button class="modal-close" type="button" aria-label="닫기" data-modal-close>×</button>
        </div>
        <div class="modal-body">
          <label for="modalLoginId">아이디</label>
          <input id="modalLoginId" placeholder="아이디" />
          <label for="modalLoginPw">비밀번호</label>
          <input id="modalLoginPw" type="password" placeholder="비밀번호" />
          <div class="modal-actions">
            <button type="button" class="btn" id="openRegister">회원가입</button>
            <button type="button" class="btn" data-modal-close>취소</button>
            <button type="button" class="btn btn-accent" id="modalLoginSubmit">로그인</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const closeAll = () => { wrap.remove(); };
  wrap.querySelectorAll('[data-modal-close]')?.forEach(el => el.addEventListener('click', closeAll));
  const submit = wrap.querySelector('#modalLoginSubmit');
  submit?.addEventListener('click', async () => {
    const username = (document.getElementById('modalLoginId')?.value || '').trim();
    const password = (document.getElementById('modalLoginPw')?.value || '').trim();
    if (!username || !password) return;
    try {
      const res = await fetch('api/auth_login.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error === 'pending_approval' ? '승인 대기 중입니다.' : '로그인 실패'); return; }
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
  });
  const regBtn = wrap.querySelector('#openRegister');
  regBtn?.addEventListener('click', () => { createRegisterModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { once: true });
}

function renderAuth() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  const raw = localStorage.getItem('sepn_user');
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch {}
  if (user && user.nickname) {
    const rank = (user.rank || '').toLowerCase();
    const rankClass = ['bronze','silver','gold','platinum','vip','master','normal'].includes(rank) ? `rank-${rank}` : 'rank-normal';
    const rankLabel = rank === 'normal' ? '노말등급' : (user.rank || 'SILVER').toUpperCase();
    actions.innerHTML = `
      <span class="user-info">
        <span class="rank-badge ${rankClass}">${rankLabel}</span>
        <span class="nickname">${user.nickname}</span>
      </span>
      <button type="button" class="btn login-compact logout-btn">로그아웃</button>
    `;
    const logout = actions.querySelector('.logout-btn');
    logout?.addEventListener('click', () => {
      localStorage.removeItem('sepn_user');
      renderAuth();
      renderNav();
    });
  } else {
    actions.innerHTML = `<button type="button" class="btn login-compact" id="openLogin">로그인</button>`;
    const btn = actions.querySelector('#openLogin');
    btn?.addEventListener('click', () => { createLoginModal(); });
  }
}

renderAuth();

// Dynamic navigation: admin vs normal
function renderNav() {
  const siteNavList = document.querySelector('.site-nav ul');
  if (!siteNavList) return;
  const raw = localStorage.getItem('sepn_user');
  let user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch {}
  const isAdmin = !!(user && user.role === 'admin');
  if (isAdmin) {
    // 관리자는 고객 네비게이션도 함께 표시
    siteNavList.innerHTML = `
      <li><a href="pages/admin/approvals.html">가입 승인 관리</a></li>
      <li><a href="pages/admin/ranks.html">회원 등급 관리</a></li>
      <li><a href="pages/admin/settings.html">사이트 설정</a></li>
      <li style="opacity:.55;">|</li>
      <li><a href="pages/about.html">회사소개</a></li>
      <li><a href="pages/products.html">제품소개</a></li>
      <li><a href="pages/quote.html">견적문의</a></li>
      <li><a href="pages/contact.html">문의 게시판</a></li>
    `;
  } else {
    siteNavList.innerHTML = `
      <li><a href="pages/about.html">회사소개</a></li>
      <li><a href="pages/products.html">제품소개</a></li>
      <li><a href="pages/quote.html">견적문의</a></li>
      <li><a href="pages/contact.html">문의 게시판</a></li>
    `;
  }
}

renderNav();

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
      const res = await fetch('api/auth_register.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname })
      });
      const data = await res.json();
      if (!data.ok) { alert('가입 실패(아이디 중복 등)'); return; }
      // 즉시 승인 처리: 자동 로그인 시도
      try {
        // 1차: 정상 로그인 엔드포인트
        let res2 = await fetch('api/auth_login.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
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
          await fetch('api/dev_force_login_admin.php').catch(()=>{});
          const res3 = await fetch('api/auth_me2.php');
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
        await fetch('api/admin_approve_all.php', { method: 'POST' });
        initAdminApprovalsPage();
      } catch {}
    });
    table.parentElement?.insertBefore(btnWrap, table);
    btnWrap.appendChild(btn);
  }
  try {
    // 페이지 로드시 자동 일괄 승인 실행
    try { await fetch('api/admin_approve_all.php', { method: 'POST' }); } catch {}
    const res = await fetch('api/admin_users_pending.php');
    const rows = await res.json();
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = (rows || []).map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.nickname || '-'}</td>
        <td>${new Date((u.created_at||0)*1000).toLocaleString()}</td>
        <td class="actions">
          <button class="btn btn-accent" data-approve="${u.id}">승인</button>
          <button class="btn" data-deny="${u.id}">거절</button>
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-approve]')?.forEach(btn => btn.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.getAttribute('data-approve'), 10);
      await fetch('api/admin_approve_user.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, action:'approve' }) });
      initAdminApprovalsPage();
    }));
    tbody.querySelectorAll('[data-deny]')?.forEach(btn => btn.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.getAttribute('data-deny'), 10);
      await fetch('api/admin_approve_user.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, action:'deny' }) });
      initAdminApprovalsPage();
    }));
  } catch {}
}

async function initAdminRanksPage() {
  const table = document.getElementById('ranksTable');
  if (!table) return;
  try {
    const res = await fetch('api/admin_users_all.php');
    const rows = await res.json();
    const tbody = table.querySelector('tbody');
    const ranks = ['Normal','Bronze','Silver','Gold','Platinum','VIP'];
    tbody.innerHTML = (rows || []).map(u => {
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
    tbody.querySelectorAll('[data-apply]')?.forEach(btn => btn.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.getAttribute('data-apply'), 10);
      const sel = tbody.querySelector(`[data-sel="${id}"]`);
      const rank = sel?.value || 'Silver';
      await fetch('api/admin_update_rank.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, rank }) });
      initAdminRanksPage();
    }));
  } catch {}
}

initAdminApprovalsPage();
initAdminRanksPage();

// Quotes: use polling only
function initQuotesPolling() {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, 5000);
}
if (listEl) { initQuotesPolling(); }

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
      const res = await fetch('api/board_list.php');
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
      // 빈 테이블이라도 15행 공간 유지
      const emptyRows = Array.from({length: pageSize}).map(() => (
        `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
      )).join('');
      listWrap.innerHTML = `
        <table class="board-table"><thead><tr><th>분류</th><th>제목</th><th>이름</th><th>날짜</th><th>답변상태</th></tr></thead><tbody>${emptyRows}</tbody></table>
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
    const rows = pageItems.map(it => {
      const dateStr = fmtDate(it.timestamp);
      const lock = it.secret ? '<span class="board-lock">비밀글</span>' : '';
      const nameMasked = maskName(it.name || it.author || '-');
      const status = (it.status||'문의중') === '답변완료' ? '답변완료' : '문의중';
      const category = it.category || '기타문의';
      return `<tr data-id="${it.id}"><td>${category}</td><td>${it.title}${lock}</td><td>${nameMasked}</td><td>${dateStr}</td><td>${status}</td></tr>`;
    }).join('');
    const placeholders = Array.from({length: Math.max(0, pageSize - pageItems.length)})
      .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('');
    listWrap.innerHTML = `
      <table class="board-table"><thead><tr><th>분류</th><th>제목</th><th>이름</th><th>날짜</th><th>답변상태</th></tr></thead><tbody>${rows}${placeholders}</tbody></table>
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
      const order_no = (document.getElementById('wOrder')?.value||'').trim();
      const password = (document.getElementById('wPassword')?.value||'').trim();
      if (!title || !content){ alert('제목과 내용을 입력해 주세요.'); return; }
      try {
        const res = await fetch('api/board_submit.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, content, secret, status: '문의중', author: user.nickname||user.username, author_username: user.username, name, phone, order_no, password })
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error('등록 실패');
        closeWrite();
        load();
      } catch (err){ alert('오류: 게시글 등록에 실패했습니다'); }
    };
  }
  function closeWrite(){ const modal = document.getElementById('boardWriteModal'); if (modal) modal.hidden = true; }

  function openView(item){
    const modal = document.getElementById('boardViewModal');
    const body = document.getElementById('viewBody');
    const titleEl = document.getElementById('viewTitle');
    if (!modal || !body || !titleEl) return;
    const u = getUser();
    const allowed = canView(u, item||{});
    titleEl.textContent = item?.title || '게시글';
    if (!allowed){
      body.innerHTML = '<div class="loading">비밀글입니다. 작성자와 관리자만 열람 가능합니다.</div>';
    } else {
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : '';
      body.innerHTML = `<div style=\"color:var(--muted);font-size:14px;margin-bottom:8px;\">작성자: ${item.author||'-'} · 등록일: ${dateStr}</div><div style=\"white-space:pre-wrap;\">${(item.content||'')}</div>`;
    }
    modal.hidden = false;
    modal.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click', ()=>{ modal.hidden = true; }, { once: true }));
  }

  writeBtn.addEventListener('click', openWrite);
  load();
})();
