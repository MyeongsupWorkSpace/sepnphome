const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginAlert = document.getElementById('loginAlert');
const loginIdInput = document.getElementById('loginId');
const loginPasswordInput = document.getElementById('loginPassword');

function showAlert(message, type = 'error') {
  loginAlert.textContent = message;
  loginAlert.className = `alert alert-${type} show`;

  setTimeout(() => {
    loginAlert.classList.remove('show');
  }, 4000);
}

async function loginWithServer(loginId, password) {
  try {
    const result = await API.login(loginId, password);
    if (result.ok) {
      sessionStorage.setItem('sepnp_emp_no', result.emp.empNo);
      sessionStorage.setItem('sepnp_emp_name', result.emp.name);
      sessionStorage.setItem('sepnp_emp_role', result.emp.role);
      sessionStorage.setItem('sepnp_emp_username', result.emp.username);
      if (result.emp.perms) {
        sessionStorage.setItem('sepnp_emp_perms', JSON.stringify(result.emp.perms));
      }
      showAlert('로그인 성공!', 'success');
      setTimeout(() => {
        window.location.href = 'employee.html';
      }, 500);
      return true;
    }
  } catch (error) {
    console.error('로그인 오류:', error);
    showAlert(error?.message || '로그인 실패', 'error');
    return false;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const loginId = loginIdInput.value.trim();
  const password = loginPasswordInput.value;

  if (!loginId || !password) {
    showAlert('ID와 비밀번호를 입력하세요.', 'error');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = '로그인 중...';
  const success = await loginWithServer(loginId, password);

  if (!success) {
    loginBtn.disabled = false;
    loginBtn.textContent = '로그인';
  }
});

loginForm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loginBtn.click();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  loginIdInput.focus();

  const empNo = sessionStorage.getItem('sepnp_emp_no');
  if (empNo) {
    window.location.href = 'employee.html';
  }
});
