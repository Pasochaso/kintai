// ui.js — 共有UIユーティリティ
// D-01: ドラムローラーにタップ選択 + scrollend スナップ強化
// E-11: animateCounter に aria-live 対応

/**
 * カウントアップアニメーション (E-11: aria-live対応)
 */
export function animateCounter(element, targetValue, prefix = '', suffix = '') {
  // E-11: アニメーション中はaria-busyを設定し、完了時のみ読み上げ
  element.setAttribute('aria-busy', 'true');
  const duration = 1200;
  const start = performance.now();
  function update(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    element.textContent = `${prefix}${Math.round(targetValue * eased).toLocaleString()}${suffix}`;
    if (p < 1) {
      requestAnimationFrame(update);
    } else {
      element.setAttribute('aria-busy', 'false');
    }
  }
  requestAnimationFrame(update);
}

/**
 * トースト通知
 */
export function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/**
 * セルをハイライトするアニメーション (D-03: 保存/削除フィードバック)
 */
export function flashElement(element, type = 'save') {
  if (!element) return;
  const cls = type === 'save' ? 'flash-save' : 'flash-delete';
  element.classList.remove('flash-save', 'flash-delete');
  // 一フレーム後に追加することで再トリガーを可能にする
  requestAnimationFrame(() => {
    element.classList.add(cls);
    setTimeout(() => element.classList.remove(cls), 600);
  });
}

/**
 * ドラムローラー（15分単位対応）
 * D-01: スナップ強化 + タップで直接選択
 * スペーサーの高さを DRUM_ITEM_H * 2 に固定し、
 * scrollTop 計算でスペーサー分のオフセットを正しく考慮する。
 */
const DRUM_ITEM_H = 36;
const DRUM_SPACER_H = DRUM_ITEM_H * 2;

export function initDrumRoller(container, items, defaultValue) {
  container.innerHTML = '';

  // 上スペーサー（中央表示用の余白）
  const top = document.createElement('div');
  top.className = 'drum-spacer';
  top.style.height = `${DRUM_SPACER_H}px`;
  top.style.minHeight = `${DRUM_SPACER_H}px`;
  container.appendChild(top);

  // アイテム
  items.forEach((val, idx) => {
    const d = document.createElement('div');
    d.className = 'drum-item';
    d.textContent = String(val).padStart(2, '0');
    d.dataset.value = String(val).padStart(2, '0');
    d.dataset.index = idx;

    // D-01: タップで直接選択
    d.addEventListener('click', () => {
      container.scrollTo({ top: idx * DRUM_ITEM_H + DRUM_SPACER_H, behavior: 'smooth' });
    });

    container.appendChild(d);
  });

  // 下スペーサー
  const bot = document.createElement('div');
  bot.className = 'drum-spacer';
  bot.style.height = `${DRUM_SPACER_H}px`;
  bot.style.minHeight = `${DRUM_SPACER_H}px`;
  container.appendChild(bot);

  // 初期位置
  const defStr = String(defaultValue).padStart(2, '0');
  const idx = items.findIndex(v => String(v).padStart(2, '0') === defStr);
  container.scrollTop = Math.max(0, idx) * DRUM_ITEM_H + DRUM_SPACER_H;

  // D-01: スクロール終了後にプログラム的にスナップ位置を補正
  let scrollTimer;
  let isSnapping = false;

  container.addEventListener('scroll', () => {
    if (isSnapping) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      snapToNearest(container);
    }, 80);
    highlightCenter(container);
  }, { passive: true });

  requestAnimationFrame(() => highlightCenter(container));
}

/**
 * スクロール位置からアイテムインデックスを算出（スペーサーオフセット考慮）
 */
function scrollTopToIndex(scrollTop) {
  return Math.round((scrollTop - DRUM_SPACER_H) / DRUM_ITEM_H);
}

/**
 * D-01: スクロール位置を最近傍のアイテムにスナップ
 */
function snapToNearest(container) {
  const ci = scrollTopToIndex(container.scrollTop);
  const items = container.querySelectorAll('.drum-item');
  const clampedIndex = Math.max(0, Math.min(ci, items.length - 1));
  const targetTop = clampedIndex * DRUM_ITEM_H + DRUM_SPACER_H;
  if (Math.abs(container.scrollTop - targetTop) > 1) {
    container.scrollTo({ top: targetTop, behavior: 'smooth' });
  }
  highlightCenter(container);
}

function highlightCenter(container) {
  const ci = scrollTopToIndex(container.scrollTop);
  container.querySelectorAll('.drum-item').forEach((el, i) => {
    el.classList.toggle('active', i === ci);
  });
}

export function getDrumValue(container) {
  const ci = scrollTopToIndex(container.scrollTop);
  const items = container.querySelectorAll('.drum-item');
  const clampedIndex = Math.max(0, Math.min(ci, items.length - 1));
  return items[clampedIndex]?.dataset.value ?? '00';
}

