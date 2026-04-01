const $ = (s) => document.querySelector(s);
let employees = [];
let pending = [];
let approveTarget = null;
let detailTarget = null; // 수정 대상 사원

async function loadAll() {
  if (!window.API?.getEmployees) {
    alert('API를 사용할 수 없습니다.');
    employees = [];
    pending = [];
  } else {
    employees = await window.API.getEmployees();
    pending = await window.API.getEmployees({ status: 'pending' });
  }
  renderEmployees();
  renderPending();
  Permissions.applyGates();
}

function renderPending() {
  const tb = $('#tbodyPending');
  if (!pending.length) {
    tb.innerHTML = '<tr><td colspan="7" style="padding:24px;color:#6b7280">승인 대기 중인 신청이 없습니다.</td></tr>';
    return;
  }
  tb.innerHTML = pending
    .map(
      (p) => `
        <tr>
          <td>${(p.createdAt || '').slice(0, 10)}</td>
          <td>${p.username}</td>
          <td class="align-left"><strong>${p.name}</strong></td>
          <td>${p.dept}</td>
          <td class="align-left">${p.email || '-'}</td>
          <td><span class="badge pending">대기</span></td>
          <td>
            <button class="btn primary" data-perm="employee.manage" onclick="openApprove('${p.id}')">승인</button>
            <button class="btn danger" data-perm="employee.manage" onclick="rejectPending('${p.id}')">반려</button>
          </td>
        </tr>
      `
    )
    .join('');
  Permissions.applyGates(document);
}

function openApprove(id) {
  const p = pending.find((x) => x.id === id);
  if (!p) return;
  approveTarget = p;
  $('#apprUsername').value = p.username;
  $('#apprName').value = p.name;
  $('#apprDept').value = p.dept;
  $('#apprEmail').value = p.email || '';
  $('#apprPhone').value = '';
  $('#apprEmpNo').value = '';
  $('#apprPosition').value = '사원';
  $('#apprJoinDate').valueAsDate = new Date();
  $('#apprRole').value = 'viewer';
  document.querySelectorAll("input[name='apprPerm']").forEach((b) => (b.checked = false));
  $('#approveModal').classList.add('show');
  Permissions.applyGates($('#approveModal'));
}

function closeApprove() {
  approveTarget = null;
  $('#approveModal').classList.remove('show');
}

function getCheckedPerms(nameAttr) {
  return Array.from(document.querySelectorAll(`input[name='${nameAttr}']:checked`)).map((x) => x.value);
}

async function approveNow() {
  if (!Permissions.has('employee.manage')) {
    alert('권한이 없습니다.');
    return;
  }
  if (!approveTarget) {
    return;
  }
  const empNo = $('#apprEmpNo').value.trim();
  if (!empNo) {
    alert('사원번호를 입력하세요.');
    return;
  }
  if (employees.some((e) => e.empNo === empNo)) {
    alert('이미 존재하는 사원번호입니다.');
    return;
  }

  const newEmpId = String(approveTarget.id || '').startsWith('pend_')
    ? `emp_${Date.now()}`
    : approveTarget.id || `emp_${Date.now()}`;

  const emp = {
    id: newEmpId,
    empNo,
    username: approveTarget.username,
    passwordHash: approveTarget.passwordHash,
    name: $('#apprName').value.trim(),
    dept: $('#apprDept').value,
    position: $('#apprPosition').value,
    phone: $('#apprPhone').value.trim(),
    email: $('#apprEmail').value.trim(),
    joinDate: $('#apprJoinDate').value,
    status: 'active',
    role: $('#apprRole').value,
    perms: getCheckedPerms('apprPerm'),
    createdAt: new Date().toISOString()
  };

  try {
    if (!window.API?.updateEmployee) {
      throw new Error('api_unavailable');
    }
    await window.API.updateEmployee(approveTarget.id, emp);
  } catch (e) {
    alert('승인 처리 실패');
    return;
  }
  closeApprove();
  await loadAll();
  alert('승인 완료: 계정이 활성화되었습니다.');
}

async function rejectPending(id) {
  if (!Permissions.has('employee.manage')) {
    alert('권한이 없습니다.');
    return;
  }
  if (!confirm('이 가입신청을 반려하시겠습니까?')) return;
  try {
    if (!window.API?.deleteEmployee) {
      throw new Error('api_unavailable');
    }
    await window.API.deleteEmployee(id);
  } catch (e) {
    alert('반려 처리 실패');
    return;
  }
  await loadAll();
  alert('반려 처리되었습니다.');
}

function resetForm() {
  $('#empNo').value = '';
  $('#empName').value = '';
  $('#empDept').value = '';
  $('#empPosition').value = '';
  $('#empPhone').value = '';
  $('#empEmail').value = '';
  $('#empJoinDate').value = '';
  $('#empStatus').value = 'active';
  $('#empPassword').value = '';
  $('#empRole').value = 'viewer';
  document.querySelectorAll("input[name='empPerm']").forEach((b) => (b.checked = false));
}

async function registerEmployee() {
  if (!Permissions.has('employee.manage')) {
    alert('권한이 없습니다.');
    return;
  }
  const empNo = $('#empNo').value.trim();
  const name = $('#empName').value.trim();
  const dept = $('#empDept').value;
  const position = $('#empPosition').value;
  const phone = $('#empPhone').value.trim();
  const email = $('#empEmail').value.trim();
  const joinDate = $('#empJoinDate').value;
  const status = $('#empStatus').value;
  const role = $('#empRole').value;
  const perms = getCheckedPerms('empPerm');
  const password = $('#empPassword')?.value?.trim();
  if (!empNo || !name || !dept || !position || !joinDate) {
    alert('필수 항목을 입력하세요.');
    return;
  }
  if (employees.find((e) => e.empNo === empNo)) {
    alert('이미 등록된 사번입니다.');
    return;
  }
  try {
    if (!window.API?.createEmployee) {
      throw new Error('api_unavailable');
    }
    await window.API.createEmployee({ empNo, name, dept, position, phone, email, joinDate, status, role, perms, password });
  } catch (e) {
    alert('사원 등록 실패');
    return;
  }
  await loadAll();
  resetForm();
  alert('사원이 등록되었습니다.');
}

function renderEmployees() {
  const query = ($('#searchQuery')?.value || '').toLowerCase();
  const filterDept = $('#filterDept')?.value || '';
  const filterStatus = $('#filterStatus')?.value || '';
  const list = employees.filter((e) => {
    const q =
      !query ||
      e.empNo?.toLowerCase().includes(query) ||
      e.name?.toLowerCase().includes(query) ||
      e.dept?.toLowerCase().includes(query);
    const d = !filterDept || e.dept === filterDept;
    const s = !filterStatus || e.status === filterStatus;
    return q && d && s;
  });

  const tbody = $('#tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding:24px;color:#6b7280">사원이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map((e) => {
      const statusBadge = e.status === 'active' ? 'active' : e.status === 'leave' ? 'leave' : 'inactive';
      const statusText = e.status === 'active' ? '재직' : e.status === 'leave' ? '휴직' : '퇴사';
      return `
        try {
          if (!window.API?.updateEmployee) {
            throw new Error('api_unavailable');
          }
          await window.API.updateEmployee(detailTarget.id, detailTarget);
        } catch (e) {
          <td><span class="badge ${statusBadge}">${statusText}</span></td>
          <td><button class="btn primary" onclick="openDetail('${e.id}')">상세</button></td>
        </tr>`;
    })
    .join('');
}

function searchEmployee() {
  renderEmployees();
}

function exportCSV() {
  if (!Permissions.has('employee.export')) {
    alert('권한이 없습니다.');
    return;
  }
  const header = ['사번', '이름', 'ID', '부서', '직급', '연락처', '이메일', '입사일', '상태', '역할'];
  const rows = employees.map((e) => [
    e.empNo,
    e.name,
    e.username || '',
    e.dept || '',
    e.position || '',
    e.phone || '',
    e.email || '',
    e.joinDate || '',
    e.status === 'active' ? '재직' : e.status === 'leave' ? '휴직' : '퇴사',
    e.role || 'viewer'
  ]);
  const csv = [header].concat(rows).map((r) => r.map((v) => `"${v}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `사원목록_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function openDetail(id) {
  const emp = employees.find((e) => e.id === id);
  if (!emp) return;
  detailTarget = emp;

  $('#detailEmpNo').value = emp.empNo;
  $('#detailUsername').value = emp.username || '';
  $('#detailName').value = emp.name;
  $('#detailDept').value = emp.dept;
  $('#detailPosition').value = emp.position;
  $('#detailPhone').value = emp.phone || '';
  $('#detailEmail').value = emp.email || '';
  $('#detailJoinDate').value = emp.joinDate;
  $('#detailStatus').value = emp.status;
  $('#detailRole').value = emp.role || 'viewer';

  document.querySelectorAll("input[name='detailPerm']").forEach((b) => (b.checked = false));
  const perms = Array.isArray(emp.perms) && emp.perms.length ? emp.perms : Permissions.ROLE_PRESETS[emp.role || 'viewer'] || [];
  if (perms.includes('*')) {
    document.querySelectorAll("input[name='detailPerm']").forEach((b) => (b.checked = true));
  } else {
    perms.forEach((p) => {
      const el = Array.from(document.querySelectorAll("input[name='detailPerm']")).find((b) => b.value === p);
      if (el) el.checked = true;
    });
  }

  $('#detailModal').classList.add('show');
  Permissions.applyGates($('#detailModal'));
}

function closeDetail() {
  detailTarget = null;
  $('#detailModal').classList.remove('show');
}

async function saveDetail() {
  if (!Permissions.has('employee.manage')) {
    alert('권한이 없습니다.');
    return;
  }
  if (!detailTarget) return;

  detailTarget.name = $('#detailName').value.trim();
  detailTarget.dept = $('#detailDept').value;
  detailTarget.position = $('#detailPosition').value;
  detailTarget.phone = $('#detailPhone').value.trim();
  detailTarget.email = $('#detailEmail').value.trim();
  detailTarget.joinDate = $('#detailJoinDate').value;
  detailTarget.status = $('#detailStatus').value;
  detailTarget.role = $('#detailRole').value;
  detailTarget.perms = getCheckedPerms('detailPerm');

  try {
    if (!window.API?.updateEmployee) {
      throw new Error('api_unavailable');
    }
    await window.API.updateEmployee(detailTarget.id, detailTarget);
  } catch (e) {
    alert('사원 정보 수정 실패');
    return;
  }
  await loadAll();
  closeDetail();
  alert('사원 정보가 수정되었습니다.');
}

async function deleteEmployee() {
  if (!Permissions.has('employee.manage')) {
    alert('권한이 없습니다.');
    return;
  }
  if (!detailTarget) return;
  if (!confirm(`${detailTarget.name} 사원을 삭제하시겠습니까?`)) return;
  try {
    if (!window.API?.deleteEmployee) {
      throw new Error('api_unavailable');
    }
    await window.API.deleteEmployee(detailTarget.id);
  } catch (e) {
    alert('사원 삭제 실패');
    return;
  }
  await loadAll();
  closeDetail();
  alert('사원이 삭제되었습니다.');
}

document.addEventListener('DOMContentLoaded', () => {
  loadAll();

  $('#btnEmpPermPreset')?.addEventListener('click', () => {
    const role = $('#empRole').value;
    const preset = Permissions.ROLE_PRESETS[role] || [];
    document
      .querySelectorAll("input[name='empPerm']")
      .forEach((b) => (b.checked = preset.includes('*') || preset.includes(b.value)));
  });
  $('#btnEmpPermClear')?.addEventListener('click', () =>
    document.querySelectorAll("input[name='empPerm']").forEach((b) => (b.checked = false))
  );

  $('#btnApprPermPreset')?.addEventListener('click', () => {
    const role = $('#apprRole').value;
    const preset = Permissions.ROLE_PRESETS[role] || [];
    document
      .querySelectorAll("input[name='apprPerm']")
      .forEach((b) => (b.checked = preset.includes('*') || preset.includes(b.value)));
  });
  $('#btnApprPermClear')?.addEventListener('click', () =>
    document.querySelectorAll("input[name='apprPerm']").forEach((b) => (b.checked = false))
  );

  $('#btnDetailPermPreset')?.addEventListener('click', () => {
    const role = $('#detailRole').value;
    const preset = Permissions.ROLE_PRESETS[role] || [];
    document
      .querySelectorAll("input[name='detailPerm']")
      .forEach((b) => (b.checked = preset.includes('*') || preset.includes(b.value)));
  });
  $('#btnDetailPermClear')?.addEventListener('click', () =>
    document.querySelectorAll("input[name='detailPerm']").forEach((b) => (b.checked = false))
  );

  $('#approveModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'approveModal') closeApprove();
  });
  $('#detailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeDetail();
  });

  $('#searchQuery')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchEmployee();
  });
});
