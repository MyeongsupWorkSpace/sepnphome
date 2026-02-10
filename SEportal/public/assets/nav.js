(function () {
  const NAV_ITEMS = [
    { href: 'employee.html', label: '대시보드' },
    { href: 'print-plan.html', label: '인쇄계획표' },
    { href: 'assign.html', label: '인쇄배정' },
    { href: 'work-status.html', label: '작업현황' },
    { href: 'product-register.html', label: '제품 등록' },
    { href: 'product-list.html', label: '제품 목록' },
    { href: 'order-register.html', label: '수주 오더 등록' },
    { href: 'inventory.html', label: '재고현황' },
    { href: 'dispatch.html', label: '배차관리' },
    { href: 'sales.html', label: '매출현황' },
    { href: 'employee-management.html', label: '사원관리' }
  ];

  function ensurePortalStyles() {
    const head = document.head;
    if (!head) return;
    const addLink = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      head.appendChild(link);
    };
    const addFont = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      head.appendChild(link);
    };
    addFont('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
    addFont('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css');
    addLink('../../assets/css/styles.css');
    addLink('assets/portal.css');
    if (!window.API) {
      const script = document.createElement('script');
      script.src = 'assets/api.js';
      head.appendChild(script);
    }
  }

  function buildHeader() {
    const header = document.querySelector('header.fixed-header') || document.querySelector('header.site-header');
    if (!header) return;
    document.body.classList.add('portal-body');
    header.className = 'site-header portal-header';

    const current = (location.pathname.split('/').pop() || '').toLowerCase();
    const links = NAV_ITEMS.map(it => {
      const active = current === it.href.toLowerCase() ? ' aria-current="page"' : '';
      return `<li><a href="${it.href}"${active}>${it.label}</a></li>`;
    }).join('');

    header.innerHTML = `
      <div class="container header-top">
        <a href="employee.html" class="logo" aria-label="포털 홈">
          <img src="../../assets/img/SE_logo.png" alt="SEPNP 로고" />
        </a>
        <span class="portal-title">SE 포털</span>
      </div>
      <div class="container header-bottom">
        <button class="nav-toggle" aria-label="메뉴 열기" aria-expanded="false">☰</button>
        <nav class="site-nav" aria-label="포털 메뉴">
          <ul>${links}</ul>
        </nav>
        <div class="nav-actions">
          <button id="btnLogout" class="btn login-compact">로그아웃</button>
        </div>
      </div>
    `;

    const navToggle = header.querySelector('.nav-toggle');
    const siteNav = header.querySelector('.site-nav');
    navToggle?.addEventListener('click', () => {
      const isOpen = siteNav.classList.contains('open');
      siteNav.classList.toggle('open', !isOpen);
      navToggle.setAttribute('aria-expanded', String(!isOpen));
    });

    header.querySelector('#btnLogout')?.addEventListener('click', () => {
      sessionStorage.removeItem('sepnp_emp_no');
      sessionStorage.removeItem('sepnp_emp_name');
      sessionStorage.removeItem('sepnp_emp_role');
      sessionStorage.removeItem('sepnp_emp_username');
      sessionStorage.removeItem('sepnp_emp_perms');
      location.href = 'index.html';
    });
  }

  function hideInitialModals() {
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
  }

  function initPortal() {
    ensurePortalStyles();
    buildHeader();
    hideInitialModals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortal);
  } else {
    initPortal();
  }

  window.addEventListener('pageshow', hideInitialModals);
})();

/* ===== 네비게이션 보조(비파괴 추가) ===== */
(() => {
  try {
    const here = location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('nav a, .nav a, header a');
    links.forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (href && href === here) a.classList.add('active');
    });
  } catch (e) {
    // no-op
  }
})();