// calendar.js — カレンダー画面
// E-04: roundTo15 エッジケース修正
// D-01: ドラムローラー操作性改善（clampEndTime）
// D-03: 保存/削除時のセルフィードバック
// D-06: 削除確認ダイアログ

import { getMonthAttendance, saveAttendance, deleteAttendance, getAttendance, getSettings } from './storage.js';
import { formatDate, isNonWorkday, getHolidayName } from './holidays.js';
import { calcWorkMinutes, minutesToDisplay, getShiftType, getShiftLabel, calcMonthlySummary, clampEndTime } from './attendance.js';
import { renderHome } from './home.js';
import { showToast, animateCounter, initDrumRoller, getDrumValue, flashElement } from './ui.js';

let currentYear, currentMonth;
let selectedDate = null;
let scheduleMode = false;
let scheduleModeSelected = new Set();
let activeSchedShift = 'early';
let panelShiftType = null;

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS_15 = ['00', '15', '30', '45'];

export function initCalendar() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--; if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    selectedDate = null; renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++; if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    selectedDate = null; renderCalendar();
  });

  document.getElementById('panel-save').addEventListener('click', saveFromPanel);
  document.getElementById('panel-delete').addEventListener('click', deleteFromPanel);
  document.getElementById('panel-cancel').addEventListener('click', cancelPanel);
  document.getElementById('panel-add-end').addEventListener('click', showPanelDrums);
  document.getElementById('panel-early').addEventListener('click', () => setPanelShift('early'));
  document.getElementById('panel-late').addEventListener('click', () => setPanelShift('late'));

  document.getElementById('cal-sched-toggle').addEventListener('click', enterScheduleMode);
  document.getElementById('sched-cancel').addEventListener('click', exitScheduleMode);
  document.getElementById('sched-confirm').addEventListener('click', confirmScheduleMode);
  document.getElementById('sched-early').addEventListener('click', () => setSchedShift('early'));
  document.getElementById('sched-late').addEventListener('click', () => setSchedShift('late'));

  renderCalendar();
}

export function renderCalendar() {
  document.getElementById('cal-month-label').textContent = `${currentYear}年 ${currentMonth}月`;
  updateSummary();
  renderGrid();
  renderDetailPanel();
}

function updateSummary() {
  const { totalMinutes, totalPay } = calcMonthlySummary(currentYear, currentMonth);
  document.getElementById('cal-summary-hours').textContent = minutesToDisplay(totalMinutes);
  animateCounter(document.getElementById('cal-summary-pay'), Math.round(totalPay), '¥ ');
}

function renderGrid() {
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const attendance = getMonthAttendance(currentYear, currentMonth);
  const today = formatDate(new Date());
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // 空セル
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'cal-cell empty';
    grid.appendChild(e);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = new Date(currentYear, currentMonth - 1, day);
    const entry = attendance[ds];
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.dataset.date = ds;

    if (ds === today) cell.classList.add('today');
    if (isNonWorkday(date)) cell.classList.add('nonworkday');
    if (ds === selectedDate) cell.classList.add('selected-date');
    if (entry) {
      if (entry.status === 'completed') cell.classList.add('completed');
      else if (entry.status === 'scheduled') {
        cell.classList.add('scheduled');
        if (ds < today) cell.classList.add('missing');
      }
    }
    if (scheduleMode && scheduleModeSelected.has(ds)) cell.classList.add('sched-selected');

    // 日付番号
    const num = document.createElement('span');
    num.className = 'cal-day-num';
    // D-04: 今日の日付を太字+アクセントカラーで差別化（CSSで対応）
    num.textContent = day;
    cell.appendChild(num);

    // アノテーション（セル下部に絶対配置 → 日付位置に影響しない）
    if (entry && entry.scheduledStart) {
      const bottom = document.createElement('div');
      bottom.className = 'cal-cell-bottom';

      const st = getShiftType(entry.scheduledStart);
      const tag = document.createElement('span');
      tag.className = `cal-shift-tag ${st}`;
      tag.textContent = st === 'early' ? '早番' : '遅番';
      bottom.appendChild(tag);

      if (entry.status === 'completed' && entry.actualEnd) {
        const et = document.createElement('span');
        et.className = 'cal-end-time';
        et.textContent = entry.actualEnd;
        bottom.appendChild(et);
      }

      cell.appendChild(bottom);
    }

    cell.addEventListener('click', () => {
      if (scheduleMode) {
        scheduleModeSelected.has(ds) ? scheduleModeSelected.delete(ds) : scheduleModeSelected.add(ds);
        renderGrid();
        updateScheduleBar();
      } else {
        selectedDate = ds;
        panelShiftType = null;
        renderGrid();
        renderDetailPanel();
      }
    });
    grid.appendChild(cell);
  }
}

// ─── 詳細パネル ───

function renderDetailPanel() {
  const empty = document.getElementById('cal-detail-empty');
  const info = document.getElementById('cal-detail-info');

  if (!selectedDate) {
    empty.style.display = 'block';
    info.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  info.style.display = 'block';

  const d = new Date(selectedDate + 'T00:00:00');
  document.getElementById('panel-date-label').textContent =
    `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS_JA[d.getDay()]})`;

  const hol = getHolidayName(selectedDate);
  const holEl = document.getElementById('panel-holiday');
  if (hol) { holEl.textContent = hol; holEl.style.display = 'inline'; }
  else holEl.style.display = 'none';

  const entry = getAttendance(selectedDate);
  const earlyBtn = document.getElementById('panel-early');
  const lateBtn = document.getElementById('panel-late');
  const badge = document.getElementById('panel-shift-badge');
  const drumSection = document.getElementById('panel-drum-section');
  const addEndBtn = document.getElementById('panel-add-end');
  const delBtn = document.getElementById('panel-delete');

  panelShiftType = null;

  // シフトボタン状態
  if (entry && entry.scheduledStart) {
    const st = getShiftType(entry.scheduledStart);
    earlyBtn.classList.toggle('active', st === 'early');
    lateBtn.classList.toggle('active', st === 'late');
    badge.textContent = getShiftLabel(entry.scheduledStart);
    badge.className = `shift-badge ${st}`;
    badge.style.display = 'inline';
  } else {
    earlyBtn.classList.remove('active');
    lateBtn.classList.remove('active');
    badge.style.display = 'none';
  }

  // 退勤時間 (E-04: clampEndTimeでエッジケース処理)
  if (entry && entry.actualEnd) {
    const safeEnd = clampEndTime(entry.actualEnd);
    const [h, m] = safeEnd.split(':');
    initDrumRoller(document.getElementById('panel-drum-hour'), HOURS, h);
    initDrumRoller(document.getElementById('panel-drum-min'), MINS_15, m);
    drumSection.style.display = 'flex';
    addEndBtn.style.display = 'none';
  } else {
    drumSection.style.display = 'none';
    addEndBtn.style.display = 'block';
  }

  // 削除ボタン
  delBtn.style.display = entry ? 'inline-flex' : 'none';
}

function setPanelShift(type) {
  panelShiftType = type;
  document.getElementById('panel-early').classList.toggle('active', type === 'early');
  document.getElementById('panel-late').classList.toggle('active', type === 'late');
  const badge = document.getElementById('panel-shift-badge');
  badge.textContent = type === 'early' ? '早番' : '遅番';
  badge.className = `shift-badge ${type}`;
  badge.style.display = 'inline';
}

function showPanelDrums() {
  initDrumRoller(document.getElementById('panel-drum-hour'), HOURS, '18');
  initDrumRoller(document.getElementById('panel-drum-min'), MINS_15, '00');
  document.getElementById('panel-drum-section').style.display = 'flex';
  document.getElementById('panel-add-end').style.display = 'none';
}

function cancelPanel() {
  selectedDate = null;
  panelShiftType = null;
  renderGrid();
  renderDetailPanel();
}

function saveFromPanel() {
  if (!selectedDate) return;
  const entry = getAttendance(selectedDate) || {};

  if (panelShiftType) {
    const s = getSettings();
    entry.scheduledStart = panelShiftType === 'early' ? s.earlyStartTime : s.lateStartTime;
  }
  if (!entry.scheduledStart) {
    const s = getSettings();
    entry.scheduledStart = s.earlyStartTime;
  }

  const drumSection = document.getElementById('panel-drum-section');
  if (drumSection.style.display !== 'none') {
    const h = getDrumValue(document.getElementById('panel-drum-hour'));
    const m = getDrumValue(document.getElementById('panel-drum-min'));
    entry.actualEnd = `${h}:${m}`;
    entry.status = 'completed';
  } else if (!entry.status) {
    entry.status = 'scheduled';
  }

  saveAttendance(selectedDate, entry);
  panelShiftType = null;

  // D-03: 保存したセルをフラッシュ
  const savedCell = document.querySelector(`.cal-cell[data-date="${selectedDate}"]`);
  if (savedCell) flashElement(savedCell, 'save');

  renderCalendar();
  renderHome();
  showToast('保存しました');
}

function deleteFromPanel() {
  if (!selectedDate) return;

  // D-06: 削除確認ダイアログ
  if (!confirm(`${selectedDate} の勤怠データを削除しますか？`)) return;

  deleteAttendance(selectedDate);
  panelShiftType = null;
  renderCalendar();
  renderHome();
  showToast('削除しました');
}

// ─── スケジュール一括登録 ───

function enterScheduleMode() {
  scheduleMode = true;
  scheduleModeSelected.clear();
  selectedDate = null;
  activeSchedShift = 'early';

  document.getElementById('cal-sched-toggle').style.display = 'none';
  document.getElementById('cal-schedule-bar').classList.add('active');
  document.getElementById('cal-detail-panel').style.display = 'none';
  document.getElementById('sched-early').classList.add('active');
  document.getElementById('sched-late').classList.remove('active');
  renderGrid();
}

function exitScheduleMode() {
  scheduleMode = false;
  scheduleModeSelected.clear();
  document.getElementById('cal-sched-toggle').style.display = 'flex';
  document.getElementById('cal-schedule-bar').classList.remove('active');
  document.getElementById('cal-detail-panel').style.display = 'block';
  renderGrid();
  renderDetailPanel();
}

function setSchedShift(type) {
  activeSchedShift = type;
  document.getElementById('sched-early').classList.toggle('active', type === 'early');
  document.getElementById('sched-late').classList.toggle('active', type === 'late');
}

function confirmScheduleMode() {
  if (scheduleModeSelected.size === 0) {
    showToast('日付を選択してください');
    return;
  }
  const s = getSettings();
  const start = activeSchedShift === 'early' ? s.earlyStartTime : s.lateStartTime;

  for (const ds of scheduleModeSelected) {
    const ex = getAttendance(ds);
    if (!ex || ex.status !== 'completed') {
      saveAttendance(ds, { scheduledStart: start, status: 'scheduled', actualEnd: ex?.actualEnd || null });
    }
  }
  const label = activeSchedShift === 'early' ? '早番' : '遅番';
  showToast(`${scheduleModeSelected.size}日分を${label}で登録`);
  exitScheduleMode();
  renderCalendar();
  renderHome();
}

function updateScheduleBar() {
  if (!scheduleMode) return;
  document.getElementById('sched-count').innerHTML = `選択中: <strong>${scheduleModeSelected.size}日</strong>`;
}


