(function(){
  // SEPNPHP API 사용
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API_BASE = isLocal ? 'http://127.0.0.1:8000' : '';
  const API = (p) => `${API_BASE}/api/${p}`;

  async function request(path, options = {}) {
    const res = await fetch(API(path), {
      headers: { 'Content-Type': 'application/json', ...(options.headers||{}) },
      ...options
    });
    const data = await res.json();
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.msg || data?.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function loginWithFallback(loginId, password) {
    try {
      return await request('portal_login.php', {
        method: 'POST', body: JSON.stringify({ loginId, password })
      });
    } catch (e) {
      // 정적 환경 폴백: sepnp/0536 관리자 로그인 허용
      if ((loginId || '').toLowerCase() === 'sepnp' && password === '0536') {
        return {
          ok: true,
          emp: {
            empNo: 'ADMIN',
            name: '관리자',
            role: 'admin',
            username: 'sepnp',
            dept: '관리부',
            position: '관리자',
            perms: ['*']
          }
        };
      }
      throw e;
    }
  }

  const resource = (r) => ({
    list: (params={}) => {
      const qs = new URLSearchParams({ r, ...params }).toString();
      return request(`portal_resource.php?${qs}`, { method: 'GET' });
    },
    create: (data) => request(`portal_resource.php?r=${encodeURIComponent(r)}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`portal_resource.php?r=${encodeURIComponent(r)}&id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`portal_resource.php?r=${encodeURIComponent(r)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  });

  window.API = {
    // auth
    login: (loginId, password) => loginWithFallback(loginId, password),

    // employees
    getEmployees: (params={}) => request(`portal_employees.php?${new URLSearchParams(params).toString()}`, { method: 'GET' }),
    createEmployee: (data) => request('portal_employees.php', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployee: (id, data) => request(`portal_employees.php?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployee: (id) => request(`portal_employees.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

    // resources
    getProducts: () => resource('products').list(),
    createProduct: (data) => resource('products').create(data),
    updateProduct: (id, data) => resource('products').update(id, data),
    deleteProduct: (id) => resource('products').remove(id),

    listSuppliers: (q='') => resource('suppliers').list(q ? { q } : {}),
    postSupplier: (data) => {
      if (typeof data === 'string') return resource('suppliers').create({ name: data });
      return resource('suppliers').create(data || {});
    },

    listPapers: () => resource('papers').list(),
    postPaper: (data) => resource('papers').create(data),

    listMaterials: () => resource('materials').list(),
    postMaterial: (data) => resource('materials').create(data),

    getCustomers: () => resource('customers').list(),
    createCustomer: (data) => resource('customers').create(data),
    updateCustomer: (id, data) => resource('customers').update(id, data),
    deleteCustomer: (id) => resource('customers').remove(id),

    getOrders: () => resource('orders').list(),
    createOrder: (data) => resource('orders').create(data),
    updateOrder: (id, data) => resource('orders').update(id, data),
    deleteOrder: (id) => resource('orders').remove(id),

    getAssignments: (date) => resource('assignments').list(date ? { date } : {}),
    createAssignment: (data) => resource('assignments').create(data),
    updateAssignment: (id, data) => resource('assignments').update(id, data),
    deleteAssignment: (id) => resource('assignments').remove(id),

    // kv
    getKV: (key) => request(`portal_kv.php?key=${encodeURIComponent(key)}`, { method: 'GET' }).then(r => r.data),
    setKV: (key, data) => request('portal_kv.php', { method: 'POST', body: JSON.stringify({ key, data }) })
  };
})();