document.addEventListener('DOMContentLoaded', () => {
  if (!Permissions.has('quotation.view')) {
    alert('견적서를 볼 권한이 없습니다.');
    try {
      window.location.href = 'employee.html';
    } catch (e) {}
    return;
  }
  Permissions.applyGates();
});
