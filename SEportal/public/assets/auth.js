(function(){
  function requireApi() {
    if (!window.API) {
      throw new Error('API 모듈이 로드되지 않았습니다.');
    }
    return window.API;
  }

  async function signIn(loginId, password){
    if(!loginId || !password) {
      return { ok:false, msg:'ID와 비밀번호를 입력하세요.' };
    }
    const api = requireApi();
    const result = await api.login(loginId, password);
    if (result?.ok && result.emp) {
      sessionStorage.setItem('sepnp_emp_no', result.emp.empNo);
      sessionStorage.setItem('sepnp_emp_name', result.emp.name || '');
      sessionStorage.setItem('sepnp_emp_role', result.emp.role || 'viewer');
      sessionStorage.setItem('sepnp_emp_username', result.emp.username || '');
      if (result.emp.perms) {
        sessionStorage.setItem('sepnp_emp_perms', JSON.stringify(result.emp.perms));
      }
    }
    return result;
  }

  function signOut(){
    sessionStorage.removeItem('sepnp_emp_no');
    sessionStorage.removeItem('sepnp_emp_name');
    sessionStorage.removeItem('sepnp_emp_role');
    sessionStorage.removeItem('sepnp_emp_username');
    sessionStorage.removeItem('sepnp_emp_perms');
  }

  async function registerPending({ username, name, dept, email, password }){
    username = (username||'').trim();
    name = (name||'').trim();
    dept = (dept||'').trim();
    email = (email||'').trim();
    
    if(!username || !name || !dept || !password) {
      return { ok:false, msg:'필수 항목을 입력하세요.' };
    }
    const api = requireApi();
    await api.registerEmployee({
      username,
      name,
      dept,
      email,
      password,
      status: 'pending',
      role: 'viewer',
      joinDate: new Date().toISOString().slice(0, 10)
    });
    return { ok:true };
  }

  async function listPending(){
    const api = requireApi();
    return await api.getEmployees({ status: 'pending' });
  }
  
  async function removePending(id){
    const api = requireApi();
    return await api.deleteEmployee(id);
  }

  async function listEmployees(){
    const api = requireApi();
    return await api.getEmployees();
  }

  async function deleteEmployeeById(id){
    const api = requireApi();
    return await api.deleteEmployee(id);
  }

  async function deleteEmployeeByKey(key){
    const api = requireApi();
    const list = await api.getEmployees();
    const target = (list || []).find(e => e.empNo === key || e.username === key);
    if (target?.id) {
      return await api.deleteEmployee(target.id);
    }
    return { ok:false, msg:'not_found' };
  }

  async function upsertEmployee(emp){
    const api = requireApi();
    if (emp?.id) {
      return await api.updateEmployee(emp.id, emp);
    }
    return await api.createEmployee(emp || {});
  }

  function ensureDefaultAdmin(){
    return { ok:true };
  }

  window.Auth = {
    signIn, 
    signOut, 
    registerPending,
    listPending, 
    removePending, 
    upsertEmployee,
    listEmployees,
    deleteEmployeeById,
    deleteEmployeeByKey,
    ensureDefaultAdmin
  };
})();