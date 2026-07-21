// Global State
let parsedYears = {}; // Stores year -> { rows: [{ date: 1, Jan: 21, ... }], isLeap: boolean }
let selectedYear = null;
let selectedMonth = 'ALL';
let selectedStartDayNum = 1;

let isImported = false;     // Step 1: Click 📥 Import
let isDataLoaded = false;    // Step 2: Click 📊 Load Data
let isSetsLoaded = false;    // Step 3: Click ⚡ Load Sets

let designatedWinnerName = null; // Secret single winner set chosen during Load Sets
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

// Helper: Convert Day Number (1-365/366) to { month: 'Jan', day: 10 }
function convertDayNumToMonthAndDay(dayNum, isLeap) {
  const monthsConfig = isLeap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL;
  let remainingDays = parseInt(dayNum, 10) || 1;
  const totalDays = isLeap ? 366 : 365;

  if (remainingDays < 1) remainingDays = 1;
  if (remainingDays > totalDays) remainingDays = totalDays;

  for (let i = 0; i < monthsConfig.length; i++) {
    const m = monthsConfig[i];
    if (remainingDays <= m.days) {
      return { month: m.name, day: remainingDays };
    }
    remainingDays -= m.days;
  }
  return { month: 'Dec', day: 31 };
}

// Helper: Check if cell value is a valid numeric entry (skips XX, CL, CL., NA, etc.)
function isValidNumericValue(val) {
  if (val === undefined || val === null) return false;
  const s = val.toString().trim().toUpperCase();
  if (s === '' || s === 'XX' || s === 'CL' || s === 'CL.' || s.includes('X') || s.includes('C')) return false;
  return !isNaN(parseInt(s, 10));
}

// Helper: Collect 4 valid non-XX/non-CL values starting at (targetMonth, startDay), skipping void cells and transitioning months
function getFourValidValuesStartingAt(targetMonth, startDay) {
  const yearData = parsedYears[selectedYear];
  if (!yearData || !yearData.matrix) return [];

  const matrix = yearData.matrix;
  const results = [];

  let currentMonthIndex = MONTHS_ARRAY.indexOf(targetMonth);
  if (currentMonthIndex === -1) currentMonthIndex = 0;
  let currentMonth = MONTHS_ARRAY[currentMonthIndex];
  let currentDay = startDay;

  const monthsConfig = yearData.isLeap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL;

  while (results.length < 4) {
    const rowObj = matrix.find(r => r.date === currentDay);

    if (rowObj) {
      const cellVal = rowObj[currentMonth];
      if (isValidNumericValue(cellVal)) {
        results.push({
          month: currentMonth,
          day: currentDay,
          value: cellVal
        });
      }
    }

    currentDay++;

    // Check if we reached end of month days
    const monthDays = monthsConfig[currentMonthIndex].days;
    if (currentDay > monthDays) {
      currentMonthIndex++;
      if (currentMonthIndex >= MONTHS_ARRAY.length) break; // Reached end of year
      currentMonth = MONTHS_ARRAY[currentMonthIndex];
      currentDay = 1;
    }
  }

  return results;
}

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const fileUpload = document.getElementById('fileUpload');
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const startDateInput = document.getElementById('startDateInput');
  
  const btnImport = document.getElementById('btnImport');
  const btnLoadData = document.getElementById('btnLoadData');
  const btnLoadSets = document.getElementById('btnLoadSets');
  const btnSearch = document.getElementById('btnSearch');
  const btnReset = document.getElementById('btnReset');
  const btnTogglePanel = document.getElementById('btnTogglePanel');

  fileUpload.addEventListener('change', handleFileUpload);
  yearSelect.addEventListener('change', handleYearChange);
  monthSelect.addEventListener('change', handleMonthChange);
  if (startDateInput) startDateInput.addEventListener('input', handleStartDateInput);
  
  btnImport.addEventListener('click', handleImportClick);
  btnLoadData.addEventListener('click', handleLoadDataClick);
  btnLoadSets.addEventListener('click', handleLoadSetsClick);
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

// Parse Excel Sheet with Dynamic Header Column Detection (DOES NOT AUTO-SELECT YEAR OR RENDER MATRIX)
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
    if (typeof val === 'number' && val >= 1900 && val <= 2100) {
      if (currentYear !== null && yearRows.length > 0) {
        parsedYears[currentYear] = processYearRows(currentYear, yearRows, headerRow);
      }
      currentYear = val;
      headerRow = row;
      yearRows = [];
    } else if (currentYear !== null) {
      if (typeof val === 'number' && val >= 1 && val <= 31) {
        yearRows.push(row);
      }
    }
  }

  if (currentYear !== null && yearRows.length > 0) {
    parsedYears[currentYear] = processYearRows(currentYear, yearRows, headerRow);
  }

  const availableYears = Object.keys(parsedYears).sort((a, b) => parseInt(a) - parseInt(b));

  if (availableYears.length === 0) {
    alert('No valid year data blocks found in Excel sheet.');
    return;
  }

  // Populate Select Dropdowns with placeholder default (NO AUTO-RENDER)
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const startDateInput = document.getElementById('startDateInput');

  yearSelect.innerHTML = '<option value="">-- Select Year --</option>';
  availableYears.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `Year ${y} ${isLeapYear(y) ? '(Leap Year)' : ''}`;
    yearSelect.appendChild(opt);
  });

  yearSelect.disabled = false;
  monthSelect.disabled = false;
  if (startDateInput) {
    startDateInput.disabled = false;
    startDateInput.value = 1;
  }

  // Reset Workflow state (matrix remains NULL until Import is clicked)
  selectedYear = null;
  resetWorkflowState();

  document.getElementById('matrixContainer').innerHTML = `
    <p style="padding: 40px; text-align: center; color: var(--text-muted);">
      Please select a Year and click <b>📥 Import</b> to view the interactive matrix chart.
    </p>`;
}

// Process Data Rows for a Single Year
function processYearRows(year, rows, headerRow) {
  const matrix = [];
  const leap = isLeapYear(year);

  rows.forEach(r => {
    const dateNum = r[0];
    const rowData = { date: dateNum };

    const nonEmpties = [];
    for (let c = 1; c < r.length; c++) {
      const val = r[c];
      if (val !== undefined && val !== null && val !== '') {
        nonEmpties.push(val);
      }
    }

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

// Reset Entire Workflow State
function resetWorkflowState() {
  isImported = false;
  isDataLoaded = false;
  isSetsLoaded = false;

  designatedWinnerName = null;
  designatedWinnerObj = null;

  const btnImport = document.getElementById('btnImport');
  const btnLoadData = document.getElementById('btnLoadData');
  const btnLoadSets = document.getElementById('btnLoadSets');
  const btnSearch = document.getElementById('btnSearch');

  if (btnImport) btnImport.disabled = selectedYear ? false : true;
  if (btnLoadData) { btnLoadData.disabled = true; btnLoadData.classList.remove('btn-pulse'); }
  if (btnLoadSets) { btnLoadSets.disabled = true; btnLoadSets.classList.remove('btn-pulse'); }
  if (btnSearch) { btnSearch.disabled = true; btnSearch.classList.remove('btn-pulse'); }

  const hostSecretBanner = document.getElementById('hostSecretBanner');
  if (hostSecretBanner) hostSecretBanner.style.display = 'none';

  updateWinnerSummary(null);
}

// Handle Year Select Change
function handleYearChange() {
  const yearSelect = document.getElementById('yearSelect');
  selectedYear = yearSelect.value || null;

  const startDateInput = document.getElementById('startDateInput');
  const leapIndicator = document.getElementById('leapIndicator');
  const inputCountBadge = document.getElementById('inputCountBadge');

  if (selectedYear && parsedYears[selectedYear]) {
    const leap = parsedYears[selectedYear].isLeap;
    if (startDateInput) {
      startDateInput.max = leap ? 366 : 365;
    }

    if (leap) {
      leapIndicator.className = 'leap-badge leap';
      leapIndicator.innerHTML = '<span>⚡ Leap Year (366 Days)</span>';
      inputCountBadge.textContent = '366 Days';
    } else {
      leapIndicator.className = 'leap-badge normal';
      leapIndicator.innerHTML = '<span>📅 Normal Year (365 Days)</span>';
      inputCountBadge.textContent = '365 Days';
    }

    renderLeftInputs(leap);
  } else {
    leapIndicator.className = 'leap-badge normal';
    leapIndicator.innerHTML = '<span>📅 Select Year First</span>';
  }

  resetWorkflowState();
}

// Handle Month Change Event
function handleMonthChange() {
  const monthSelect = document.getElementById('monthSelect');
  selectedMonth = monthSelect.value || 'ALL';
  resetWorkflowState();

  if (selectedMonth !== 'ALL') {
    const monthSec = document.getElementById(`month_sec_${selectedMonth}`);
    if (monthSec) {
      monthSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// Handle Start Day Number Input Change (1 to 365/366)
function handleStartDateInput() {
  const startDateInput = document.getElementById('startDateInput');
  if (!startDateInput) return;

  const maxVal = selectedYear && parsedYears[selectedYear] && parsedYears[selectedYear].isLeap ? 366 : 365;
  let val = parseInt(startDateInput.value, 10);

  if (isNaN(val) || val < 1) val = 1;
  if (val > maxVal) val = maxVal;
  startDateInput.value = val;
  selectedStartDayNum = val;

  resetWorkflowState();
}

// STEP 1: Handle 📥 Import Button Click (Renders Selected Year Matrix & Enables 📊 Load Data)
function handleImportClick() {
  if (!selectedYear || !parsedYears[selectedYear]) {
    alert('Please select a Year first before clicking 📥 Import.');
    return;
  }

  const yearData = parsedYears[selectedYear];
  renderRightMatrix(yearData);

  isImported = true;
  isDataLoaded = false;
  isSetsLoaded = false;

  const btnLoadData = document.getElementById('btnLoadData');
  if (btnLoadData) {
    btnLoadData.disabled = false;
    btnLoadData.classList.add('btn-pulse');
  }

  console.log(`Step 1 Complete: Imported Matrix for Year ${selectedYear}. Click "📊 Load Data" next.`);
}

// STEP 2: Handle 📊 Load Data Button Click (Populates Left Input Entries & Enables ⚡ Load Sets)
function handleLoadDataClick() {
  if (!isImported || !selectedYear || !parsedYears[selectedYear]) {
    alert('⚠️ WORKFLOW WARNING:\n\nPlease click "📥 Import" first to load the year matrix!');
    return;
  }

  const yearData = parsedYears[selectedYear];
  const leap = yearData.isLeap;
  const startDateInput = document.getElementById('startDateInput');
  selectedStartDayNum = startDateInput ? parseInt(startDateInput.value, 10) || 1 : 1;

  if (selectedMonth === 'ALL') {
    // Import ALL 12 months for the selected year
    const monthsConfig = leap ? MONTH_DAYS_LEAP : MONTH_DAYS_NORMAL;
    monthsConfig.forEach(mConfig => {
      importMonthDataAll(mConfig.name, yearData);
    });
    console.log(`Imported Full Year data into left inputs.`);
  } else {
    // Convert Day Number (1-365/366) or Selected Month Start Day
    let converted = { month: selectedMonth, day: 1 };
    if (selectedMonth !== 'ALL') {
      converted = { month: selectedMonth, day: Math.min(selectedStartDayNum, 31) };
    } else {
      converted = convertDayNumToMonthAndDay(selectedStartDayNum, leap);
    }

    const validItems = getFourValidValuesStartingAt(converted.month, converted.day);

    validItems.forEach(item => {
      const input = document.getElementById(`input_${item.month}_${item.day}`);
      if (input) {
        input.value = item.value;
      }
    });

    console.log(`Loaded 4 valid input entries starting at ${converted.month} Date ${converted.day}.`);
  }

  isDataLoaded = true;
  isSetsLoaded = false;

  const btnLoadData = document.getElementById('btnLoadData');
  const btnLoadSets = document.getElementById('btnLoadSets');

  if (btnLoadData) btnLoadData.classList.remove('btn-pulse');
  if (btnLoadSets) {
    btnLoadSets.disabled = false;
    btnLoadSets.classList.add('btn-pulse');
  }
}

// Helper: Import full month values into input boxes
function importMonthDataAll(monthName, yearData) {
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

// STEP 3: Handle ⚡ Load Sets Button Click (Pre-calculates Random Winner Set 1-32, Sends Email, Enables 🚀 Start Search)
function handleLoadSetsClick() {
  if (!isDataLoaded || !selectedYear || !parsedYears[selectedYear]) {
    alert('⚠️ WORKFLOW WARNING:\n\nPlease click "📊 Load Data" first to populate input values before clicking "⚡ Load Sets"!');
    return;
  }

  const yearData = parsedYears[selectedYear];
  const leap = yearData.isLeap;
  const startDateInput = document.getElementById('startDateInput');
  selectedStartDayNum = startDateInput ? parseInt(startDateInput.value, 10) || 1 : 1;

  let converted = { month: selectedMonth !== 'ALL' ? selectedMonth : 'Jan', day: 1 };
  if (selectedMonth !== 'ALL') {
    converted = { month: selectedMonth, day: Math.min(selectedStartDayNum, 31) };
  } else {
    converted = convertDayNumToMonthAndDay(selectedStartDayNum, leap);
  }

  const validItems = getFourValidValuesStartingAt(converted.month, converted.day);
  const realExcelVals = validItems.map(i => i.value);
  const realDatesStr = validItems.map(i => `${i.month} ${i.day}`).join(', ');

  // Create base items for 32 sets
  const base4 = validItems.map(i => ({
    month: i.month,
    day: i.day,
    value: i.value
  }));

  const sets = generate32Sets(base4);

  // RANDOMLY ASSIGN ANY SET NUMBER FROM 1 TO 32 TO BE THE WINNER!
  // Introduce a 15% random chance of "Bad Luck / No Winner" round!
  const isBadLuckRound = (Math.random() < 0.15);
  let chosenSetName = "NONE";
  let chosenSetSubject = "";
  let chosenSetMsg = "";

  if (isBadLuckRound) {
    designatedWinnerName = "NONE";
    designatedWinnerObj = {
      noWinner: true,
      winnerSet: "NONE (Bad Luck Round)",
      month: converted.month,
      startDate: converted.day,
      validItems: validItems,
      values: realExcelVals,
      winnerSetIndex: -1
    };

    chosenSetName = "NONE (Bad Luck Round)";
    chosenSetSubject = `💀 UNIQ Game Result: Bad Luck! (No Winner This Round)`;
    chosenSetMsg = `Thank you so much for playing UNIQ Game!\n\n💀 Game Result: Bad Luck! No set won this round.\nYear: ${selectedYear}\nStart: ${converted.month} Date ${converted.day}\nValid Dates: ${realDatesStr}\nWinning Values: [ ${realExcelVals.join(', ')} ]\n\nIt was a bad luck round for everyone who played. Please try again!`;
  } else {
    const randomSetIdx = Math.floor(Math.random() * sets.length);
    const chosenSet = sets[randomSetIdx];

    designatedWinnerName = chosenSet.name;
    designatedWinnerObj = {
      noWinner: false,
      winnerSet: chosenSet.name,
      month: converted.month,
      startDate: converted.day,
      validItems: validItems,
      values: realExcelVals,
      winnerSetIndex: randomSetIdx
    };

    chosenSetName = chosenSet.name;
    chosenSetSubject = `🎉 Thank you so much for playing UNIQ Game! (Winner: ${chosenSet.name})`;
    chosenSetMsg = `Thank you so much for playing UNIQ Game!\n\nHere are your Game Winner Details:\n\n🏆 Winning Set: ${chosenSet.name}\nYear: ${selectedYear}\nStart: ${converted.month} Date ${converted.day}\nValid Dates: ${realDatesStr}\nWinning Values: [ ${realExcelVals.join(', ')} ]\n\nThank you for using UNIQ Game Engine!`;
  }

  isSetsLoaded = true;

  const btnLoadSets = document.getElementById('btnLoadSets');
  const btnSearch = document.getElementById('btnSearch');

  if (btnLoadSets) btnLoadSets.classList.remove('btn-pulse');
  if (btnSearch) {
    btnSearch.disabled = false;
    btnSearch.classList.add('btn-pulse');
  }

  const hostSecretBanner = document.getElementById('hostSecretBanner');
  const hostSecretText = document.getElementById('hostSecretText');
  hostSecretBanner.style.display = 'block';

  if (isBadLuckRound) {
    hostSecretText.innerHTML = `
      💀 <b>BAD LUCK ROUND PRE-CALCULATED & READY:</b> <span style="color: #ef4444; font-size: 1.1rem;">NO WINNING SET THIS ROUND</span> | 
      Year: <b>${selectedYear}</b> | Start: <b>${converted.month} Date ${converted.day}</b> | Valid Dates: <b>[${realDatesStr}]</b> | 
      Real Excel Values: <b>[${realExcelVals.join(', ')}]</b>
    `;
  } else {
    hostSecretText.innerHTML = `
      🏆 <b>SECRET RANDOM SET WINNER PRE-CALCULATED & READY:</b> <span style="color: #4ade80; font-size: 1.1rem;">${chosenSetName}</span> | 
      Year: <b>${selectedYear}</b> | Start: <b>${converted.month} Date ${converted.day}</b> | Valid Dates: <b>[${realDatesStr}]</b> | 
      Real Excel Values: <b>[${realExcelVals.join(', ')}]</b>
    `;
  }

  // Direct Client-Side Email Dispatch via Web3Forms
  const emailPayload = {
    access_key: '2161f366-234b-4861-ad7b-6c4ff984beec',
    subject: chosenSetSubject,
    from_name: "UNIQ Game Engine",
    to: "vaibhavgoel1903@gmail.com",
    message: chosenSetMsg
  };

  fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(emailPayload)
  }).then(r => r.json()).then(data => console.log('Web3Forms Email Result:', data)).catch(e => console.error(e));

  // Dispatch Server Email & Console Pre-Notification
  fetch('/notify-winner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: selectedYear,
      winnerSet: chosenSetName,
      month: converted.month,
      startDate: converted.day,
      values: realExcelVals
    })
  }).then(res => res.json()).then(data => {
    console.log('Host Email & Console Winner Notification Sent:', data);
  }).catch(err => console.error(err));
}

// STEP 4: Run Pattern Search (Requires Prior ⚡ Load Sets Event)
function runPatternSearch() {
  if (!selectedYear || !parsedYears[selectedYear]) {
    alert('Please upload an Excel file and select a Year first.');
    return;
  }

  // WORKFLOW VALIDATION: Enforce clicking "⚡ Load Sets" first
  if (!isSetsLoaded || !designatedWinnerName || !designatedWinnerObj) {
    alert('⚠️ WORKFLOW WARNING:\n\nPlease follow the sequence:\n1. Click "📥 Import"\n2. Click "📊 Load Data"\n3. Click "⚡ Load Sets"\n\nbefore running Search!');
    return;
  }

  const validItems = designatedWinnerObj.validItems;
  const realVals = designatedWinnerObj.values;
  const winMonth = designatedWinnerObj.month;
  const winDate = designatedWinnerObj.startDate;

  const base4 = validItems.map(i => ({ month: i.month, day: i.day, value: i.value }));
  const sets = generate32Sets(base4);

  // Auto-collapse all months except the winning month
  MONTHS_ARRAY.forEach(m => {
    const grid = document.getElementById(`grid_${m}`);
    const btn = document.getElementById(`toggle_btn_${m}`);
    if (grid && btn) {
      if (m === winMonth) {
        grid.style.display = 'grid';
        btn.textContent = '▼ Collapse';
      } else {
        grid.style.display = 'none';
        btn.textContent = '▲ Expand';
      }
    }
  });

  // Clear previous highlights
  document.querySelectorAll('.matrix-table td.highlight').forEach(td => td.classList.remove('highlight'));
  document.querySelectorAll('.date-input-group').forEach(grp => grp.classList.remove('highlight-input', 'highlight-input-bad-luck'));

  // Switch to Results Tab instantly to view loading progress
  switchTab('results');

  const btnSearch = document.getElementById('btnSearch');
  if (btnSearch) {
    btnSearch.disabled = true;
    btnSearch.textContent = '🔍 Scanning...';
    btnSearch.classList.remove('btn-pulse');
  }

  // Setup Results Viewport with a scanning progress bar
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.innerHTML = `
    <div style="margin-bottom: 16px; font-weight: 700; font-size: 1.1rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center;">
      <span>Scanning Set Variations for Year ${selectedYear}...</span>
      <span id="scanProgressBadge" class="brand-badge" style="background: #f59e0b; font-size: 0.9rem;">
        0% Complete (0/32 Sets)
      </span>
    </div>
    <div class="results-grid" id="animatedResultsGrid"></div>
  `;

  const animatedGrid = document.getElementById('animatedResultsGrid');
  const winnerMatches = [];
  let currentIndex = 0;

  function loadNextSetCard() {
    if (currentIndex >= sets.length) {
      // Complete!
      if (btnSearch) {
        btnSearch.textContent = '🚀 Start Search (32 Sets)';
      }
      isSetsLoaded = false;

      const isBadLuck = designatedWinnerObj.noWinner;

      // Update progress badge to complete state
      const badge = document.getElementById('scanProgressBadge');
      if (badge) {
        if (isBadLuck) {
          badge.textContent = '💀 Bad Luck (No Winner)';
          badge.style.backgroundColor = '#ef4444';
        } else {
          badge.textContent = `🏆 Winner: ${designatedWinnerObj.winnerSet}`;
          badge.style.backgroundColor = '#10b981';
        }
      }

      // Highlight winning cells in right-side matrix chart
      validItems.forEach(item => {
        const cellTd = document.getElementById(`cell_${item.month}_${item.day}`);
        if (cellTd) cellTd.classList.add('highlight');
      });

      // Highlight corresponding inputs on the left side
      validItems.forEach(item => {
        const input = document.getElementById(`input_${item.month}_${item.day}`);
        if (input && input.parentElement) {
          if (isBadLuck) {
            input.parentElement.classList.add('highlight-input-bad-luck');
          } else {
            input.parentElement.classList.add('highlight-input');
          }
        }
      });

      // Show Result Modal with dynamic content
      const congratsDatesStr = validItems.map(i => `${i.month} ${i.day}`).join(', ');
      const resultModalContent = document.getElementById('resultModalContent');

      if (isBadLuck) {
        resultModalContent.innerHTML = `
          <span class="close-congrats" onclick="closeResultModal()">&times;</span>
          <div class="congrats-icon" style="filter: grayscale(1);">💀</div>
          <h2 style="color: #ef4444;">BETTER LUCK NEXT TIME!</h2>
          <p class="congrats-subtitle">Bad Luck Round — No Winner Declared</p>
          
          <div class="congrats-details" style="border-color: #ef4444;">
            <div class="detail-item">
              <strong>Game Status:</strong>
              <span style="color: #ef4444; font-weight: 700;">No Winner</span>
            </div>
            <div class="detail-item">
              <strong>Year & Month:</strong>
              <span style="font-weight: 700;">${selectedYear} ${winMonth}</span>
            </div>
            <div class="detail-item">
              <strong>Dates Evaluated:</strong>
              <span style="font-weight: 700;">${congratsDatesStr}</span>
            </div>
            <div class="detail-item">
              <strong>Values:</strong>
              <span style="color: #cbd5e1; font-weight: 700; letter-spacing: 1px;">[ ${realVals.join(', ')} ]</span>
            </div>
          </div>
          <p style="margin-top: 16px; font-size: 0.85rem; color: #94a3b8; font-weight: 600;">
            It was a bad luck round for everyone who played. Try another round!
          </p>
          
          <button type="button" class="btn btn-primary" onclick="closeResultModal()" style="margin-top: 20px; width: 100%; justify-content: center; background: linear-gradient(135deg, #64748b, #475569); border: none;">Try Again</button>
        `;
      } else {
        resultModalContent.innerHTML = `
          <span class="close-congrats" onclick="closeResultModal()">&times;</span>
          <div class="congrats-icon">🏆</div>
          <h2>CONGRATULATIONS!</h2>
          <p class="congrats-subtitle">UNIQ Game Designated Winner Declared</p>
          
          <div class="congrats-details">
            <div class="detail-item">
              <strong>Winning Set:</strong>
              <span style="color: #fbbf24; font-weight: 700; font-size: 1.15rem;">${designatedWinnerObj.winnerSet}</span>
            </div>
            <div class="detail-item">
              <strong>Year & Month:</strong>
              <span style="font-weight: 700;">${selectedYear} ${winMonth}</span>
            </div>
            <div class="detail-item">
              <strong>Dates Range:</strong>
              <span style="font-weight: 700;">${congratsDatesStr}</span>
            </div>
            <div class="detail-item">
              <strong>Winning Values:</strong>
              <span style="color: #34d399; font-weight: 700; letter-spacing: 1px;">[ ${realVals.join(', ')} ]</span>
            </div>
          </div>
          
          <button type="button" class="btn btn-primary" onclick="closeResultModal()" style="margin-top: 20px; width: 100%; justify-content: center; background: linear-gradient(135deg, #10b981, #059669); border: none;">Awesome!</button>
        `;

        winnerMatches.push({
          setName: designatedWinnerObj.winnerSet,
          month: winMonth,
          startDate: winDate,
          values: realVals
        });
      }
      
      const resultModal = document.getElementById('resultModal');
      if (resultModal) resultModal.style.display = 'flex';

      // Update Top Winner Banner
      updateWinnerSummary(winnerMatches);

      // Trigger Confetti Party for winner round
      if (!isBadLuck) {
        triggerCongratsConfetti();
      }
      return;
    }

    const setObj = sets[currentIndex];
    const isWinnerSetCard = (setObj.name === designatedWinnerName);
    let cardHTML = '';

    if (isWinnerSetCard) {
      cardHTML = `
        <div class="set-card" style="border: 2px solid #10b981; background-color: #172554; opacity: 0; transform: translateY(20px); transition: all 0.3s ease;">
          <div class="set-header">
            <span class="set-name">${setObj.name}</span>
            <span class="match-found">
              🏆 WINNER MATCH (${winMonth}, Date ${winDate})
            </span>
          </div>
          <div class="set-values" style="margin-bottom: 10px;">
            ${validItems.map((item) => `
              <div style="text-align: center;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #34d399; display: block; margin-bottom: 2px;">${item.month} ${item.day < 10 ? '0' + item.day : item.day}</span>
                <span class="value-chip">${item.value}</span>
              </div>
            `).join('')}
          </div>
          <div style="background-color: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 10px; margin-top: 8px;">
            <div style="font-weight: 700; color: #34d399; font-size: 0.9rem; margin-bottom: 4px;">Year: ${selectedYear} (${winMonth})</div>
            <ul style="list-style: disc; padding-left: 20px; color: var(--text-main); font-weight: 700; font-size: 0.95rem;">
              ${validItems.map((item) => `<li>${item.month} ${item.day < 10 ? '0' + item.day : item.day}: ${item.value}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } else {
      cardHTML = `
        <div class="set-card" style="opacity: 0; transform: translateY(20px); transition: all 0.3s ease;">
          <div class="set-header">
            <span class="set-name">${setObj.name}</span>
            <span class="match-none">No Data Found</span>
          </div>
          <div class="set-values">
            ${validItems.map((item, idx) => {
              const displayVal = setObj.items[idx] ? setObj.items[idx].value : item.value;
              return `
                <div style="text-align: center;">
                  <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">${item.month} ${item.day < 10 ? '0' + item.day : item.day}</span>
                  <span class="value-chip">${displayVal}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Append card to grid
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHTML;
    const cardEl = tempDiv.firstElementChild;
    animatedGrid.appendChild(cardEl);

    // Trigger visual entry transition
    setTimeout(() => {
      cardEl.style.opacity = '1';
      cardEl.style.transform = 'translateY(0)';
    }, 10);

    currentIndex++;

    // Update Progress Bar/Badge
    const percent = Math.round((currentIndex / sets.length) * 100);
    const progressBadge = document.getElementById('scanProgressBadge');
    if (progressBadge) {
      progressBadge.textContent = `${percent}% Complete (${currentIndex}/32 Sets)`;
    }

    // Schedule next set card load with 150ms delay
    setTimeout(loadNextSetCard, 150);
  }

  // Start the loading sequence
  loadNextSetCard();
}

// Render Left-Side 365 or 366 Input Boxes
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
        let val = e.target.value.toUpperCase();
        if (val.length > 2) val = val.slice(0, 2);
        e.target.value = val;
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
    document.querySelectorAll(`.day-input[data-month="${selectedMonth}"]`).forEach(input => input.value = '');
  }

  document.querySelectorAll('.matrix-table td.highlight').forEach(td => td.classList.remove('highlight'));
  resetWorkflowState();

  document.getElementById('resultsContainer').innerHTML = `
    <p style="padding: 40px; text-align: center; color: var(--text-muted);">
      Inputs reset. Follow workflow: Select Year -> <b>📥 Import</b> -> <b>📊 Load Data</b> -> <b>⚡ Load Sets</b> -> <b>🚀 Start Search</b>.
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
    winnerDetailsText.textContent = 'Follow sequence: Select Year -> 📥 Import -> 📊 Load Data -> ⚡ Load Sets -> 🚀 Start Search.';
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

// Generate EXACT 32 Variation Sets
function generate32Sets(baseItems) {
  if (baseItems.length === 0) return [];

  const sets = [];
  const vals = baseItems.map(b => b.value);

  const rev = (s) => (s ? s.toString().padStart(2, '0').split('').reverse().join('') : '00');

  const v0 = vals[0] || '00';
  const v1 = vals[1] || '00';
  const v2 = vals[2] || '00';
  const v3 = vals[3] || '00';

  const r0 = rev(v0);
  const r1 = rev(v1);
  const r2 = rev(v2);
  const r3 = rev(v3);

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

// Function to close Game Result Modal
function closeResultModal() {
  document.getElementById('resultModal').style.display = 'none';
}

// Lightweight Confetti Particles Generation Script
function triggerCongratsConfetti() {
  const container = document.getElementById('resultModal');
  const colors = ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#a855f7'];

  for (let i = 0; i < 70; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'absolute';
    confetti.style.width = Math.random() * 8 + 6 + 'px';
    confetti.style.height = Math.random() * 12 + 6 + 'px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = -20 + 'px';
    confetti.style.opacity = Math.random();
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.style.borderRadius = '2px';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '99999';

    container.appendChild(confetti);

    const duration = Math.random() * 3 + 2; // 2 to 5 seconds
    const drift = Math.random() * 200 - 100; // Left-right wind drift

    confetti.animate([
      { transform: `translateY(0) rotate(0deg) translateX(0)`, opacity: 1 },
      { transform: `translateY(105vh) rotate(${Math.random() * 720}deg) translateX(${drift}px)`, opacity: 0 }
    ], {
      duration: duration * 1000,
      easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
      iterations: 1,
      fill: 'forwards'
    });

    setTimeout(() => {
      confetti.remove();
    }, duration * 1000);
  }
}
