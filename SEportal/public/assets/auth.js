(function(){
  const KEY_EMPLOYEES = 'sepnp_employees';
  const KEY_PENDING = 'sepnp_pending_employees';

  function load(key, def=[]) {
    try { 
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : def;
    } catch(e){ 
      console.error('localStorage load error:', e);
      return def; 
    }
  }
  
  function save(key, val){ 
    try {
      localStorage.setItem(key, JSON.stringify(val)); 
    } catch(e) {
      console.error('localStorage save error:', e);
    }
  }

  async function sha256(text){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function findEmployeeByLoginId(loginId){
    const emps = load(KEY_EMPLOYEES);
    const id = (loginId||'').trim();
    return emps.find(e => (e.username && e.username === id) || (e.empNo && e.empNo === id));
  }

  async function ensureDefaultAdmin(){
    const emps = load(KEY_EMPLOYEES);
    let changed = false;

    // 기본 관리자 1: sepnp / 0536
    let admin1 = emps.find(e => e.username === 'sepnp');
    if (!admin1) {
      const passwordHash = await sha256('0536');
      emps.push({
        id: 'emp_admin',
        empNo: 'ADMIN',
        username: 'sepnp',
        passwordHash,
        name: '관리자',
        dept: '관리부',
        position: '관리자',
        phone: '',
        email: '',
        joinDate: new Date().toISOString().slice(0,10),
        status: 'active',
        role: 'admin',
        perms: ['*'],
        createdAt: new Date().toISOString()
      });
      changed = true;
    } else if (admin1.role !== 'admin' || !admin1.perms?.includes('*')) {
      admin1.role = 'admin';
      admin1.perms = ['*'];
      changed = true;
    }

    // 기본 관리자 2: test / 123
    let admin2 = emps.find(e => e.username === 'test');
    if (!admin2) {
      const passwordHash2 = await sha256('123');
      emps.push({
        id: 'emp_admin2',
        empNo: 'ADMIN2',
        username: 'test',
        passwordHash: passwordHash2,
        name: '관리자2',
        dept: '관리부',
        position: '관리자',
        phone: '',
        email: '',
        joinDate: new Date().toISOString().slice(0,10),
        status: 'active',
        role: 'admin',
        perms: ['*'],
        createdAt: new Date().toISOString()
      });
      changed = true;
    } else if (admin2.role !== 'admin' || !admin2.perms?.includes('*')) {
      admin2.role = 'admin';
      admin2.perms = ['*'];
      changed = true;
    }

    // 테스트 계정 5개
    const testAccounts = [
      { username: 'print', password: '1234', empNo: 'TEST_PRINT', name: '인쇄담당자', dept: '생산부', position: '사원', perms: ['assign.print'] },
      { username: 'thomson', password: '1234', empNo: 'TEST_THOMSON', name: '톰슨담당자', dept: '생산부', position: '사원', perms: ['assign.thomson'] },
      { username: 'coating', password: '1234', empNo: 'TEST_COATING', name: '코팅담당자', dept: '생산부', position: '사원', perms: ['assign.coating'] },
      { username: 'adhesive', password: '1234', empNo: 'TEST_ADHESIVE', name: '접착담당자', dept: '생산부', position: '사원', perms: ['assign.adhesive'] },
      { username: 'lamination', password: '1234', empNo: 'TEST_LAMINATION', name: '합지담당자', dept: '생산부', position: '사원', perms: ['assign.lamination'] }
    ];

    for (const acc of testAccounts) {
      let existing = emps.find(e => e.username === acc.username);
      if (!existing) {
        const passwordHash = await sha256(acc.password);
        emps.push({
          id: `emp_${acc.empNo.toLowerCase()}`,
          empNo: acc.empNo,
          username: acc.username,
          passwordHash,
          name: acc.name,
          dept: acc.dept,
          position: acc.position,
          phone: '',
          email: '',
          joinDate: new Date().toISOString().slice(0,10),
          status: 'active',
          role: 'staff',
          perms: acc.perms,
          createdAt: new Date().toISOString()
        });
        changed = true;
      } else if (!existing.perms || !existing.perms.includes(acc.perms[0])) {
        existing.perms = acc.perms;
        changed = true;
      }
    }

    if (changed) {
      save(KEY_EMPLOYEES, emps);
      console.log('✅ 기본 계정 생성/업데이트 완료');
    }
  }

  async function signIn(loginId, password){
    if(!loginId || !password) {
      return { ok:false, msg:'ID와 비밀번호를 입력하세요.' };
    }

    // 기본 계정 보장
    await ensureDefaultAdmin();

    const emp = findEmployeeByLoginId(loginId);
    
    if(!emp) {
      const pend = load(KEY_PENDING);
      if(pend.find(p=>p.username===loginId)) {
        return { ok:false, msg:'관리자 승인 대기 중입니다.' };
      }
      return { ok:false, msg:'계정을 찾을 수 없습니다.' };
    }
    
    if(emp.status !== 'active') {
      return { ok:false, msg:'활성화되지 않은 계정입니다.' };
    }

    const hash = await sha256(password);
    if(emp.passwordHash !== hash) {
      return { ok:false, msg:'비밀번호가 일치하지 않습니다.' };
    }

    // 세션 저장
    sessionStorage.setItem('sepnp_emp_no', emp.empNo);
    sessionStorage.setItem('sepnp_emp_name', emp.name || '');
    sessionStorage.setItem('sepnp_emp_role', emp.role || 'viewer');
    sessionStorage.setItem('sepnp_emp_username', emp.username || '');
    
    console.log('✅ 로그인 성공:', emp.name);
    
    return { ok:true, emp };
  }

  function signOut(){
    sessionStorage.removeItem('sepnp_emp_no');
    sessionStorage.removeItem('sepnp_emp_name');
    sessionStorage.removeItem('sepnp_emp_role');
    sessionStorage.removeItem('sepnp_emp_username');
  }

  async function registerPending({ username, name, dept, email, password }){
    username = (username||'').trim();
    name = (name||'').trim();
    dept = (dept||'').trim();
    email = (email||'').trim();
    
    if(!username || !name || !dept || !password) {
      return { ok:false, msg:'필수 항목을 입력하세요.' };
    }

    const emps = load(KEY_EMPLOYEES);
    const pend = load(KEY_PENDING);
    
    if(emps.some(e => e.username === username) || pend.some(p => p.username === username)) {
      return { ok:false, msg:'이미 사용 중인 ID입니다.' };
    }

    const passwordHash = await sha256(password);
    pend.push({ 
      id: 'pend_'+Date.now(), 
      username, 
      name, 
      dept, 
      email, 
      passwordHash, 
      createdAt: new Date().toISOString() 
    });
    save(KEY_PENDING, pend);
    
    return { ok:true };
  }

  function listPending(){ 
    return load(KEY_PENDING); 
  }
  
  function removePending(id){
    let pend = load(KEY_PENDING);
    pend = pend.filter(p => p.id !== id);
    save(KEY_PENDING, pend);
  }

  function upsertEmployee(emp){
    const emps = load(KEY_EMPLOYEES);
    const idx = emps.findIndex(e => e.id === emp.id || e.empNo === emp.empNo);
    if(idx >= 0) {
      emps[idx] = emp;
    } else {
      emps.push(emp);
    }
    save(KEY_EMPLOYEES, emps);
  }

  // 페이지 로드 시 기본 계정 생성
  ensureDefaultAdmin().catch(e => console.error('계정 초기화 실패:', e));

  // 전역 객체로 노출
  window.Auth = {
    signIn, 
    signOut, 
    registerPending,
    listPending, 
    removePending, 
    upsertEmployee,
    ensureDefaultAdmin
  };
})();