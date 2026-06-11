// storage.js — localStorage ラッパー (E-03: エラーハンドリング追加, E-12: CSV Blob修正)

const KEYS = {
  settings: 'kintai_settings',
  attendance: 'kintai_attendance',
};

const DEFAULT_SETTINGS = {
  weekdayWage: 1200,
  weekendWage: 1500,
  baseTheme: 'dark',
  accentColor: 'gold',
  earlyStartTime: '09:00',
  lateStartTime: '12:00',
};

// ─── Settings ───

export function getSettings() {
  const raw = localStorage.getItem(KEYS.settings);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // E-03: ストレージ容量超過を通知
      dispatchStorageError('ストレージ容量が不足しています。古いデータを削除してください。');
    }
    return false;
  }
}

// ─── Attendance ───

export function getAllAttendance() {
  const raw = localStorage.getItem(KEYS.attendance);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function getMonthAttendance(year, month) {
  const all = getAllAttendance();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const result = {};
  for (const [date, data] of Object.entries(all)) {
    if (date.startsWith(prefix)) result[date] = data;
  }
  return result;
}

export function getAttendance(dateStr) {
  return getAllAttendance()[dateStr] || null;
}

export function saveAttendance(dateStr, data) {
  try {
    const all = getAllAttendance();
    all[dateStr] = data;
    localStorage.setItem(KEYS.attendance, JSON.stringify(all));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // E-03: ストレージ容量超過を通知
      dispatchStorageError('ストレージ容量が不足しています。CSVエクスポート後に古いデータを削除してください。');
    }
    return false;
  }
}

export function deleteAttendance(dateStr) {
  try {
    const all = getAllAttendance();
    delete all[dateStr];
    localStorage.setItem(KEYS.attendance, JSON.stringify(all));
  } catch {
    // 削除は容量を減らすので失敗することは稀だが念のため
  }
}

// ─── Storage Error Event ───

function dispatchStorageError(message) {
  // カスタムイベントでUIレイヤーに通知
  window.dispatchEvent(new CustomEvent('kintai-storage-error', { detail: { message } }));
}

// ─── CSV Export (E-12: Blob type 末尾セミコロン削除) ───

export function exportToCSV() {
  const all = getAllAttendance();
  const rows = [['日付', '予定開始', '実績退勤', 'ステータス']];
  for (const date of Object.keys(all).sort()) {
    const d = all[date];
    rows.push([date, d.scheduledStart || '', d.actualEnd || '', d.status || '']);
  }
  // E-12: charset=utf-8 (末尾セミコロンなし)
  const blob = new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `勤怠データ_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
