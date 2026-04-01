(function initNoticeAdmin() {
  const form = document.getElementById('noticeForm');
  const titleInput = document.getElementById('noticeTitle');
  const categoryInput = document.getElementById('noticeCategory');
  const dateInput = document.getElementById('noticeDate');
  const summaryInput = document.getElementById('noticeSummary');
  const contentInput = document.getElementById('noticeContent');
  const editor = document.getElementById('noticeEditor');
  const toolbar = document.querySelector('.notice-toolbar');
  const pinnedInput = document.getElementById('noticePinned');
  const filesInput = document.getElementById('noticeFiles');
  const uploadBtn = document.getElementById('noticeUpload');
  const attachmentsEl = document.getElementById('noticeAttachments');
  const tbody = document.getElementById('noticeTbody');
  const countEl = document.getElementById('noticeCount');
  const resetBtn = document.getElementById('noticeReset');
  const hintEl = document.getElementById('noticeHint');

  if (!form || !tbody) return;

  const API = window.API || ((p) => p);
  let editingId = null;
  let attachments = [];
  let canEdit = true;

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('sepn_user') || 'null'); } catch { return null; }
  };
  const user = getUser();
  const rank = (user?.rank || '').toString().toLowerCase();
  canEdit = rank === 'master';

  const fmtDate = (value) => {
    if (!value) return '';
    return value.replace(/-/g, '.');
  };

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error('network');
    return res.json();
  };

  const setHint = (message, type) => {
    if (!hintEl) return;
    hintEl.textContent = message || '';
    hintEl.classList.remove('ok', 'error');
    if (type) hintEl.classList.add(type);
  };

  const resetForm = () => {
    editingId = null;
    form.reset();
    if (!dateInput.value) {
      const today = new Date();
      dateInput.value = today.toISOString().slice(0, 10);
    }
    if (editor) editor.innerHTML = '';
    if (contentInput) contentInput.value = '';
    if (pinnedInput) pinnedInput.checked = false;
    attachments = [];
    renderAttachments();
    setHint('');
    const saveBtn = document.getElementById('noticeSave');
    if (saveBtn) saveBtn.textContent = '등록';
  };

  const renderAttachments = () => {
    if (!attachmentsEl) return;
    attachmentsEl.innerHTML = '';
    if (!attachments.length) {
      attachmentsEl.textContent = '첨부된 파일이 없습니다.';
      return;
    }
    attachments.forEach((att, idx) => {
      const row = document.createElement('div');
      row.className = 'notice-attachment-item';
      row.innerHTML = `
        <span class="notice-attachment-name">${att.name || '첨부파일'}</span>
        <span class="notice-attachment-size">${att.size ? Math.round(att.size / 1024) + 'KB' : ''}</span>
        <button type="button" class="btn btn-ghost" data-attachment-index="${idx}">제거</button>
      `;
      attachmentsEl.appendChild(row);
    });
  };

  const render = (items) => {
    tbody.innerHTML = '';
    items.forEach((item) => {
      const tr = document.createElement('tr');
      const pinned = item.is_pinned ? '고정' : '-';
      tr.innerHTML = `
        <td>${fmtDate(item.date)}</td>
        <td>${item.category === 'company' ? '회사 소식' : '공지사항'}</td>
        <td>${pinned}</td>
        <td>${item.title || ''}</td>
        <td>${item.summary || ''}</td>
        <td>
          ${canEdit ? `
            <div class="notice-actions-inline">
              <button type="button" class="btn btn-ghost" data-action="edit" data-id="${item.id}">수정</button>
              <button type="button" class="btn btn-ghost" data-action="pin" data-id="${item.id}" data-pinned="${item.is_pinned ? 1 : 0}">${item.is_pinned ? '고정 해제' : '고정'}</button>
              <button type="button" class="btn btn-ghost" data-action="delete" data-id="${item.id}">삭제</button>
            </div>
          ` : '<span class="notice-readonly">읽기 전용</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
    if (countEl) countEl.textContent = `${items.length}건`;
  };

  const loadList = async () => {
    try {
      const data = await fetchJson(API('/api/notices_list.php?include=content&limit=50'));
      render(Array.isArray(data) ? data : []);
    } catch {
      setHint('공지 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const upsert = async (payload) => {
    try {
      const res = await fetchJson(API('/api/notices_save.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res?.ok) throw new Error('save_failed');
      await loadList();
      resetForm();
      setHint(editingId ? '공지 내용이 수정되었습니다.' : '공지 내용이 등록되었습니다.', 'ok');
    } catch {
      setHint('저장에 실패했습니다.', 'error');
    }
  };

  const handleRowAction = async (action, id, pinned) => {
    if (!canEdit) return;
    if (action === 'edit') {
      try {
        const res = await fetchJson(API(`/api/notices_view.php?id=${id}&no_view=1`));
        if (!res?.ok) throw new Error('not_found');
        const item = res.item || {};
        editingId = item.id;
        titleInput.value = item.title || '';
        categoryInput.value = item.category || 'notice';
        dateInput.value = item.date || '';
        summaryInput.value = item.summary || '';
        if (editor) editor.innerHTML = item.content || '';
        if (contentInput) contentInput.value = item.content || '';
        if (pinnedInput) pinnedInput.checked = !!item.is_pinned;
        attachments = Array.isArray(item.attachments) ? item.attachments : [];
        renderAttachments();
        const saveBtn = document.getElementById('noticeSave');
        if (saveBtn) saveBtn.textContent = '수정 저장';
        setHint('수정할 내용을 변경 후 저장하세요.', '');
      } catch {
        setHint('공지 정보를 불러오지 못했습니다.', 'error');
      }
    }
    if (action === 'pin') {
      try {
        const nextPinned = pinned !== '1';
        const res = await fetchJson(API('/api/notices_pin.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_pinned: nextPinned ? 1 : 0 }),
        });
        if (!res?.ok) throw new Error('pin_failed');
        await loadList();
        setHint(nextPinned ? '공지 고정을 설정했습니다.' : '공지 고정을 해제했습니다.', 'ok');
      } catch {
        setHint('고정 처리에 실패했습니다.', 'error');
      }
    }
    if (action === 'delete') {
      if (!confirm('해당 공지를 삭제할까요?')) return;
      try {
        const res = await fetchJson(API('/api/notices_delete.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res?.ok) throw new Error('delete_failed');
        await loadList();
        resetForm();
        setHint('공지 내용이 삭제되었습니다.', 'ok');
      } catch {
        setHint('삭제에 실패했습니다.', 'error');
      }
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!canEdit) {
      setHint('MASTER 등급만 작성/수정할 수 있습니다.', 'error');
      return;
    }
    const title = (titleInput.value || '').trim();
    const category = (categoryInput.value || 'notice').trim();
    const date = (dateInput.value || '').trim();
    const summary = (summaryInput.value || '').trim();
    const content = editor ? editor.innerHTML.trim() : (contentInput?.value || '').trim();
    const isPinned = !!pinnedInput?.checked;
    if (!title || !date) {
      setHint('제목과 날짜는 필수입니다.', 'error');
      return;
    }
    upsert({ id: editingId || undefined, title, category, date, summary, content, is_pinned: isPinned ? 1 : 0, attachments });
  });

  resetBtn?.addEventListener('click', () => resetForm());
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    handleRowAction(btn.dataset.action, btn.dataset.id, btn.dataset.pinned);
  });

  toolbar?.addEventListener('click', (e) => {
    if (!canEdit) return;
    const btn = e.target.closest('button');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmd) {
      document.execCommand(cmd, false, null);
      editor?.focus();
      return;
    }
    if (btn.dataset.action === 'link') {
      const url = prompt('링크 주소를 입력하세요 (https://)');
      if (!url) return;
      document.execCommand('createLink', false, url);
      editor?.focus();
    }
  });

  uploadBtn?.addEventListener('click', async () => {
    if (!canEdit) return;
    if (!filesInput || !filesInput.files || filesInput.files.length === 0) return;
    const fd = new FormData();
    Array.from(filesInput.files).forEach((file, idx) => {
      fd.append(`file_${idx}`, file);
    });
    try {
      const res = await fetch(API('/api/notices_upload.php'), { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload_failed');
      const data = await res.json();
      const uploaded = Array.isArray(data.files) ? data.files : [];
      attachments = attachments.concat(uploaded.map(f => ({
        name: f.name || '',
        url: f.url || '',
        size: f.size || 0,
        type: f.type || '',
      })));
      renderAttachments();
      filesInput.value = '';
      setHint('첨부파일이 업로드되었습니다.', 'ok');
    } catch {
      setHint('첨부파일 업로드에 실패했습니다.', 'error');
    }
  });

  attachmentsEl?.addEventListener('click', (e) => {
    if (!canEdit) return;
    const btn = e.target.closest('button[data-attachment-index]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.attachmentIndex, 10);
    if (Number.isNaN(idx)) return;
    attachments.splice(idx, 1);
    renderAttachments();
  });

  if (!dateInput.value) {
    const today = new Date();
    dateInput.value = today.toISOString().slice(0, 10);
  }
  if (!canEdit) {
    alert('MASTER 등급만 공지 관리 페이지에 접근할 수 있습니다.');
    window.location.replace('/pages/notices.html');
    return;
  }
  loadList();
})();
