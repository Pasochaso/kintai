// home.js — ホーム画面
// E-04: roundTo15 エッジケース修正（23:53以降のクランプ）
// D-03: 保存時のマイクロアニメーション
// D-06: 削除確認ダイアログ

import { calcMonthlySummary, checkAutoClockOut, minutesToDisplay, calcWorkMinutes, getShiftLabel, getShiftType, calcDayPay, clampEndTime } from './attendance.js';
import { getAttendance, saveAttendance, deleteAttendance, getSettings } from './storage.js';
import { formatDate } from './holidays.js';
import { showToast, animateCounter, initDrumRoller, getDrumValue, flashElement } from './ui.js';

const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS_15 = ['00', '15', '30', '45'];

let isEditing = false;
let editShiftType = null;

export function initHome() {
  const result = checkAutoClockOut();
  if (result) showToast(`${result.actualEnd} 退勤を記録しました`);

  document.getElementById('home-reg-early')?.addEventListener('click', () => registerToday('early'));
  document.getElementById('home-reg-late')?.addEventListener('click', () => registerToday('late'));
  document.getElementById('home-edit-btn')?.addEventListener('click', openEdit);
  document.getElementById('home-edit-cancel')?.addEventListener('click', closeEdit);
  document.getElementById('home-edit-save')?.addEventListener('click', saveEdit);
  document.getElementById('home-edit-delete')?.addEventListener('click', deleteEdit);
  document.getElementById('home-edit-early')?.addEventListener('click', () => setEditShift('early'));
  document.getElementById('home-edit-late')?.addEventListener('click', () => setEditShift('late'));
  document.getElementById('home-add-end-btn')?.addEventListener('click', showHomeDrums);

  renderHome();
}

function registerToday(shiftType) {
  const settings = getSettings();
  const start = shiftType === 'early' ? settings.earlyStartTime : settings.lateStartTime;
  saveAttendance(formatDate(new Date()), { scheduledStart: start, status: 'scheduled', actualEnd: null });
  renderHome();
  showToast(`${shiftType === 'early' ? '早番' : '遅番'} ${start} で登録`);
}

export function renderHome() {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth() + 1, d = now.getDate();
  const todayStr = formatDate(now);
  const { totalMinutes } = calcMonthlySummary(y, mo);
  const entry = getAttendance(todayStr);

  // 日付
  document.getElementById('date-label').textContent =
    `${y}.${String(mo).padStart(2, '0')}.${String(d).padStart(2, '0')} (${DAYS[now.getDay()]})`;

  // ステータス & ヒーロー
  let statusClass, statusLabel, heroTime, heroLabel;
  if (entry) {
    if (entry.status === 'completed' && entry.actualEnd) {
      statusClass = 'off-duty'; statusLabel = '退勤済';
      heroTime = entry.actualEnd; heroLabel = '退勤';
    } else {
      statusClass = 'scheduled'; statusLabel = '出勤前';
      heroTime = entry.scheduledStart || '--:--'; heroLabel = '開始予定';
    }
  } else {
    statusClass = 'no-schedule'; statusLabel = '未登録';
    heroTime = '--:--'; heroLabel = '';
  }

  document.getElementById('status-dot').className = `status-dot ${statusClass}`;
  document.getElementById('status-label').textContent = statusLabel;
  document.getElementById('hero-time').textContent = heroTime;
  document.getElementById('hero-label').textContent = heroLabel;

  // 月間稼働
  document.getElementById('monthly-hours').textContent = minutesToDisplay(totalMinutes);

  // Today セクション
  renderToday(entry, todayStr);
}

function renderToday(entry, todayStr) {
  const info = document.getElementById('home-today-info');
  const noEntry = document.getElementById('home-no-entry');

  if (isEditing) return;
  document.getElementById('home-edit-panel').style.display = 'none';

  if (!entry || !entry.scheduledStart) {
    info.style.display = 'none';
    noEntry.style.display = 'block';
    return;
  }

  info.style.display = 'flex';
  noEntry.style.display = 'none';

  // シフトバッジ
  const st = getShiftType(entry.scheduledStart);
  const badge = document.getElementById('home-shift-label');
  badge.textContent = getShiftLabel(entry.scheduledStart);
  badge.className = `shift-badge ${st}`;

  // 時間表示
  const timesEl = document.getElementById('home-times-text');
  const whEl = document.getElementById('home-work-hours');
  const payEl = document.getElementById('today-pay-display');
  const sepEl = document.getElementById('today-separator');

  if (entry.status === 'completed' && entry.actualEnd) {
    timesEl.textContent = `${entry.scheduledStart} → ${entry.actualEnd}`;
    const mins = calcWorkMinutes(entry.scheduledStart, entry.actualEnd);
    whEl.textContent = minutesToDisplay(mins);
    whEl.style.display = 'inline';
    const pay = calcDayPay(todayStr, mins);
    animateCounter(payEl, pay, '¥ ');
    payEl.style.display = 'inline';
    sepEl.style.display = 'inline';
  } else {
    timesEl.textContent = entry.scheduledStart;
    whEl.style.display = 'none';
    payEl.style.display = 'none';
    sepEl.style.display = 'none';
  }
}

// ─── 編集パネル ───

function openEdit() {
  const entry = getAttendance(formatDate(new Date()));
  if (!entry) return;

  isEditing = true;
  editShiftType = getShiftType(entry.scheduledStart);

  document.getElementById('home-today-info').style.display = 'none';
  document.getElementById('home-edit-panel').style.display = 'flex';

  // シフトボタン
  document.getElementById('home-edit-early').classList.toggle('active', editShiftType === 'early');
  document.getElementById('home-edit-late').classList.toggle('active', editShiftType === 'late');

  // 退勤時間
  const drumSection = document.getElementById('home-drum-section');
  const addBtn = document.getElementById('home-add-end-btn');

  if (entry.actualEnd) {
    // E-04: 23:53以降のエッジケースをクランプして処理
    const safeEnd = clampEndTime(entry.actualEnd);
    const [h, m] = safeEnd.split(':');
    initDrumRoller(document.getElementById('home-drum-hour'), HOURS, h);
    initDrumRoller(document.getElementById('home-drum-min'), MINS_15, m);
    drumSection.style.display = 'flex';
    addBtn.style.display = 'none';
  } else {
    drumSection.style.display = 'none';
    addBtn.style.display = 'block';
  }

  // 削除ボタン
  document.getElementById('home-edit-delete').style.display = 'inline-flex';
}

function showHomeDrums() {
  initDrumRoller(document.getElementById('home-drum-hour'), HOURS, '18');
  initDrumRoller(document.getElementById('home-drum-min'), MINS_15, '00');
  document.getElementById('home-drum-section').style.display = 'flex';
  document.getElementById('home-add-end-btn').style.display = 'none';
}

function closeEdit() {
  isEditing = false; editShiftType = null;
  document.getElementById('home-edit-panel').style.display = 'none';
  renderHome();
}

function setEditShift(type) {
  editShiftType = type;
  document.getElementById('home-edit-early').classList.toggle('active', type === 'early');
  document.getElementById('home-edit-late').classList.toggle('active', type === 'late');
}

function saveEdit() {
  const todayStr = formatDate(new Date());
  const entry = getAttendance(todayStr) || {};

  if (editShiftType) {
    const s = getSettings();
    entry.scheduledStart = editShiftType === 'early' ? s.earlyStartTime : s.lateStartTime;
  }

  const drumSection = document.getElementById('home-drum-section');
  if (drumSection.style.display !== 'none') {
    const h = getDrumValue(document.getElementById('home-drum-hour'));
    const m = getDrumValue(document.getElementById('home-drum-min'));
    entry.actualEnd = `${h}:${m}`;
    entry.status = 'completed';
  } else if (!entry.status) {
    entry.status = 'scheduled';
  }

  saveAttendance(todayStr, entry);
  isEditing = false; editShiftType = null;
  document.getElementById('home-edit-panel').style.display = 'none';

  // D-03: 保存フィードバック（hero-timeをフラッシュ）
  flashElement(document.getElementById('hero-time'), 'save');

  renderHome();
  showToast('保存しました');
}

function deleteEdit() {
  // D-06: 削除確認ダイアログ
  if (!confirm('今日の勤怠データを削除しますか？')) return;

  deleteAttendance(formatDate(new Date()));
  isEditing = false; editShiftType = null;
  document.getElementById('home-edit-panel').style.display = 'none';
  renderHome();
  showToast('削除しました');
}


