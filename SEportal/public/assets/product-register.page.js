(function fileUploadModule() {
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.getElementById('fileUploadArea');
  const fileList = document.getElementById('fileList');
  let uploadedFiles = [];

  uploadArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', function (e) {
    handleFiles(Array.from(e.target.files));
  });

  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  function handleFiles(files) {
    files.forEach((file) => {
      if (!uploadedFiles.find((f) => f.name === file.name && f.size === file.size)) {
        uploadedFiles.push(file);
      }
    });
    renderFileList();
  }

  function renderFileList() {
    if (uploadedFiles.length === 0) {
      fileList.innerHTML = '';
      return;
    }

    fileList.innerHTML = uploadedFiles
      .map(
        (file, index) => `
        <div class="file-item">
          <span class="file-item-name">${file.name} (${formatFileSize(file.size)})</span>
          <span class="file-item-remove" data-index="${index}">×</span>
        </div>
      `
      )
      .join('');

    fileList.querySelectorAll('.file-item-remove').forEach((btn) => {
      btn.addEventListener('click', function () {
        const index = parseInt(this.dataset.index);
        uploadedFiles.splice(index, 1);
        renderFileList();
      });
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  window.getUploadedFiles = () => uploadedFiles;
})();

(function processModule() {
  const processCheckboxes = document.querySelectorAll('input[name="process"]');
  const detailArea = document.getElementById('processDetailArea');
  const summaryList = document.getElementById('processSummary');
  const noLaminateCheckbox = document.getElementById('noLaminate');
  const btnRegisterProcess = document.getElementById('btnRegisterProcess');

  let autoProcesses = new Set();
  let registeredProcesses = new Map();

  const processOrder = ['인쇄', '코팅', '금박', '형압', '합지', '톰슨', '접착'];

  const processTemplates = {
    인쇄: `
        <div class="form-row">
          <label>면 선택</label>
          <div class="field radio-group">
            <label>
              <input type="radio" name="인쇄_면" value="전면" checked>
              <span>전면</span>
            </label>
            <label>
              <input type="radio" name="인쇄_면" value="후면">
              <span>후면</span>
            </label>
          </div>
        </div>
        <div class="form-row">
          <label>인쇄 종류</label>
          <div class="field">
            <select class="sel" name="인쇄_종류" id="printType">
              <option value="">선택</option>
              <option value="옵셋인쇄" selected>옵셋인쇄</option>
              <option value="UV인쇄">UV인쇄</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
        <div class="form-row" id="printEtcRow" style="display:none">
          <label>기타 내용</label>
          <div class="field">
            <input class="inp" name="인쇄_기타" placeholder="기타 인쇄 종류 입력">
          </div>
        </div>
        <div class="form-row">
          <label>기본인쇄도수</label>
          <div class="field">
            <select class="sel" name="인쇄_기본도수" style="width:100px">
              <option value="0">0도</option>
              <option value="1">1도</option>
              <option value="2">2도</option>
              <option value="3">3도</option>
              <option value="4" selected>4도</option>
              <option value="5">5도</option>
              <option value="6">6도</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>별색인쇄도수</label>
          <div class="field">
            <select class="sel" name="인쇄_별색도수" style="width:100px">
              <option value="0" selected>0도</option>
              <option value="1">1도</option>
              <option value="2">2도</option>
              <option value="3">3도</option>
              <option value="4">4도</option>
              <option value="5">5도</option>
              <option value="6">6도</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>외주</label>
          <div class="field">
            <label style="display:flex;align-items:center;gap:6px">
              <input type="checkbox" name="인쇄_외주" id="printOutsource"> 외주 처리
            </label>
          </div>
        </div>
        <div class="form-row" id="printOutsourceRow" style="display:none">
          <label>외주 업체명</label>
          <div class="field">
            <input class="inp" name="인쇄_외주업체" placeholder="외주 업체명 입력">
          </div>
        </div>
      `,
    코팅: `
        <div class="form-row">
          <label>면 선택</label>
          <div class="field radio-group">
            <label>
              <input type="radio" name="코팅_면" value="전면" checked>
              <span>전면</span>
            </label>
            <label>
              <input type="radio" name="코팅_면" value="후면">
              <span>후면</span>
            </label>
          </div>
        </div>
        <div class="form-row">
          <label>종류</label>
          <div class="field">
            <select class="sel" name="코팅_종류" id="coatingType">
              <option value="">선택</option>
              <option value="무광CR">무광 CR</option>
              <option value="유광CR">유광 CR</option>
              <option value="무광라미">무광라미</option>
              <option value="유광라미">유광라미</option>
              <option value="실크">실크</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
        <div class="form-row" id="coatingEtcRow" style="display:none">
          <label>기타 내용</label>
          <div class="field">
            <input class="inp" name="코팅_기타" placeholder="기타 코팅 종류 입력">
          </div>
        </div>
        <div class="form-row" id="coatingSilkRow" style="display:none">
          <label>실크 크기</label>
          <div class="field dim-group">
            <div class="dim-input"><input class="inp" name="코팅_실크가로" type="number" placeholder="가로"><span class="unit">mm</span></div>
            <span>×</span>
            <div class="dim-input"><input class="inp" name="코팅_실크세로" type="number" placeholder="세로"><span class="unit">mm</span></div>
          </div>
        </div>
        <div class="form-row">
          <label>외주</label>
          <div class="field">
            <label style="display:flex;align-items:center;gap:6px">
              <input type="checkbox" name="코팅_외주" id="coatingOutsource"> 외주 처리
            </label>
          </div>
        </div>
        <div class="form-row" id="coatingOutsourceRow" style="display:none">
          <label>외주 업체명</label>
          <div class="field">
            <input class="inp" name="코팅_외주업체" placeholder="외주 업체명 입력">
          </div>
        </div>
      `,
    금박: `
        <div class="form-row">
          <label>색상</label>
          <div class="field"><input class="inp" name="금박_색상" placeholder="금색/은색 등"></div>
        </div>
        <div class="form-row">
          <label>면적</label>
          <div class="field"><input class="inp" name="금박_면적" placeholder="예: 50x50mm"></div>
        </div>
      `,
    형압: `
        <div class="form-row">
          <label>깊이</label>
          <div class="field"><input class="inp" name="형압_깊이" placeholder="예: 0.5mm"></div>
        </div>
      `,
    접착: `
        <div class="form-row">
          <label>접착 종류</label>
          <div class="field">
            <select class="sel" name="접착_종류" id="adhesiveType">
              <option value="">선택</option>
              <option value="1면접착">1면접착</option>
              <option value="2면접착">2면접착</option>
              <option value="3면접착">3면접착</option>
              <option value="4면접착">4면접착</option>
              <option value="5면접착">5면접착</option>
              <option value="6면접착">6면접착</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>창문접착</label>
          <div class="field">
            <label style="display:flex;align-items:center;gap:6px">
              <input type="checkbox" name="창문접착" id="windowAdhesive"> 창문접착 포함
            </label>
          </div>
        </div>
        <div class="form-row" id="windowSizeRow" style="display:none">
          <label>창문 크기</label>
          <div class="field dim-group">
            <div class="dim-input"><input class="inp" name="창문접착_가로" type="number" placeholder="가로"><span class="unit">mm</span></div>
            <span>×</span>
            <div class="dim-input"><input class="inp" name="창문접착_세로" type="number" placeholder="세로"><span class="unit">mm</span></div>
          </div>
        </div>
        <div class="form-row">
          <label>외주</label>
          <div class="field">
            <label style="display:flex;align-items:center;gap:6px">
              <input type="checkbox" name="접착_외주" id="adhesiveOutsource"> 외주 처리
            </label>
          </div>
        </div>
        <div class="form-row" id="adhesiveOutsourceRow" style="display:none">
          <label>외주 업체명</label>
          <div class="field">
            <input class="inp" name="접착_외주업체" placeholder="외주 업체명 입력">
          </div>
        </div>
      `
  };

  function updateProcessUI() {
    const selected = Array.from(processCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    const registeredProcessNames = new Set();
    registeredProcesses.forEach((dataArray, procName) => {
      registeredProcessNames.add(procName);
    });

    const allProcessNames = new Set([...selected, ...autoProcesses, ...registeredProcessNames]);

    if (allProcessNames.size === 0) {
      detailArea.style.display = 'none';
      detailArea.innerHTML = '';
      summaryList.innerHTML = '<li class="empty">선택된 공정이 없습니다</li>';
      return;
    }

    detailArea.style.display = 'block';
    detailArea.innerHTML = '';
    selected
      .filter((proc) => !autoProcesses.has(proc))
      .forEach((proc) => {
        const item = document.createElement('div');
        item.className = 'process-item';
        item.innerHTML = `
          <div class="process-item-title">${proc}</div>
          ${processTemplates[proc] || '<div class="form-row"><label>메모</label><div class="field"><input class="inp" placeholder="메모"></div></div>'}
        `;
        detailArea.appendChild(item);

        if (proc === '코팅') {
          const coatingSelect = item.querySelector('#coatingType');
          const etcRow = item.querySelector('#coatingEtcRow');
          const silkRow = item.querySelector('#coatingSilkRow');

          if (coatingSelect && etcRow && silkRow) {
            coatingSelect.addEventListener('change', function () {
              etcRow.style.display = this.value === '기타' ? 'flex' : 'none';
              silkRow.style.display = this.value === '실크' ? 'flex' : 'none';
            });
          }

          const coatingOutsource = item.querySelector('#coatingOutsource');
          const coatingOutsourceRow = item.querySelector('#coatingOutsourceRow');
          if (coatingOutsource && coatingOutsourceRow) {
            coatingOutsource.addEventListener('change', function () {
              coatingOutsourceRow.style.display = this.checked ? 'flex' : 'none';
            });
          }
        }

        if (proc === '인쇄') {
          const printSelect = item.querySelector('#printType');
          const etcRow = item.querySelector('#printEtcRow');
          if (printSelect && etcRow) {
            printSelect.addEventListener('change', function () {
              etcRow.style.display = this.value === '기타' ? 'flex' : 'none';
            });
          }

          const printOutsource = item.querySelector('#printOutsource');
          const printOutsourceRow = item.querySelector('#printOutsourceRow');
          if (printOutsource && printOutsourceRow) {
            printOutsource.addEventListener('change', function () {
              printOutsourceRow.style.display = this.checked ? 'flex' : 'none';
            });
          }
        }

        if (proc === '접착') {
          const windowAdhesive = item.querySelector('#windowAdhesive');
          const windowSizeRow = item.querySelector('#windowSizeRow');

          if (windowAdhesive && windowSizeRow) {
            windowAdhesive.addEventListener('change', function () {
              windowSizeRow.style.display = this.checked ? 'flex' : 'none';
            });
          }

          const adhesiveOutsource = item.querySelector('#adhesiveOutsource');
          const adhesiveOutsourceRow = item.querySelector('#adhesiveOutsourceRow');
          if (adhesiveOutsource && adhesiveOutsourceRow) {
            adhesiveOutsource.addEventListener('change', function () {
              adhesiveOutsourceRow.style.display = this.checked ? 'flex' : 'none';
            });
          }
        }
      });

    const sortedProcesses = processOrder.filter((p) => allProcessNames.has(p));

    summaryList.innerHTML = sortedProcesses
      .map((processName) => {
        let displayItems = [];

        if (registeredProcesses.has(processName)) {
          const dataArray = registeredProcesses.get(processName);
          dataArray.forEach((data) => {
            let displayText = `<strong>${processName}</strong>`;
            if (data.side) displayText += ` (${data.side})`;
            if (data.details && data.details.length > 0) {
              displayText += ` - ${data.details.join(', ')}`;
            }
            displayItems.push({
              text: displayText,
              style: 'background:#dcfce7;border-color:#bbf7d0',
              side: data.side
            });
          });
        } else {
          displayItems.push({
            text: `<strong>${processName}</strong>`,
            style: '',
            side: null
          });
        }

        return displayItems
          .map(
            (item, idx) =>
              `<li data-process="${processName}" data-index="${idx}"${item.style ? ` style="${item.style}"` : ''}>${item.text}</li>`
          )
          .join('');
      })
      .join('');

    summaryList.querySelectorAll('li[data-process]').forEach((li) => {
      li.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const process = this.dataset.process;
        const index = parseInt(this.dataset.index);

        if (registeredProcesses.has(process)) {
          const dataArray = registeredProcesses.get(process);
          if (dataArray.length > 1) {
            if (confirm(`"${process}" 공정의 해당 항목을 삭제하시겠습니까?`)) {
              dataArray.splice(index, 1);
              if (dataArray.length === 0) {
                registeredProcesses.delete(process);
              }
              updateProcessUI();
            }
          } else {
            if (confirm(`"${process}" 공정을 삭제하시겠습니까?`)) {
              registeredProcesses.delete(process);
              autoProcesses.delete(process);
              processCheckboxes.forEach((cb) => {
                if (cb.value === process) cb.checked = false;
              });
              if (process === '합지' && noLaminateCheckbox) {
                noLaminateCheckbox.checked = true;
              }
              updateProcessUI();
            }
          }
        } else {
          if (confirm(`"${process}" 공정을 삭제하시겠습니까?`)) {
            autoProcesses.delete(process);
            registeredProcesses.delete(process);
            processCheckboxes.forEach((cb) => {
              if (cb.value === process) cb.checked = false;
            });
            if (process === '합지' && noLaminateCheckbox) {
              noLaminateCheckbox.checked = true;
            }
            updateProcessUI();
          }
        }
      });

      li.style.cursor = 'context-menu';
      li.title = '우클릭하여 삭제';
    });
  }

  btnRegisterProcess.addEventListener('click', function () {
    const selected = Array.from(processCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (selected.length === 0) {
      alert('등록할 공정을 선택해주세요.');
      return;
    }

    let validationError = false;

    selected.forEach((proc) => {
      const processData = { name: proc, details: [], side: null };

      const processItem = detailArea.querySelector(`.process-item`);
      if (processItem) {
        if (proc === '인쇄') {
          const side = processItem.querySelector('input[name="인쇄_면"]:checked')?.value;
          const printType = processItem.querySelector('#printType')?.value;
          const printEtc = processItem.querySelector('input[name="인쇄_기타"]')?.value;
          const basicDegree = parseInt(processItem.querySelector('select[name="인쇄_기본도수"]')?.value) || 0;
          const specialDegree = parseInt(processItem.querySelector('select[name="인쇄_별색도수"]')?.value) || 0;
          const outsource = processItem.querySelector('#printOutsource')?.checked;
          const outsourceCompany = processItem.querySelector('input[name="인쇄_외주업체"]')?.value;

          const totalDegree = basicDegree + specialDegree;
          if (totalDegree > 6) {
            alert(
              `인쇄 도수는 6도를 초과할 수 없습니다.\n현재: 기본 ${basicDegree}도 + 별색 ${specialDegree}도 = 총 ${totalDegree}도\n6도 이하로 조정해주세요.`
            );
            validationError = true;
            return;
          }

          processData.side = side;
          if (printType) processData.details.push(printType === '기타' && printEtc ? printEtc : printType);
          if (basicDegree !== 0) processData.details.push(`원색 ${basicDegree}도`);
          if (specialDegree !== 0) processData.details.push(`별색 ${specialDegree}도`);
          if (outsource && outsourceCompany) processData.details.push(`외주: ${outsourceCompany}`);
          else if (outsource) processData.details.push('외주');
        } else if (proc === '코팅') {
          const side = processItem.querySelector('input[name="코팅_면"]:checked')?.value;
          const coatingType = processItem.querySelector('#coatingType')?.value;
          const coatingEtc = processItem.querySelector('input[name="코팅_기타"]')?.value;
          const silkW = processItem.querySelector('input[name="코팅_실크가로"]')?.value;
          const silkH = processItem.querySelector('input[name="코팅_실크세로"]')?.value;
          const outsource = processItem.querySelector('#coatingOutsource')?.checked;
          const outsourceCompany = processItem.querySelector('input[name="코팅_외주업체"]')?.value;

          processData.side = side;
          if (coatingType) {
            if (coatingType === '기타' && coatingEtc) {
              processData.details.push(coatingEtc);
            } else if (coatingType === '실크' && silkW && silkH) {
              processData.details.push(`실크 ${silkW}×${silkH}mm`);
            } else {
              processData.details.push(coatingType);
            }
          }
          if (outsource && outsourceCompany) processData.details.push(`외주: ${outsourceCompany}`);
          else if (outsource) processData.details.push('외주');
        } else if (proc === '금박') {
          const color = processItem.querySelector('input[name="금박_색상"]')?.value;
          const area = processItem.querySelector('input[name="금박_면적"]')?.value;

          if (color) processData.details.push(color);
          if (area) processData.details.push(area);
        } else if (proc === '형압') {
          const depth = processItem.querySelector('input[name="형압_깊이"]')?.value;
          if (depth) processData.details.push(depth);
        } else if (proc === '접착') {
          const adhesiveType = processItem.querySelector('#adhesiveType')?.value;
          const windowCheck = processItem.querySelector('#windowAdhesive')?.checked;
          const windowW = processItem.querySelector('input[name="창문접착_가로"]')?.value;
          const windowH = processItem.querySelector('input[name="창문접착_세로"]')?.value;
          const outsource = processItem.querySelector('#adhesiveOutsource')?.checked;
          const outsourceCompany = processItem.querySelector('input[name="접착_외주업체"]')?.value;

          if (adhesiveType) processData.details.push(adhesiveType);
          if (windowCheck && windowW && windowH) processData.details.push(`창문 ${windowW}×${windowH}mm`);
          else if (windowCheck) processData.details.push('창문접착');
          if (outsource && outsourceCompany) processData.details.push(`외주: ${outsourceCompany}`);
          else if (outsource) processData.details.push('외주');
        }
      }

      if (!validationError) {
        if (!registeredProcesses.has(proc)) {
          registeredProcesses.set(proc, []);
        }
        registeredProcesses.get(proc).push(processData);
      }
    });

    if (validationError) {
      return;
    }

    processCheckboxes.forEach((cb) => {
      cb.checked = false;
    });

    alert('공정이 등록되었습니다.');
    updateProcessUI();
  });

  if (noLaminateCheckbox) {
    noLaminateCheckbox.addEventListener('change', function () {
      if (this.checked) {
        autoProcesses.delete('합지');
        registeredProcesses.delete('합지');
      } else {
        autoProcesses.add('합지');
      }
      updateProcessUI();
    });
  }

  processCheckboxes.forEach((cb) => {
    cb.addEventListener('change', function () {
      const value = this.value;

      if (value === '합지' || value === '톰슨') {
        if (this.checked) {
          const details = value === '톰슨' ? ['일반'] : [];
          registeredProcesses.set(value, [{ name: value, details }]);
          this.checked = false;
          alert(`${value} 공정이 등록되었습니다.`);
          updateProcessUI();
        }
        return;
      }

      if (this.checked) {
        processCheckboxes.forEach((other) => {
          if (other !== this) other.checked = false;
        });
      }
      updateProcessUI();
    });
  });

  window.getProcessPayload = function () {
    const selected = Array.from(processCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
    const names = new Set([...autoProcesses, ...selected]);
    registeredProcesses.forEach((dataArray, procName) => {
      names.add(procName);
    });
    const ordered = processOrder.filter((p) => names.has(p));
    const details = {};
    registeredProcesses.forEach((dataArray, procName) => {
      details[procName] = dataArray;
    });
    return { processes: ordered, processDetails: details };
  };

  window.setProcessPayload = function (payload) {
    const list = Array.isArray(payload?.processes) ? payload.processes : [];
    const details = payload?.processDetails && typeof payload.processDetails === 'object' ? payload.processDetails : {};
    registeredProcesses = new Map();
    autoProcesses = new Set();

    list.forEach((proc) => {
      const dataArray = Array.isArray(details[proc]) && details[proc].length ? details[proc] : [{ name: proc, details: [] }];
      registeredProcesses.set(proc, dataArray);
    });

    updateProcessUI();
  };

  updateProcessUI();
})();
