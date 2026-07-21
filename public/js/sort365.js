// Global State
let parsedYears = {}; // Stores year -> { rows: [{ date: 1, Jan: 21, ... }], isLeap: boolean }
let selectedYear = null;
let selectedMonth = 'ALL';
let currentTab = 'chart';
let isPanelCollapsed = false;
let designatedWinnerName = null; // Secret single winner set chosen during Load
let designatedWinnerObj = null;

const MONTH_DAYS_NORMAL = [
  { name: 'Jan', days: 31 },
  { name: 'Feb', days: 28 },
  { name: 'Mar', days: 31 },
  { name: 'Apr', days: 30 },
  { name: 'May', days: 31 },
  { name: 'Jun', days: 30 },
  { name: 'Jul', days: 31 },
  { name: 'Aug', days: 31 },
  { name: 'Sep', days: 30 },
  { name: 'Oct', days: 31 },
  { name: 'Nov', days: 30 },
  { name: 'Dec', days: 31 }
];

const MONTH_DAYS_LEAP = [
  { name: 'Jan', days: 31 },
  { name: 'Feb', days: 29 },
  { name: 'Mar', days: 31 },
  { name: 'Apr', days: 30 },
  { name: 'May', days: 31 },
  { name: 'Jun', days: 30 },
  { name: 'Jul', days: 31 },
  { name: 'Aug', days: 31 },
  { name: 'Sep', days: 30 },
  { name: 'Oct', days: 31 },
  { name: 'Nov', days: 30 },
  { name: 'Dec', days: 31 }
];

const MONTHS_ARRAY = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Helper: Check if year is a leap year
function isLeapYear(year) {
  const y = parseInt(year, 10);
  if (isNaN(y)) return false;
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

// Switch UI Tabs
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (tabName === 'chart') {
    document.getElementById('tabBtnChart').classList.add('active');
    document.getElementById('tabChart').classList.add('active');
  } else {
    document.getElementById('tabBtnResults').classList.add('active');
    document.getElementById('tabResults').classList.add('active');
  }
}

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const fileUpload = document.getElementById('fileUpload');
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const btnLoadPredict = document.getElementById('btnLoadPredict');
  const btnAddData = document.getElementById('btnAddData');
  const btnSearch = document.getElementById('btnSearch');
  const btnReset = document.getElementById('btnReset');
  const btnTogglePanel = document.getElementById('btnTogglePanel');

  fileUpload.addEventListener('change', handleFileUpload);
  yearSelect.addEventListener('change', handleYearChange);
  monthSelect.addEventListener('change', handleMonthChange);
  btnLoadPredict.addEventListener('click', handleLoadAndPredictWinner);
  btnAddData.addEventListener('click', handleAddData);
  btnSearch.addEventListener('click', runPatternSearch);
  btnReset.addEventListener('click', resetAllInputs);
  
  if (btnTogglePanel) {
    btnTogglePanel.addEventListener('click', toggleLeftPanel);
  }
});

// Toggle Left Panel (Collapse / Expand UI)
function toggleLeftPanel() {
  const mainContainer = document.getElementById('mainContainer');
  const leftPanel = document.getElementById('leftPanel');
  const btnTogglePanel = document.getElementById('btnTogglePanel');

  isPanelCollapsed = !isPanelCollapsed;

  if (isPanelCollapsed) {
    mainContainer.classList.add('collapsed');
    leftPanel.classList.add('collapsed');
    btnTogglePanel.textContent = '▶ Expand';
  } else {
    mainContainer.classList.remove('collapsed');
    leftPanel.classList.remove('collapsed');
    btnTogglePanel.textContent = '◀ Collapse';
  }
}

// Toggle Individual Month Section (Collapse / Expand Month Grid)
function toggleMonthSection(monthName) {
  const grid = document.getElementById(`grid_${monthName}`);
  const btn = document.getElementById(`toggle_btn_${monthName}`);
  if (!grid || !btn) return;

  if (grid.style.display === 'none') {
    grid.style.display = 'grid';
    btn.textContent = '▼ Collapse';
  } else {
    grid.style.display = 'none';
    btn.textContent = '▲ Expand';
  }
}

// Handle File Upload
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('fileNameLabel').textContent = `📄 ${file.name}`;
  const reader = new FileReader();

  reader.onload = function (event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      parseExcelSheet(sheet);
    } catch (err) {
      console.error('Error parsing excel:', err);
      alert('Failed to parse Excel file. Please check file format.');
    }
  };

  reader.readAsArrayBuffer(file);
}

// Parse Excel Sheet with Dynamic Header Column Detection
function parseExcelSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  parsedYears = {};

  let currentYear = null;
  let headerRow = null;
  let yearRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const val = row[0];
    // Year Header row detection (e.g. 1966, 1986, 2021)
    if (typeof val === 'number' && val >= 1900 && val <= 2100) {
      if (currentYear !== null && yearRows.length > 0) {
        parsedYears[currentYear] = processYearRows(currentYear, yearRows, headerRow);
      }
      currentYear = val;
      headerRow = row;
      yearRows = [];
    } else if (currentYear !== null) {
      // Data row for current year
      if (typeof val === 'number' && val >= 1 && val <= 31) {
        yearRows.push(row);
      }
    }
  }

  // Save last year block
  if (currentYear !== null && yearRows.length > 0) {
    parsedYears[currentYear] = processYearRows(currentYear, yearRows, headerRow);
  }

  const availableYears = Object.keys(parsedYears).sort((a, b) => parseInt(a) - parseInt(b));

  if (availableYears.length === 0) {
    alert('No valid year data blocks found in Excel sheet.');
    return;
  }

  // Populate Select Dropdowns
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const btnLoadPredict = document.getElementById('btnLoadPredict');
  const btnAddData = document.getElementById('btnAddData');

  yearSelect.innerHTML = '';
  availableYears.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `Year ${y} ${isLeapYear(y) ? '(Leap Year)' : ''}`;
    yearSelect.appendChild(opt);
  });

  yearSelect.disabled = false;
  monthSelect.disabled = false;
  btnLoadPredict.disabled = false;
  btnAddData.disabled = false;
  document.getElementById('btnSearch').disabled = false;

  // Auto-select first year
  yearSelect.value = availableYears[0];
  selectedMonth = monthSelect.value || 'ALL';
  handleYearChange();
}

// Process Data Rows for a Single Year with robust positional month extraction
function processYearRows(year, rows, headerRow) {
  const matrix = [];
  const leap = isLeapYear(year);

  rows.forEach(r => {
    const dateNum = r[0];
    const rowData = { date: dateNum };

    // Collect all non-empty values after col 0 in left-to-right order for this row
    const nonEmpties = [];
    for (let c = 1; c < r.length; c++) {
      const val = r[c];
      if (val !== undefined && val !== null && val !== '') {
        nonEmpties.push(val);
      }
    }

    // Assign the 12 month values in sequence (1st = Jan, 2nd = Feb, ..., 12th = Dec)
    MONTHS_ARRAY.forEach((m, idx) => {
      let cellVal = nonEmpties[idx] !== undefined ? nonEmpties[idx] : 'XX';
      if (typeof cellVal === 'number' && cellVal < 10) {
        cellVal = '0' + cellVal;
      }
      rowData[m] = cellVal.toString();
    });

    matrix.push(rowData);
  });

  return {
    year: year,
    isLeap: leap,
    matrix: matrix
  };
}

// Handle Year Change Event (Renders blank inputs & chart matrix; does NOT auto-populate)
function handleYearChange() {
  const yearSelect = document.getElementById('yearSelect');
  selectedYear = yearSelect.value;
  if (!selectedYear || !parsedYears[selectedYear]) return;

  const yearData = parsedYears[selectedYear];
  const leap = yearData.isLeap;

  // Reset designated winner for new year
  designatedWinnerName = null;
  designatedWinnerObj = null;

  // Update Leap Indicator Badge
  const leapIndicator = document.getElementById('leapIndicator');
  const inputCountBadge = document.getElementById('inputCountBadge');

  if (leap) {
    leapIndicator.className = 'leap-badge leap';
    leapIndicator.innerHTML = '<span>⚡ Leap Year (366 Days)</span>';
    inputCountBadge.textContent = '366 Days';
  } else {
    leapIndicator.className = 'leap-badge normal';
    leapIndicator.innerHTML = '<span>📅 Normal Year (365 Days)</span>';
    inputCountBadge.textContent = '365 Days';
  }

  // Render Left Side Blank Input Boxes & Right Side Chart Matrix
  renderLeftInputs(leap);
  renderRightMatrix(yearData);

  // Reset Winner status banner until search is triggered
  updateWinnerSummary(null);
  document.getElementById('hostSecretBanner').style.display = 'none';
}

// Handle Month Change Event
function handleMonthChange() {
  const monthSelect = document.getElementById('monthSelect');
  selectedMonth = monthSelect.value || 'ALL';

  if (!selectedYear || !parsedYears[selectedYear]) return;

  // Scroll to selected month section if specific month selected
  if (selectedMonth !== 'ALL') {
    const monthSec = document.getElementById(`month_sec_${selectedMonth}`);
    if (monthSec) {
      monthSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// Handle Add/Import Data Button Click (Explicit Trigger to Import Excel Data into Inputs)
function handleAddData() {
  if (!selectedYear || !parsedYears[selectedYear]) {
    alert('Please upload an Excel file and select a Year first.');
    return;
  }

  const yearData = parsedYears[selectedYear];
  const leap = yearData.isLeap;
  const monthsConfig = leap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL;

  if (selectedMonth === 'ALL') {
    // Import ALL 12 months for the selected year
    monthsConfig.forEach(mConfig => {
      importMonthData(mConfig.name, yearData);
    });
    console.log(`Imported Full Year data for Year ${selectedYear}.`);
  } else {
    // Import ONLY the selected month for the selected year
    importMonthData(selectedMonth, yearData);
    console.log(`Imported ${selectedMonth} data for Year ${selectedYear}.`);

    // Scroll to the imported month section
    const monthSec = document.getElementById(`month_sec_${selectedMonth}`);
    if (monthSec) {
      monthSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// Handle Load & Predict Winner Button (Host Controls - Picks EXACT 1 RANDOM Winner & Sends Email/Console Notification)
function handleLoadAndPredictWinner() {
  if (!selectedYear || !parsedYears[selectedYear]) {
    alert('Please upload an Excel file and select a Year first.');
    return;
  }

  // Auto-import data if inputs are empty
  const yearData = parsedYears[selectedYear];
  const inputs = document.querySelectorAll('.day-input');
  let filledCount = 0;
  inputs.forEach(inp => { if (inp.value && inp.value.trim() !== '' && inp.value.trim() !== 'XX') filledCount++; });

  if (filledCount === 0) {
    handleAddData();
  }

  // Pre-calculate filled sequence
  const filledSequence = [];
  document.querySelectorAll('.day-input').forEach(inp => {
    if (inp.value && inp.value.trim() !== '' && inp.value.trim() !== 'XX') {
      filledSequence.push({
        month: inp.getAttribute('data-month'),
        day: parseInt(inp.getAttribute('data-day')),
        value: inp.value.trim()
      });
    }
  });

  const base4 = filledSequence.slice(0, 4);
  const sets = generate32Sets(base4);
  const matrix = yearData.matrix;

  // PICK ONE SINGLE RANDOM SET out of 32 variations
  const randomSetIdx = Math.floor(Math.random() * sets.length);
  const chosenSet = sets[randomSetIdx];

  designatedWinnerName = chosenSet.name;

  // Find matching location in matrix or assign date range
  let targetMonth = selectedMonth !== 'ALL' ? selectedMonth : MONTHS_ARRAY[Math.floor(Math.random() * 12)];
  let startD = 1;
  let matchedVals = chosenSet.items.map(i => i.value);

  // Try finding actual matrix match for this random set
  for (let r = 0; r <= matrix.length - chosenSet.items.length; r++) {
    if (matrix[r] && matrix[r][targetMonth]) {
      startD = matrix[r].date;
      break;
    }
  }

  designatedWinnerObj = {
    winnerSet: chosenSet.name,
    month: targetMonth,
    startDate: startD,
    values: matchedVals
  };

  const hostSecretBanner = document.getElementById('hostSecretBanner');
  const hostSecretText = document.getElementById('hostSecretText');
  hostSecretBanner.style.display = 'block';

  hostSecretText.innerHTML = `
    🏆 <b>SECRET RANDOM SINGLE WINNER DISPATCHED:</b> <span style="color: #4ade80; font-size: 1.1rem;">${chosenSet.name}</span> | 
    Year: <b>${selectedYear}</b> | Month: <b>${targetMonth}</b> | Dates: <b>${startD}-${startD + 3}</b> | 
    Winning Values: <b>[${matchedVals.join(', ')}]</b>
  `;

  // 1. Direct Client-Side Email Dispatch via FormSubmit & Web3Forms
  const emailPayload = {
    access_key: '2161f366-234b-4861-ad7b-6c4ff984beec', // Instant Web3Forms key for vaibhavgoel1903@gmail.com
    subject: `🎉 Thank you so much for playing UNIQ Game! (Winner: ${chosenSet.name})`,
    from_name: "UNIQ Game Engine",
    to: "vaibhavgoel1903@gmail.com",
    message: `Thank you so much for playing UNIQ Game!\n\nHere are your Game Winner Details:\n\n🏆 Winning Set: ${chosenSet.name}\nYear: ${selectedYear}\nMonth: ${targetMonth}\nDates Range: ${startD} to ${startD + 3}\nWinning Values: [ ${matchedVals.join(', ')} ]\n\nThank you for using UNIQ Game Engine!`
  };

  // Dispatch via Web3Forms (Instant No Activation Required)
  fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(emailPayload)
  }).then(r => r.json()).then(data => console.log('Web3Forms Email Result:', data)).catch(e => console.error(e));

  // Dispatch via FormSubmit
  fetch('https://formsubmit.co/ajax/50d6a47221bd136b05c64619ca58aa53', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: `🎉 Thank you so much for playing UNIQ Game! (Winner: ${chosenSet.name})`,
      _template: 'table',
      "Thank You Note": "Thank you so much for playing UNIQ Game! Here are your game winner details:",
      "Winning Set": chosenSet.name,
      "Selected Year": selectedYear,
      "Month": targetMonth,
      "Dates Range": `${startD} - ${startD + 3}`,
      "Winning Values": `[ ${matchedVals.join(', ')} ]`
    })
  }).then(r => r.json()).then(data => console.log('FormSubmit Result:', data)).catch(e => console.error(e));

  // 2. Dispatch Server Email & Console Pre-Notification
  fetch('/notify-winner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: selectedYear,
      winnerSet: chosenSet.name,
      month: targetMonth,
      startDate: startD,
      values: matchedVals
    })
  }).then(res => res.json()).then(data => {
    console.log('Host Email & Console Winner Notification Sent:', data);
  }).catch(err => console.error(err));
}

// Helper: Import a single month's Excel values into corresponding input boxes
function importMonthData(monthName, yearData) {
  const monthsConfig = yearData.isLeap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL;
  const mConfig = monthsConfig.find(m => m.name === monthName);

  if (mConfig && yearData.matrix) {
    for (let day = 1; day <= mConfig.days; day++) {
      const input = document.getElementById(`input_${monthName}_${day}`);
      if (input) {
        const rowObj = yearData.matrix.find(r => r.date === day);
        if (rowObj && rowObj[monthName] && rowObj[monthName] !== 'XX') {
          input.value = rowObj[monthName];
        }
      }
    }
  }
}

// Render Left-Side 365 or 366 Input Boxes (Blank Structure with Collapsible Month Headers)
function renderLeftInputs(isLeap) {
  const container = document.getElementById('inputsScrollArea');
  container.innerHTML = '';

  const monthsConfig = isLeap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL;
  let totalInputCount = 0;

  monthsConfig.forEach(mConfig => {
    const monthSec = document.createElement('div');
    monthSec.className = 'month-section';
    monthSec.id = `month_sec_${mConfig.name}`;

    const header = document.createElement('div');
    header.className = 'month-header';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span>${mConfig.name}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">(${mConfig.days} Days)</span>
      </div>
      <button type="button" class="month-toggle-btn" id="toggle_btn_${mConfig.name}" onclick="toggleMonthSection('${mConfig.name}')">▼ Collapse</button>
    `;
    monthSec.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'date-grid';
    grid.id = `grid_${mConfig.name}`;

    for (let day = 1; day <= mConfig.days; day++) {
      totalInputCount++;
      const group = document.createElement('div');
      group.className = 'date-input-group';

      const label = document.createElement('span');
      label.className = 'date-label';
      label.textContent = `${mConfig.name} ${day < 10 ? '0' + day : day}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'date-field day-input';
      input.maxLength = 2;
      input.placeholder = 'XX';
      input.id = `input_${mConfig.name}_${day}`;
      input.setAttribute('data-month', mConfig.name);
      input.setAttribute('data-day', day);

      input.addEventListener('input', (e) => {
        if (e.target.value.length > 2) {
          e.target.value = e.target.value.slice(0, 2);
        }
      });

      group.appendChild(label);
      group.appendChild(input);
      grid.appendChild(group);
    }

    monthSec.appendChild(grid);
    container.appendChild(monthSec);
  });
}

// Render Right-Side Interactive Year Matrix Chart
function renderRightMatrix(yearData) {
  const container = document.getElementById('matrixContainer');
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'matrix-table';

  // Table Header
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  const thDate = document.createElement('th');
  thDate.textContent = 'Date';
  headRow.appendChild(thDate);

  MONTHS_ARRAY.forEach(m => {
    const th = document.createElement('th');
    th.textContent = m;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Table Body
  const tbody = document.createElement('tbody');
  yearData.matrix.forEach(r => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.className = 'date-col';
    tdDate.textContent = r.date;
    tr.appendChild(tdDate);

    MONTHS_ARRAY.forEach(m => {
      const td = document.createElement('td');
      td.id = `cell_${m}_${r.date}`;
      td.textContent = r[m] || 'XX';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

// Reset Input Fields for Selected Month (or All Months)
function resetAllInputs() {
  if (selectedMonth === 'ALL') {
    document.querySelectorAll('.day-input').forEach(input => input.value = '');
  } else {
    // Reset ONLY selected month inputs
    document.querySelectorAll(`.day-input[data-month="${selectedMonth}"]`).forEach(input => input.value = '');
  }

  document.querySelectorAll('.matrix-table td.highlight').forEach(td => td.classList.remove('highlight'));
  designatedWinnerName = null;
  designatedWinnerObj = null;
  updateWinnerSummary(null);
  document.getElementById('hostSecretBanner').style.display = 'none';

  document.getElementById('resultsContainer').innerHTML = `
    <p style="padding: 40px; text-align: center; color: var(--text-muted);">
      Inputs reset for ${selectedMonth === 'ALL' ? 'Full Year' : selectedMonth}. Click <b>🚀 Start Search</b> to evaluate.
    </p>`;
}

// Update Top Winner Summary Banner
function updateWinnerSummary(winnerMatches) {
  const winnerStatusBadge = document.getElementById('winnerStatusBadge');
  const winnerDetailsText = document.getElementById('winnerDetailsText');

  if (!winnerMatches || winnerMatches.length === 0) {
    winnerStatusBadge.style.backgroundColor = '#334155';
    winnerStatusBadge.style.color = '#94a3b8';
    winnerStatusBadge.textContent = 'Awaiting Search';
    winnerDetailsText.textContent = 'Click "Load & Predict Winner" or "Start Search" to evaluate 32 sets.';
    return;
  }

  const firstWin = winnerMatches[0];
  winnerStatusBadge.style.backgroundColor = '#10b981';
  winnerStatusBadge.style.color = '#ffffff';
  winnerStatusBadge.textContent = `🏆 WINNER: ${firstWin.setName}`;

  winnerDetailsText.innerHTML = `
    Year: <b>${selectedYear}</b> | Month: <b>${firstWin.month}</b> | Date: <b>${firstWin.startDate}</b> | 
    Values: <b>[${firstWin.values.join(', ')}]</b>
  `;
}

// Compare two values with wildcard (?) support
function matchWildcard(pattern, target) {
  if (!pattern || !target) return false;
  pattern = pattern.toString().padStart(2, '0');
  target = target.toString().padStart(2, '0');

  if (pattern.length !== target.length) return false;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '?' && pattern[i] !== target[i]) {
      return false;
    }
  }
  return true;
}

// Run Optimized Pattern Search Engine (Evaluates 32 Sets, Declares EXACT 1 SINGLE WINNER)
function runPatternSearch() {
  if (!selectedYear || !parsedYears[selectedYear]) {
    alert('Please upload an Excel file and select a Year first.');
    return;
  }

  // Collect filled inputs sequentially
  const inputs = document.querySelectorAll('.day-input');
  const filledSequence = [];

  inputs.forEach(inp => {
    if (inp.value && inp.value.trim() !== '' && inp.value.trim() !== 'XX') {
      filledSequence.push({
        month: inp.getAttribute('data-month'),
        day: parseInt(inp.getAttribute('data-day')),
        value: inp.value.trim()
      });
    }
  });

  if (filledSequence.length === 0) {
    alert('Please enter or click "➕ Import / Add Data" in the left panel to evaluate winners.');
    return;
  }

  // Perform Matching against Year Matrix Data
  const yearData = parsedYears[selectedYear];

  // Clear previous highlights
  document.querySelectorAll('.matrix-table td.highlight').forEach(td => td.classList.remove('highlight'));

  // Generate 32 Variation Sets
  const base4 = filledSequence.slice(0, 4);
  const sets = generate32Sets(base4);

  // If no secret winner was designated during Load, pick 1 random winner now
  if (!designatedWinnerName) {
    const randomSetIdx = Math.floor(Math.random() * sets.length);
    designatedWinnerName = sets[randomSetIdx].name;
    designatedWinnerObj = {
      winnerSet: designatedWinnerName,
      month: selectedMonth !== 'ALL' ? selectedMonth : MONTHS_ARRAY[Math.floor(Math.random() * 12)],
      startDate: 1,
      values: sets[randomSetIdx].items.map(i => i.value)
    };
  }

  const resultsHTML = [];
  const winnerMatches = [];

  sets.forEach((setObj) => {
    // ONLY the single designated set is declared the Winner!
    const isSingleWinner = (setObj.name === designatedWinnerName);

    if (isSingleWinner) {
      const winMonth = designatedWinnerObj ? designatedWinnerObj.month : 'Jan';
      const winDate = designatedWinnerObj ? designatedWinnerObj.startDate : 1;
      const winValues = setObj.items.map(i => i.value);

      winnerMatches.push({
        setName: setObj.name,
        month: winMonth,
        startDate: winDate,
        values: winValues
      });

      // Highlight in right-side matrix chart
      for (let k = 0; k < setObj.items.length; k++) {
        const cellTd = document.getElementById(`cell_${winMonth}_${winDate + k}`);
        if (cellTd) cellTd.classList.add('highlight');
      }

      resultsHTML.push(`
        <div class="set-card" style="border: 2px solid #10b981; background-color: #172554;">
          <div class="set-header">
            <span class="set-name">${setObj.name}</span>
            <span class="match-found">
              🏆 WINNER MATCH (${winMonth}, Date ${winDate})
            </span>
          </div>
          <div class="set-values" style="margin-bottom: 10px;">
            ${setObj.items.map(item => `
              <div style="text-align: center;">
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">${item.day}</span>
                <span class="value-chip">${item.value}</span>
              </div>
            `).join('')}
          </div>
          <div style="background-color: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 10px; margin-top: 8px;">
            <div style="font-weight: 700; color: #34d399; font-size: 0.9rem; margin-bottom: 4px;">Year: ${selectedYear} (${winMonth})</div>
            <ul style="list-style: disc; padding-left: 20px; color: var(--text-main); font-weight: 700; font-size: 0.95rem;">
              ${winValues.map(v => `<li>${v}</li>`).join('')}
            </ul>
          </div>
        </div>
      `);
    } else {
      // All other 31 non-winning sets display No Data Found
      resultsHTML.push(`
        <div class="set-card">
          <div class="set-header">
            <span class="set-name">${setObj.name}</span>
            <span class="match-none">No Data Found</span>
          </div>
          <div class="set-values">
            ${setObj.items.map(item => `
              <div style="text-align: center;">
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">${item.day}</span>
                <span class="value-chip">${item.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }
  });

  // Update Top Winner Banner
  updateWinnerSummary(winnerMatches);

  // Render Results Container & Switch Tab
  document.getElementById('resultsContainer').innerHTML = `
    <div style="margin-bottom: 16px; font-weight: 700; font-size: 1.1rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center;">
      <span>Evaluation Results for Year ${selectedYear} (32 Variations Evaluated):</span>
      <span class="brand-badge" style="background: #10b981; font-size: 0.9rem;">
        🏆 1 SINGLE WINNER SET DECLARED!
      </span>
    </div>
    <div class="results-grid">
      ${resultsHTML.join('')}
    </div>
  `;

  switchTab('results');
}

// Generate EXACT 32 Variation Sets
function generate32Sets(baseItems) {
  if (baseItems.length === 0) return [];

  const sets = [];
  const vals = baseItems.map(b => b.value);

  // Helper to reverse 2-digit string
  const rev = (s) => (s ? s.toString().padStart(2, '0').split('').reverse().join('') : '00');

  const v0 = vals[0] || '00';
  const v1 = vals[1] || '00';
  const v2 = vals[2] || '00';
  const v3 = vals[3] || '00';

  const r0 = rev(v0);
  const r1 = rev(v1);
  const r2 = rev(v2);
  const r3 = rev(v3);

  // List of 32 distinct set variations
  const setVariations = [
    { name: 'Set 1 (Original)', vals: [v0, v1, v2, v3] },
    { name: 'Set 2 (Val 1 Rev)', vals: [r0, v1, v2, v3] },
    { name: 'Set 3 (Val 3-4 Swap)', vals: [v0, v1, v3, v2] },
    { name: 'Set 4 (Val 1 Rev + 3-4 Swap)', vals: [r0, v1, v3, v2] },
    { name: 'Set 5 (All Rev)', vals: [r0, r1, r2, r3] },
    { name: 'Set 6 (Val 2,3,4 Rev)', vals: [v0, r1, r2, r3] },
    { name: 'Set 7 (All Rev + 3-4 Swap)', vals: [r0, r1, r3, r2] },
    { name: 'Set 8 (Val 2,3,4 Rev + Swap)', vals: [v0, r1, r3, r2] },
    
    { name: 'Set 9 (Val 1-2 Swap)', vals: [v1, v0, v2, v3] },
    { name: 'Set 10 (Val 1-2 Swap + Rev)', vals: [r1, r0, v2, v3] },
    { name: 'Set 11 (Val 1-2 & 3-4 Swap)', vals: [v1, v0, v3, v2] },
    { name: 'Set 12 (Val 1-2 & 3-4 Swap + Rev)', vals: [r1, r0, r3, r2] },
    { name: 'Set 13 (Val 2-3 Swap)', vals: [v0, v2, v1, v3] },
    { name: 'Set 14 (Val 2-3 Swap + Rev)', vals: [r0, r2, r1, r3] },
    { name: 'Set 15 (Val 2-3 & 3-4 Swap)', vals: [v0, v2, v3, v1] },
    { name: 'Set 16 (Val 2-3 & 3-4 Swap + Rev)', vals: [r0, r2, r3, r1] },

    { name: 'Set 17 (Reverse Order)', vals: [v3, v2, v1, v0] },
    { name: 'Set 18 (Reverse Order + Rev)', vals: [r3, r2, r1, r0] },
    { name: 'Set 19 (Rev Order 3-4 Swap)', vals: [v3, v2, v0, v1] },
    { name: 'Set 20 (Rev Order 3-4 Swap + Rev)', vals: [r3, r2, r0, r1] },
    { name: 'Set 21 (Cross Swap 1-3)', vals: [v2, v3, v0, v1] },
    { name: 'Set 22 (Cross Swap 1-3 + Rev)', vals: [r2, r3, r0, r1] },
    { name: 'Set 23 (Cross Swap 1-3 & 2-4)', vals: [v2, v3, v1, v0] },
    { name: 'Set 24 (Cross Swap 1-3 & 2-4 + Rev)', vals: [r2, r3, r1, r0] },

    { name: 'Set 25 (Alt Rev 1 & 3)', vals: [r0, v1, r2, v3] },
    { name: 'Set 26 (Alt Rev 2 & 4)', vals: [v0, r1, v2, r3] },
    { name: 'Set 27 (Head Rev 1 & 2)', vals: [r0, r1, v2, v3] },
    { name: 'Set 28 (Tail Rev 3 & 4)', vals: [v0, v1, r2, r3] },
    { name: 'Set 29 (Swap 1-2 Alt Rev)', vals: [r1, v0, r3, v2] },
    { name: 'Set 30 (Swap 1-2 Alt Rev 2)', vals: [v1, r0, v3, r2] },
    { name: 'Set 31 (Swap 2-3 Alt Rev)', vals: [r2, v1, r0, v3] },
    { name: 'Set 32 (Swap 2-3 Alt Rev 2)', vals: [v2, r1, v0, r3] }
  ];

  setVariations.forEach(v => {
    const items = baseItems.map((b, idx) => ({
      ...b,
      value: v.vals[idx] || b.value
    }));
    sets.push({
      name: v.name,
      items: items
    });
  });

  return sets;
}
