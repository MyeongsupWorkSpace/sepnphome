const empNo = sessionStorage.getItem('sepnp_emp_no');
const empRole = sessionStorage.getItem('sepnp_emp_role');
if (!empNo) location.href = 'index.html';

const KEY_ASSIGNMENTS = 'sepnp_worker_assignments';
const $ = (s) => document.querySelector(s);

const PROCESS_MAP = {
  인쇄: ['인쇄 1호기', '인쇄 2호기', '인쇄 3호기'],
  톰슨: ['톰슨 1호기', '톰슨 2호기', '톰슨 3호기', '톰슨 4호기', '톰슨 5호기'],
  합지: ['합지 1호기'],
  코팅: ['오버코팅 1호기', '오버코팅 2호기', '오버코팅 3호기', '라미네이팅기'],
  금박: ['금박 1호기'],
  형압: ['형압 1호기'],
  접착: ['접착 1호기', '접착 2호기', '접착 3호기', '접착 4호기', '접착 5호기', '접착 6호기', 'PE접착기']
};

let currentDate = new Date();
let editingIndex = null;
let editingDateKey = null;
const editSelectedEmpNos = new Set();

async function loadAssignments(date) {
  try {
    const assignments = await API.getAssignments(date);
    renderAssignmentTable(Array.isArray(assignments) ? assignments : []);
  } catch (error) {
    console.error('편성 로드 오류:', error);
    alert('작업자 편성을 불러오는데 실패했습니다.');
  }
}

async function saveAssignment(assignmentData) {
  try {
    if (assignmentData.id && assignmentData.id !== 'new') {
      await API.updateAssignment(assignmentData.id, assignmentData);
    } else {
      await API.createAssignment(assignmentData);
    }

    alert('저장되었습니다.');
    loadAssignments(assignmentData.date);
  } catch (error) {
    console.error('편성 저장 오류:', error);
    alert('저장에 실패했습니다.');
  }
}

async function deleteAssignment(id, date) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    await API.deleteAssignment(id);

    alert('삭제되었습니다.');
    loadAssignments(date);
  } catch (error) {
    console.error('편성 삭제 오류:', error);
    alert('삭제에 실패했습니다.');
  }
}

function formatDate(date) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const day = weekdays[date.getDay()];
  return `${yyyy}-${mm}-${dd} (${day})`;
}

function getDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function updateStats() {
  const data = loadAssignments();
  const today = getDateKey(new Date());

  const todayAssigns = data[today] || [];
  $('#statToday').textContent = todayAssigns.length;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  let weekCount = 0;
  Object.keys(data).forEach((dateKey) => {
    const d = new Date(dateKey);
    if (d >= weekStart && d <= weekEnd) {
      weekCount += data[dateKey].length;
    }
  });
  $('#statWeek').textContent = weekCount;

  const allWorkers = new Set();
  todayAssigns.forEach((a) => {
    (a.workers || []).forEach((w) => allWorkers.add(w));
  });
  $('#statWorkers').textContent = allWorkers.size;
}

function getActiveEmployees() {
  try {
    const emps = await API.getEmployees();
    return emps.filter((e) => (e.status || 'active') === 'active');
  } catch (e) {
    return [];
  }
}

function renderAssignments() {
  const dateKey = getDateKey(currentDate);
  const data = loadAssignments();
  const list = data[dateKey] || [];

  const filterProcess = $('#filterProcess').value;
  const filterTeam = $('#filterTeam').value;
  const filterShift = $('#filterShift').value;

  const filtered = list.filter((a) => {
    const okP = !filterProcess || a.process === filterProcess;
    const okT = !filterTeam || a.team === filterTeam;
    const okS = !filterShift || a.shift === filterShift;
    return okP && okT && okS;
  });

  const container = $('#assignmentList');
  $('#currentDate').textContent = formatDate(currentDate);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">이 날짜에 등록된 편성이 없습니다.</div>';
    return;
  }

  container.innerHTML = filtered
    .map((a, idx) => {
      const workerNames = (a.workers || []).map((empNo) => {
        const emps = getActiveEmployees();
        const emp = emps.find((e) => e.empNo === empNo);
        return emp ? emp.name : empNo;
      });

      const originalIdx = list.indexOf(a);

      return `
          <div class="assignment-card">
            <div class="header">
              <div>
                <div class="process">${a.process} ${a.machine}</div>
                <div class="machine">${a.team}조 · ${a.shift}</div>
              </div>
              <div class="actions">
                <button class="btn sm" onclick="openEditModal('${dateKey}', ${originalIdx})">수정</button>
                <button class="btn sm" onclick="deleteAssignment('${dateKey}', ${originalIdx})">삭제</button>
              </div>
            </div>
            <div class="info">
              <div>
                <div class="label">시작</div>
                <div>${a.start || '-'}</div>
              </div>
              <div>
                <div class="label">종료</div>
                <div>${a.end || '-'}</div>
              </div>
            </div>
            <div class="workers">
              ${workerNames.map((n) => `<span class="worker-tag">${n}</span>`).join('')}
            </div>
          </div>
        `;
    })
    .join('');

  updateStats();
}

function openEditModal(dateKey, index) {
  const data = loadAssignments();
  const item = data[dateKey][index];
  if (!item) return;

  editingDateKey = dateKey;
  editingIndex = index;

  $('#editModalTitle').textContent = `${item.process} 작업자 편성 수정`;
  $('#editProcess').value = item.process;

  const machSel = $('#editMachine');
  machSel.innerHTML = ['<option value="">선택안됨</option>', ...(PROCESS_MAP[item.process] || []).map((v) => `<option>${v}</option>`)].join('');
  machSel.value = item.machine;

  $('#editDate').value = item.date;
  document.querySelector(`input[name="editTeam"][value="${item.team}"]`).checked = true;
  document.querySelector(`input[name="editShift"][value="${item.shift}"]`).checked = true;
  $('#editStart').value = item.start || '';
  $('#editEnd').value = item.end || '';

  editSelectedEmpNos.clear();
  (item.workers || []).forEach((w) => editSelectedEmpNos.add(w));
  renderEditSelectedTags();
  renderEditEmployeePicker();

  $('#editModal').classList.add('show');
}

function closeEditModal() {
  editingDateKey = null;
  editingIndex = null;
  $('#editModal').classList.remove('show');
}

function renderEditSelectedTags() {
  const box = $('#editSelected');
  const emps = getActiveEmployees().filter((e) => editSelectedEmpNos.has(e.empNo));
  box.innerHTML =
    emps.map((e) => `<span class="tag">${e.name} <small style="color:#6b7280">(${e.empNo})</small></span>`).join('') ||
    '<span style="color:#9ca3af;font-size:12px">작업자를 선택하세요</span>';
}

function renderEditEmployeePicker() {
  const q = ($('#editEmpSearch').value || '').trim().toLowerCase();
  const dept = $('#editEmpDept').value || '';
  const tb = $('#editEmpTbody');
  const list = getActiveEmployees().filter((e) => {
    const okQ =
      !q || (e.name || '').toLowerCase().includes(q) || (e.empNo || '').toLowerCase().includes(q) || (e.dept || '').toLowerCase().includes(q);
    const okD = !dept || e.dept === dept;
    return okQ && okD;
  });
  tb.innerHTML = list
    .map(
      (e) => `
        <tr>
          <td><input type="checkbox" data-empno="${e.empNo}" ${editSelectedEmpNos.has(e.empNo) ? 'checked' : ''}></td>
          <td>${e.empNo}</td>
          <td>${e.name}</td>
          <td>${e.dept || '-'}</td>
          <td>${e.position || '-'}</td>
        </tr>
      `
    )
    .join('');

  tb.querySelectorAll("input[type='checkbox']").forEach((chk) => {
    chk.addEventListener('change', () => {
      const no = chk.dataset.empno;
      if (chk.checked) editSelectedEmpNos.add(no);
      else editSelectedEmpNos.delete(no);
      renderEditSelectedTags();
    });
  });
}

function saveEdit() {
  if (editingDateKey === null || editingIndex === null) return;

  const data = loadAssignments();
  const item = data[editingDateKey][editingIndex];

  item.machine = $('#editMachine').value;
  item.date = $('#editDate').value;
  item.team = document.querySelector('input[name="editTeam"]:checked')?.value || 'A';
  item.shift = document.querySelector('input[name="editShift"]:checked')?.value || '주간';
  item.start = $('#editStart').value;
  item.end = $('#editEnd').value;
  item.workers = Array.from(editSelectedEmpNos);
  item.updatedAt = new Date().toISOString();

  saveAssignments(data);
  alert('수정되었습니다.');
  closeEditModal();
  renderAssignments();
}

function deleteAssignment(dateKey, index) {
  if (!confirm('이 편성을 삭제하시겠습니까?')) return;

  const data = loadAssignments();
  if (data[dateKey]) {
    data[dateKey].splice(index, 1);
    if (data[dateKey].length === 0) delete data[dateKey];
    saveAssignments(data);
    renderAssignments();
  }
}

function exportCSV() {
  const data = loadAssignments();
  const header = ['날짜', '공정', '호기', '작업조', '근무', '시작시간', '종료시간', '작업자'];
  const rows = [];

  Object.keys(data)
    .sort()
    .forEach((dateKey) => {
      data[dateKey].forEach((a) => {
        const emps = getActiveEmployees();
        const workerNames = (a.workers || []).map((empNo) => {
          const emp = emps.find((e) => e.empNo === empNo);
          return emp ? emp.name : empNo;
        }).join(', ');

        rows.push([dateKey, a.process, a.machine, a.team, a.shift, a.start || '', a.end || '', workerNames]);
      });
    });

  const csv = [header]
    .concat(rows)
    .map((r) => r.map((v) => `"${v}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `작업자편성_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

$('#btnPrevDate').addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() - 1);
  renderAssignments();
});

$('#btnNextDate').addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() + 1);
  renderAssignments();
});

$('#btnToday').addEventListener('click', () => {
  currentDate = new Date();
  renderAssignments();
});

$('#btnFilter').addEventListener('click', renderAssignments);
$('#btnExport').addEventListener('click', exportCSV);
$('#btnEditCancel').addEventListener('click', closeEditModal);
$('#btnEditSave').addEventListener('click', saveEdit);
$('#editEmpSearch').addEventListener('input', renderEditEmployeePicker);
$('#editEmpDept').addEventListener('change', renderEditEmployeePicker);
$('#editModal').addEventListener('click', (e) => {
  if (e.target.id === 'editModal') closeEditModal();
});

document.addEventListener('DOMContentLoaded', () => {
  Permissions.applyGates();
  renderAssignments();
});
