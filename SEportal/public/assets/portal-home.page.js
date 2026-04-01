PortalStore.hydrate(['sepnp_workstatus', 'sepnp_products', 'sepnp_worker_assignments']).then(async () => {
  const empNo = sessionStorage.getItem('sepnp_emp_no');
  const empName = sessionStorage.getItem('sepnp_emp_name');
  const empRole = sessionStorage.getItem('sepnp_emp_role');

  if (!empNo) {
    alert('로그인이 필요합니다.');
    location.href = 'index.html';
  }

  let userPerms = [];
  try {
    const permsJson = sessionStorage.getItem('sepnp_emp_perms');
    if (permsJson) {
      userPerms = JSON.parse(permsJson);
    }
  } catch (e) {
    console.error('권한 파싱 오류:', e);
  }

  console.log('✅ 로그인 사용자:', empName, '/', empRole);
  console.log('✅ 권한:', userPerms);

  let employeesCache = [];
  async function loadEmployees() {
    try {
      employeesCache = await API.getEmployees();
    } catch {
      employeesCache = [];
    }
  }
  await loadEmployees();

  function loadStats() {
    try {
      const workStatus = JSON.parse(
        localStorage.getItem('sepnp_workstatus_v3') || '{"pool":[],"lanes":{},"completed":[]}'
      );

      let progressCount = 0;
      if (workStatus.lanes) {
        Object.values(workStatus.lanes).forEach((lane) => {
          progressCount += Array.isArray(lane) ? lane.filter((c) => c.status === 'prog').length : 0;
        });
      }
      document.getElementById('statProgress').textContent = progressCount;

      const today = new Date().toISOString().slice(0, 10);
      const completedToday = Array.isArray(workStatus.completed)
        ? workStatus.completed.filter((c) => c.completedAt && c.completedAt.startsWith(today)).length
        : 0;
      document.getElementById('statCompleted').textContent = completedToday;

      const waitingCount = Array.isArray(workStatus.pool) ? workStatus.pool.length : 0;
      document.getElementById('statWaiting').textContent = waitingCount;

      const products = JSON.parse(localStorage.getItem('sepnp_products') || '[]');
      document.getElementById('statProducts').textContent = products.length;
    } catch (e) {
      console.error('통계 로드 실패:', e);
      document.getElementById('statProgress').textContent = '0';
      document.getElementById('statCompleted').textContent = '0';
      document.getElementById('statWaiting').textContent = '0';
      document.getElementById('statProducts').textContent = '0';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    console.log('='.repeat(50));
    console.log('[DOMContentLoaded] 페이지 로드 완료');
    console.log('[DOMContentLoaded] empNo:', empNo);
    console.log('[DOMContentLoaded] empRole:', empRole);
    console.log('[DOMContentLoaded] Permissions 모듈:', window.Permissions ? '있음' : '없음');
    console.log('='.repeat(50));

    Permissions.applyGates();
    loadStats();
  });
});
