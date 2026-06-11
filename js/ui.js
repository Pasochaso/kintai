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
 */
const DRUM_ITEM_H = 36;

export function initDrumRoller(container, items, defaultValue) {
  container.innerHTML = '';

  // 上スペーサー
  const top = document.createElement('div');
  top.className = 'drum-spacer';
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
      container.scrollTo({ top: idx * DRUM_ITEM_H, behavior: 'smooth' });
    });

    container.appendChild(d);
  });

  // 下スペーサー
  const bot = document.createElement('div');
  bot.className = 'drum-spacer';
  container.appendChild(bot);

  // 初期位置
  const defStr = String(defaultValue).padStart(2, '0');
  const idx = items.findIndex(v => String(v).padStart(2, '0') === defStr);
  container.scrollTop = Math.max(0, idx) * DRUM_ITEM_H;

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
 * D-01: スクロール位置を最近傍のアイテムにスナップ
 */
function snapToNearest(container) {
  const ci = Math.round(container.scrollTop / DRUM_ITEM_H);
  const targetTop = ci * DRUM_ITEM_H;
  if (Math.abs(container.scrollTop - targetTop) > 1) {
    container.scrollTo({ top: targetTop, behavior: 'smooth' });
  }
  highlightCenter(container);
}

function highlightCenter(container) {
  const ci = Math.round(container.scrollTop / DRUM_ITEM_H);
  container.querySelectorAll('.drum-item').forEach((el, i) => {
    el.classList.toggle('active', i === ci);
  });
}

export function getDrumValue(container) {
  const ci = Math.round(container.scrollTop / DRUM_ITEM_H);
  const items = container.querySelectorAll('.drum-item');
  return (ci >= 0 && ci < items.length) ? items[ci].dataset.value : '00';
}
