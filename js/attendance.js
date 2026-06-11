// attendance.js — ビジネスロジック (E-08: 浮動小数点精度改善)

import { getAttendance, saveAttendance, getMonthAttendance, getSettings } from './storage.js';
import { formatDate, isNonWorkday } from './holidays.js';

/**
 * 15分単位の七捨八入
 */
export function roundMinutes(hours, minutes) {
  if (minutes <= 7) return { h: hours, m: 0 };
  if (minutes <= 22) return { h: hours, m: 15 };
  if (minutes <= 37) return { h: hours, m: 30 };
  if (minutes <= 52) return { h: hours, m: 45 };
  return { h: hours + 1, m: 0 };
}

export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToDisplay(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function calcWorkMinutes(scheduledStart, actualEnd) {
  const startMin = timeToMinutes(scheduledStart);
  const [endH, endM] = actualEnd.split(':').map(Number);
  const rounded = roundMinutes(endH, endM);
  const endMin = rounded.h * 60 + rounded.m;
  return Math.max(0, endMin - startMin);
}

export function getRoundedEndTime(actualEnd) {
  const [h, m] = actualEnd.split(':').map(Number);
  const rounded = roundMinutes(h, m);
  return `${String(rounded.h).padStart(2, '0')}:${String(rounded.m).padStart(2, '0')}`;
}

export function calcDayPay(dateStr, workMinutes) {
  const settings = getSettings();
  const date = new Date(dateStr + 'T00:00:00');
  const wage = isNonWorkday(date) ? settings.weekendWage : settings.weekdayWage;
  // E-08: 日ごとに整数(円)に丸めてから返す → 月間集計での誤差蓄積を防止
  return Math.round((workMinutes / 60) * wage);
}

export function calcMonthlySummary(year, month) {
  const data = getMonthAttendance(year, month);
  let totalMinutes = 0;
  let totalPay = 0;

  for (const [dateStr, entry] of Object.entries(data)) {
    if (entry.status === 'completed' && entry.scheduledStart && entry.actualEnd) {
      const mins = calcWorkMinutes(entry.scheduledStart, entry.actualEnd);
      totalMinutes += mins;
      // E-08: calcDayPay が整数を返すのでそのまま加算
      totalPay += calcDayPay(dateStr, mins);
    }
  }

  return { totalMinutes, totalPay };
}

/**
 * シフト種別判定: 早番 (< 11:00) / 遅番 (>= 11:00)
 */
export function getShiftType(scheduledStart) {
  const [h] = scheduledStart.split(':').map(Number);
  return h < 11 ? 'early' : 'late';
}

export function getShiftLabel(scheduledStart) {
  return getShiftType(scheduledStart) === 'early' ? '早番' : '遅番';
}

/**
 * 自動退勤打刻チェック
 */
export function checkAutoClockOut() {
  const now = new Date();
  const todayStr = formatDate(now);
  const entry = getAttendance(todayStr);

  if (!entry || !entry.scheduledStart) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(entry.scheduledStart);
  if (nowMinutes < startMinutes) return null;
  if (entry.status === 'completed') return null;

  const actualEnd = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const updated = { ...entry, actualEnd, status: 'completed' };
  saveAttendance(todayStr, updated);
  return updated;
}

export function findMissingDays(year, month) {
  const data = getMonthAttendance(year, month);
  const today = new Date();
  const todayStr = formatDate(today);
  const missing = [];

  for (const [dateStr, entry] of Object.entries(data)) {
    if (dateStr < todayStr && entry.status === 'scheduled') {
      missing.push(dateStr);
    }
  }

  return missing.sort();
}
