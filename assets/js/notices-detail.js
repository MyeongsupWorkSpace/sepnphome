(function initNoticeDetail(){
  const titleEl = document.getElementById('detailTitle');
  if (!titleEl) return;
  const badgeEl = document.getElementById('detailBadge');
  const dateEl = document.getElementById('detailDate');
  const viewsEl = document.getElementById('detailViews');
  const summaryEl = document.getElementById('detailSummary');
  const contentEl = document.getElementById('detailContent');
  const attachmentsEl = document.getElementById('detailAttachments');
  const API = window.API || ((p) => p);

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) {
    titleEl.textContent = '공지 정보를 찾을 수 없습니다.';
    return;
  }

  const renderContent = (text) => {
    const safe = (text || '').toString().trim();
    if (!safe) return '';
    return safe.split('\n').map(line => `<p>${line}</p>`).join('');
  };

  const load = async () => {
    try {
      const res = await fetch(API(`/api/notices_view.php?id=${id}`));
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (!data?.ok) throw new Error('not_found');
      const item = data.item || {};
      titleEl.textContent = item.title || '공지 제목';
      if (badgeEl) {
        badgeEl.textContent = item.category === 'company' ? '소식' : '공지';
        badgeEl.className = `news-badge${item.category === 'company' ? ' badge-news' : ''}`;
      }
      if (dateEl) dateEl.textContent = item.date ? item.date.replace(/-/g, '.') : '-';
      if (viewsEl) viewsEl.textContent = `조회 ${item.views || 0}`;
      if (summaryEl) summaryEl.textContent = item.summary || '';
      if (contentEl) contentEl.innerHTML = renderContent(item.content || '');
      if (attachmentsEl) {
        const files = Array.isArray(item.attachments) ? item.attachments : [];
        if (!files.length) {
          attachmentsEl.textContent = '';
        } else {
          attachmentsEl.innerHTML = `
            <div class="notice-attachments-title">첨부파일</div>
            <ul class="notice-attachments-list">
              ${files.map(f => `
                <li>
                  <a href="${f.url || '#'}" target="_blank" rel="noopener">${f.name || '첨부파일'}</a>
                  <span>${f.size ? Math.round(f.size / 1024) + 'KB' : ''}</span>
                </li>
              `).join('')}
            </ul>
          `;
        }
      }
    } catch {
      titleEl.textContent = '공지 정보를 불러오지 못했습니다.';
      if (contentEl) contentEl.textContent = '잠시 후 다시 시도해 주세요.';
    }
  };

  load();
})();
