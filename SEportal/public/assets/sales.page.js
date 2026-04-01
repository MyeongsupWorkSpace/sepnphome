PortalStore.hydrate(['sepnp_dispatches']).then(() => {
  const KEY_DISPATCH = 'sepnp_dispatches';
  const $ = (s) => document.querySelector(s);
  const fmtNum = (v) => Number(v || 0).toLocaleString();

  let allData = [];
  let filteredData = [];
  let currentTab = 'chart';

  function loadData() {
    allData = JSON.parse(localStorage.getItem(KEY_DISPATCH) || '[]');

    const products = [...new Set(allData.map((d) => d.productName))];
    $('#filterProduct').innerHTML = '<option value="">전체 제품</option>' + products.map((p) => `<option value="${p}">${p}</option>`).join('');

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);

    $('#dateTo').value = to.toISOString().slice(0, 10);
    $('#dateFrom').value = from.toISOString().slice(0, 10);

    applyFilter();
  }

  function applyFilter() {
    const from = $('#dateFrom').value;
    const to = $('#dateTo').value;
    const status = $('#filterStatus').value;
    const product = $('#filterProduct').value;

    filteredData = allData.filter((d) => {
      const matchDate = (!from || d.date >= from) && (!to || d.date <= to);
      const matchStatus = !status || d.status === status;
      const matchProduct = !product || d.productName === product;
      return matchDate && matchStatus && matchProduct;
    });

    updateStats();
    updateCharts();
    updateTables();
  }

  function resetFilter() {
    $('#filterStatus').value = '';
    $('#filterProduct').value = '';
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    $('#dateTo').value = to.toISOString().slice(0, 10);
    $('#dateFrom').value = from.toISOString().slice(0, 10);
    applyFilter();
  }

  function updateStats() {
    const total = filteredData.length;
    const done = filteredData.filter((d) => d.status === 'done').length;
    const progress = filteredData.filter((d) => d.status === 'progress').length;
    const totalQty = filteredData.reduce((sum, d) => sum + (d.qty || 0), 0);

    $('#statTotalCount').textContent = fmtNum(total);
    $('#statTotalSub').textContent = `완료: ${fmtNum(done)} | 진행: ${fmtNum(progress)}`;
    $('#statTotalQty').textContent = fmtNum(totalQty);

    const months = new Set(filteredData.map((d) => d.date.slice(0, 7))).size || 1;
    const monthlyAvg = Math.round(total / months);
    $('#statMonthlyAvg').textContent = fmtNum(monthlyAvg);
    $('#statMonthlySub').textContent = `${months}개월 기준`;

    const customerCounts = {};
    filteredData.forEach((d) => {
      if (d.customer) customerCounts[d.customer] = (customerCounts[d.customer] || 0) + 1;
    });
    const topCustomer = Object.entries(customerCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCustomer) {
      $('#statTopCustomer').textContent = topCustomer[0];
      $('#statTopCustomerSub').textContent = `${fmtNum(topCustomer[1])}건`;
    } else {
      $('#statTopCustomer').textContent = '-';
      $('#statTopCustomerSub').textContent = '데이터 없음';
    }
  }

  function updateCharts() {
    drawDailyChart();
    drawProductChart();
    drawStatusChart();
    drawCustomerChart();
  }

  function updateTables() {
    updateDetailTable();
    updateProductTable();
    updateCustomerTable();
  }

  function drawDailyChart() {
    const canvas = $('#dailyChart');
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);

    ctx.clearRect(0, 0, w, h);

    const dailyData = {};
    filteredData.forEach((d) => {
      dailyData[d.date] = (dailyData[d.date] || 0) + 1;
    });

    const dates = Object.keys(dailyData).sort();
    if (dates.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('데이터가 없습니다', w / 2, h / 2);
      return;
    }

    const values = dates.map((d) => dailyData[d]);
    const max = Math.max(...values);
    const padding = 40;
    const barWidth = (w - padding * 2) / dates.length;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + ((h - padding * 2) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }

    values.forEach((val, i) => {
      const barHeight = ((h - padding * 2) * val) / max;
      const x = padding + i * barWidth;
      const y = h - padding - barHeight;

      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);

      ctx.fillStyle = '#111';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val, x + barWidth / 2, y - 5);

      if (dates.length < 15 || i % Math.ceil(dates.length / 10) === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px sans-serif';
        ctx.save();
        ctx.translate(x + barWidth / 2, h - padding + 15);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(dates[i].slice(5), 0, 0);
        ctx.restore();
      }
    });
  }

  function drawProductChart() {
    const canvas = $('#productChart');
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);

    ctx.clearRect(0, 0, w, h);

    const productData = {};
    filteredData.forEach((d) => {
      productData[d.productName] = (productData[d.productName] || 0) + (d.qty || 0);
    });

    const products = Object.entries(productData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (products.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('데이터가 없습니다', w / 2, h / 2);
      return;
    }

    const total = products.reduce((sum, p) => sum + p[1], 0);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    let startAngle = -Math.PI / 2;
    const centerX = w / 2;
    const centerY = h / 2 - 20;
    const radius = Math.min(w, h) / 3;

    products.forEach(([name, qty], i) => {
      const sliceAngle = (qty / total) * Math.PI * 2;

      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      const midAngle = startAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(midAngle) * (radius + 30);
      const labelY = centerY + Math.sin(midAngle) * (radius + 30);

      ctx.fillStyle = '#111';
      ctx.font = '11px sans-serif';
      ctx.textAlign = labelX > centerX ? 'left' : 'right';
      ctx.fillText(`${name}`, labelX, labelY);
      ctx.fillText(`${((qty / total) * 100).toFixed(1)}%`, labelX, labelY + 12);

      startAngle += sliceAngle;
    });
  }

  function drawStatusChart() {
    const canvas = $('#statusChart');
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);

    ctx.clearRect(0, 0, w, h);

    const done = filteredData.filter((d) => d.status === 'done').length;
    const progress = filteredData.filter((d) => d.status === 'progress').length;
    const cancel = filteredData.filter((d) => d.status === 'cancel').length;
    const wait = filteredData.filter((d) => d.status === 'wait').length;

    const data = [
      { label: '완료', value: done, color: '#10b981' },
      { label: '진행중', value: progress, color: '#3b82f6' },
      { label: '대기', value: wait, color: '#f59e0b' },
      { label: '취소', value: cancel, color: '#ef4444' }
    ].filter((d) => d.value > 0);

    if (data.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('데이터가 없습니다', w / 2, h / 2);
      return;
    }

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const barHeight = 40;
    const startY = (h - data.length * (barHeight + 10)) / 2;

    data.forEach((item, i) => {
      const barWidth = (w - 160) * (item.value / total);
      const y = startY + i * (barHeight + 10);

      ctx.fillStyle = item.color;
      ctx.fillRect(80, y, barWidth, barHeight);

      ctx.fillStyle = '#111';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.label, 70, y + barHeight / 2 + 5);

      ctx.textAlign = 'left';
      ctx.fillText(`${item.value}건 (${((item.value / total) * 100).toFixed(1)}%)`, 85 + barWidth, y + barHeight / 2 + 5);
    });
  }

  function drawCustomerChart() {
    const canvas = $('#customerChart');
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);

    ctx.clearRect(0, 0, w, h);

    const customerData = {};
    filteredData.forEach((d) => {
      if (d.customer) customerData[d.customer] = (customerData[d.customer] || 0) + 1;
    });

    const customers = Object.entries(customerData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (customers.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('데이터가 없습니다', w / 2, h / 2);
      return;
    }

    const max = Math.max(...customers.map((c) => c[1]));
    const padding = 40;
    const barHeight = (h - padding * 2) / customers.length;

    customers.forEach(([name, count], i) => {
      const barWidth = (w - padding - 120) * (count / max);
      const y = padding + i * barHeight;

      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(120, y + 5, barWidth, barHeight - 10);

      ctx.fillStyle = '#111';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(name.length > 10 ? name.slice(0, 10) + '...' : name, 115, y + barHeight / 2 + 4);

      ctx.textAlign = 'left';
      ctx.fillText(`${count}건`, 125 + barWidth, y + barHeight / 2 + 4);
    });
  }

  function updateDetailTable() {
    const tbody = $('#detailTableBody');
    if (filteredData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="padding:40px;color:#6b7280">데이터가 없습니다</td></tr>';
      return;
    }

    tbody.innerHTML = filteredData
      .map(
        (d) => `
        <tr>
          <td>${d.date}</td>
          <td class="align-left">${d.productName}</td>
          <td>${d.spec || '-'}</td>
          <td class="align-left">${d.customer || '-'}</td>
          <td class="align-left">${d.dest || '-'}</td>
          <td class="align-right">${fmtNum(d.qty)}${d.unit || ''}</td>
          <td>${d.vehicle || '-'}</td>
          <td>${d.driver || '-'}</td>
          <td><span class="badge ${d.status}">${getStatusLabel(d.status)}</span></td>
        </tr>
      `
      )
      .join('');
  }

  function updateProductTable() {
    const tbody = $('#productTableBody');

    const productStats = {};
    filteredData.forEach((d) => {
      if (!productStats[d.productName]) {
        productStats[d.productName] = {
          spec: d.spec,
          total: 0,
          done: 0,
          progress: 0,
          cancel: 0,
          count: 0
        };
      }
      const stat = productStats[d.productName];
      stat.total += d.qty || 0;
      stat.count++;
      if (d.status === 'done') stat.done += d.qty || 0;
      else if (d.status === 'progress') stat.progress += d.qty || 0;
      else if (d.status === 'cancel') stat.cancel += d.qty || 0;
    });

    const products = Object.entries(productStats).sort((a, b) => b[1].total - a[1].total);

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;color:#6b7280">데이터가 없습니다</td></tr>';
      return;
    }

    tbody.innerHTML = products
      .map(
        ([name, stat]) => `
        <tr>
          <td class="align-left">${name}</td>
          <td>${stat.spec || '-'}</td>
          <td class="align-right"><strong>${fmtNum(stat.total)}</strong></td>
          <td class="align-right">${fmtNum(stat.done)}</td>
          <td class="align-right">${fmtNum(stat.progress)}</td>
          <td class="align-right">${fmtNum(stat.cancel)}</td>
          <td class="align-right">${fmtNum(Math.round(stat.total / stat.count))}</td>
        </tr>
      `
      )
      .join('');
  }

  function updateCustomerTable() {
    const tbody = $('#customerTableBody');

    const customerStats = {};
    filteredData.forEach((d) => {
      if (!d.customer) return;
      if (!customerStats[d.customer]) {
        customerStats[d.customer] = {
          count: 0,
          qty: 0,
          products: {},
          lastDate: d.date
        };
      }
      const stat = customerStats[d.customer];
      stat.count++;
      stat.qty += d.qty || 0;
      stat.products[d.productName] = (stat.products[d.productName] || 0) + 1;
      if (d.date > stat.lastDate) stat.lastDate = d.date;
    });

    const customers = Object.entries(customerStats).sort((a, b) => b[1].count - a[1].count);

    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:40px;color:#6b7280">데이터가 없습니다</td></tr>';
      return;
    }

    tbody.innerHTML = customers
      .map(([name, stat]) => {
        const topProduct = Object.entries(stat.products).sort((a, b) => b[1] - a[1])[0];
        return `
          <tr>
            <td class="align-left"><strong>${name}</strong></td>
            <td class="align-right">${fmtNum(stat.count)}</td>
            <td class="align-right">${fmtNum(stat.qty)}</td>
            <td class="align-left">${topProduct[0]} (${topProduct[1]}건)</td>
            <td>${stat.lastDate}</td>
          </tr>
        `;
      })
      .join('');
  }

  function getStatusLabel(status) {
    const labels = {
      wait: '대기',
      progress: '진행중',
      done: '완료',
      cancel: '취소'
    };
    return labels[status] || status;
  }

  function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    const clickedTab = Array.from(document.querySelectorAll('.tab')).find((t) =>
      t.textContent.includes(tab === 'chart' ? '차트' : tab === 'table' ? '상세' : tab === 'product' ? '제품별' : '거래처별')
    );
    if (clickedTab) clickedTab.classList.add('active');

    document.querySelectorAll('.tab-content').forEach((c) => (c.style.display = 'none'));
    $(`#${tab}Tab`).style.display = 'block';
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!Permissions.has('sales.view')) {
      alert('매출현황을 볼 권한이 없습니다.');
      try {
        window.location.href = 'employee.html';
      } catch (e) {}
      return;
    }
    Permissions.applyGates();
    loadData();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (currentTab === 'chart') updateCharts();
      }, 250);
    });
  });
});
