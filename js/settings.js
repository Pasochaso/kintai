// settings.js — 設定画面
// E-07: getSettings() 呼び出し最適化（モジュールスコープで状態を保持）

import { getSettings, saveSettings, exportToCSV } from './storage.js';
import { applyTheme } from './app.js';
import { showToast } from './ui.js';

export function initSettings() {
  // E-07: 初回1回だけ読み込み、以降は直接変更して保存
  let s = getSettings();

  // 時給
  const wdInput = document.getElementById('weekday-wage');
  const weInput = document.getElementById('weekend-wage');
  wdInput.value = s.weekdayWage;
  weInput.value = s.weekendWage;

  wdInput.addEventListener('change', () => {
    s.weekdayWage = parseInt(wdInput.value) || 0;
    saveSettings(s);
    showToast('保存しました');
  });
  weInput.addEventListener('change', () => {
    s.weekendWage = parseInt(weInput.value) || 0;
    saveSettings(s);
    showToast('保存しました');
  });

  // デフォルト開始時間
  const earlyInput = document.getElementById('early-start-time');
  const lateInput = document.getElementById('late-start-time');
  earlyInput.value = s.earlyStartTime;
  lateInput.value = s.lateStartTime;

  earlyInput.addEventListener('change', () => {
    s.earlyStartTime = earlyInput.value;
    saveSettings(s);
    showToast('保存しました');
  });
  lateInput.addEventListener('change', () => {
    s.lateStartTime = lateInput.value;
    saveSettings(s);
    showToast('保存しました');
  });

  // ベースカラー
  const baseChips = document.querySelectorAll('.base-chip');
  baseChips.forEach(chip => {
    if (chip.dataset.base === s.baseTheme) chip.classList.add('active');
    chip.addEventListener('click', () => {
      baseChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      s.baseTheme = chip.dataset.base;
      saveSettings(s);
      applyTheme();
    });
  });

  // アクセントカラー
  const accentChips = document.querySelectorAll('.accent-chip');
  accentChips.forEach(chip => {
    if (chip.dataset.accent === s.accentColor) chip.classList.add('active');
    chip.addEventListener('click', () => {
      accentChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      s.accentColor = chip.dataset.accent;
      saveSettings(s);
      applyTheme();
    });
  });

  // CSV
  document.getElementById('btn-export').addEventListener('click', () => {
    exportToCSV();
    showToast('エクスポート完了');
  });
}
