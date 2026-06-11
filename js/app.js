// app.js — メインアプリケーション
// E-13: navigate() にターゲット許可リストバリデーション追加
// E-03: ストレージエラーイベントのリスナー追加

import { initHome, renderHome } from './home.js';
import { initCalendar } from './calendar.js';
import { initSettings } from './settings.js';
import { getSettings } from './storage.js';
import { showToast } from './ui.js';

// E-13: 許可されたターゲット画面の一覧
const VALID_TARGETS = new Set(['home', 'calendar', 'settings']);

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  initHome();
  initCalendar();
  initSettings();
  setupNavigation();
  registerServiceWorker();

  // E-03: ストレージエラーをトーストで通知
  window.addEventListener('kintai-storage-error', (e) => {
    showToast(`⚠️ ${e.detail.message}`, 5000);
  });
});

export function applyTheme() {
  const settings = getSettings();
  document.documentElement.setAttribute('data-base', settings.baseTheme);
  document.documentElement.setAttribute('data-accent', settings.accentColor);

  const themeColors = {
    dark: '#0A0A0A',
    darkgray: '#1A1A1E',
    white: '#FAFAFA',
    cream: '#F5EFE0',
    brown: '#110E0B',
  };
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = themeColors[settings.baseTheme] || '#0A0A0A';
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');

  function navigate(target) {
    // E-13: 許可リストでバリデーション
    if (!VALID_TARGETS.has(target)) target = 'home';

    screens.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    document.getElementById(target)?.classList.add('active');
    // E-13: querySelector に直接ハッシュ値を渡さず data属性で安全に参照
    navItems.forEach(n => {
      if (n.dataset.target === target) n.classList.add('active');
    });
    if (target === 'home') renderHome();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const t = item.dataset.target;
      if (!VALID_TARGETS.has(t)) return;
      window.location.hash = t;
      navigate(t);
    });
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    navigate(VALID_TARGETS.has(hash) ? hash : 'home');
  });
  const initialHash = window.location.hash.slice(1);
  navigate(VALID_TARGETS.has(initialHash) ? initialHash : 'home');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}
