const form = document.getElementById('registerForm');
const btn = document.getElementById('registerBtn');
const alertBox = document.getElementById('registerAlert');
const btnCheckUsername = document.getElementById('btnCheckUsername');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const passwordMismatchMsg = document.getElementById('passwordMismatchMsg');
let usernameChecked = false;
let lastCheckedValue = '';
let passwordMismatch = false;

function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type} show`;
  setTimeout(() => alertBox.classList.remove('show'), 4000);
}

function validatePasswordMatch(showMessage = false) {
  const password = passwordInput.value;
  const confirm = passwordConfirmInput.value;
  if (!confirm) {
    passwordMismatch = false;
    btn.disabled = false;
    passwordMismatchMsg.classList.remove('show');
    return;
  }
  if (password !== confirm) {
    passwordMismatch = true;
    btn.disabled = true;
    if (showMessage) passwordMismatchMsg.classList.add('show');
    return;
  }
  passwordMismatch = false;
  btn.disabled = false;
  passwordMismatchMsg.classList.remove('show');
}

async function checkUsernameDuplicate() {
  const username = usernameInput.value.trim();
  if (!username) {
    showAlert('아이디를 입력하세요.');
    return;
  }

  btnCheckUsername.disabled = true;
  btnCheckUsername.textContent = '확인 중...';

  try {
    if (!window.API?.getEmployees) {
      throw new Error('중복 확인을 사용할 수 없습니다.');
    }
    const employees = await window.API.getEmployees();
    const pending = await window.API.getEmployees({ status: 'pending' });
    const exists = [...(employees || []), ...(pending || [])].some((e) => e.username === username);

    if (exists) {
      usernameChecked = false;
      lastCheckedValue = '';
      showAlert('이미 사용 중인 아이디입니다.', 'error');
    } else {
      usernameChecked = true;
      lastCheckedValue = username;
      showAlert('사용 가능한 아이디입니다.', 'success');
    }
  } catch (err) {
    usernameChecked = false;
    lastCheckedValue = '';
    showAlert(err.message || '중복 확인 중 오류가 발생했습니다.');
  } finally {
    btnCheckUsername.disabled = false;
    btnCheckUsername.textContent = '중복확인';
  }
}

btnCheckUsername.addEventListener('click', checkUsernameDuplicate);
usernameInput.addEventListener('input', () => {
  usernameChecked = false;
  lastCheckedValue = '';
});
passwordInput.addEventListener('input', () => validatePasswordMatch(false));
passwordConfirmInput.addEventListener('input', () => validatePasswordMatch(false));
passwordConfirmInput.addEventListener('blur', () => validatePasswordMatch(true));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const name = document.getElementById('name').value.trim();
  const dept = document.getElementById('dept').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('passwordConfirm').value;

  if (!username || !name || !dept || !password) {
    showAlert('필수 항목을 입력하세요.');
    return;
  }
  if (!usernameChecked || lastCheckedValue !== username) {
    showAlert('아이디 중복확인을 진행하세요.');
    return;
  }
  if (passwordMismatch || password !== passwordConfirm) {
    showAlert('비밀번호가 일치하지 않습니다.');
    return;
  }
  if (password !== passwordConfirm) {
    showAlert('비밀번호가 일치하지 않습니다.');
    return;
  }

  btn.disabled = true;
  try {
    const payload = {
      username,
      name,
      dept,
      email,
      password,
      status: 'pending',
      role: 'viewer',
      joinDate: new Date().toISOString().slice(0, 10)
    };

    if (!window.API?.registerEmployee) {
      throw new Error('회원가입 API를 사용할 수 없습니다.');
    }
    await window.API.registerEmployee(payload);
    showAlert('가입 신청이 완료되었습니다. 관리자 승인 후 로그인하세요.', 'success');
    setTimeout(() => {
      location.href = 'index.html';
    }, 1200);
    return;
  } catch (err) {
    showAlert(err.message || '가입 중 오류가 발생했습니다.');
  } finally {
    btn.disabled = false;
  }
});
