(function(){
  const cached = new Set();
  let patched = false;

  const aliasMap = {
    sepnp_products: ['sepnp_products_v1'],
    sepnp_orders: ['sepnp_orders_v1'],
    sepnp_assign: ['sepnp_assign_v1','sepnp_assign_v2'],
    sepnp_workstatus: ['sepnp_workstatus_v3','sepnp_workstatus_v6'],
    sepnp_jobs: ['sepnp_jobs_v1'],
    sepnp_print_slots: ['sepnp_print_slots_v1'],
    sepnp_dispatches: ['sepnp_dispatches'],
    sepnp_inventory_products: ['sepnp_inventory_products'],
    sepnp_inventory_papers: ['sepnp_inventory_papers'],
    sepnp_vehicles: ['sepnp_vehicles'],
    sepnp_customers: ['sepnp_customers'],
    sepnp_destinations: ['sepnp_destinations'],
    sepnp_worker_assignments: ['sepnp_worker_assignments'],
    sepnp_auth: ['sepnp_auth']
  };

  const apiSourceMap = {
    sepnp_products: () => window.API?.getProducts?.(),
    sepnp_orders: () => window.API?.getOrders?.()
  };

  function normalizeKey(key) {
    const entries = Object.entries(aliasMap);
    for (const [canonical, aliases] of entries) {
      if (canonical === key || (aliases || []).includes(key)) return canonical;
    }
    return key;
  }

  function expandKeys(keys = []) {
    const out = new Set();
    keys.filter(Boolean).forEach((k) => {
      const canon = normalizeKey(k);
      out.add(canon);
      (aliasMap[canon] || []).forEach(a => out.add(a));
    });
    return Array.from(out);
  }

  async function hydrate(keys = []) {
    if (!window.API || !window.API.getKV) return;
    const list = expandKeys(keys);
    const canonKeys = Array.from(new Set(list.map(normalizeKey)));

    await Promise.all(canonKeys.map(async (canon) => {
      try {
        let data = await window.API.getKV(canon);
        if (data == null && apiSourceMap[canon]) {
          try {
            data = await apiSourceMap[canon]();
            if (data != null) await window.API.setKV(canon, data);
          } catch {}
        }
        if (data == null) {
          const aliases = aliasMap[canon] || [];
          for (const a of aliases) {
            const aliasData = await window.API.getKV(a);
            if (aliasData != null) { data = aliasData; break; }
          }
        }
        if (data !== undefined) {
          const payload = JSON.stringify(data);
          localStorage.setItem(canon, payload);
          (aliasMap[canon] || []).forEach(a => { localStorage.setItem(a, payload); });
          cached.add(canon);
        }
      } catch {}
    }));

    patchLocalStorage(list);
  }

  function patchLocalStorage(keys = []) {
    if (patched) return;
    const keySet = new Set(expandKeys(keys));
    const origSet = localStorage.setItem.bind(localStorage);
    const origRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = (k, v) => {
      origSet(k, v);
      const canon = normalizeKey(k);
      if (canon !== k) origSet(canon, v);
      (aliasMap[canon] || []).forEach(a => { if (a !== k) origSet(a, v); });
      if (keySet.has(k) || keySet.has(canon)) {
        if (window.API?.setKV) {
          try {
            const parsed = JSON.parse(v);
            window.API.setKV(canon, parsed);
          } catch {
            window.API.setKV(canon, v);
          }
        }
      }
    };
    localStorage.removeItem = (k) => {
      origRemove(k);
      const canon = normalizeKey(k);
      if (canon !== k) origRemove(canon);
      (aliasMap[canon] || []).forEach(a => { if (a !== k) origRemove(a); });
      if (keySet.has(k) || keySet.has(canon)) {
        if (window.API?.setKV) window.API.setKV(canon, null);
      }
    };
    patched = true;
  }

  window.PortalStore = { hydrate, patchLocalStorage, normalizeKey };
})();
