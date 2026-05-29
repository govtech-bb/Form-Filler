import { ToastState } from '../shared/types';

// A single in-page toast, rendered into a Shadow DOM so the host page's CSS
// can't reach it. Mirrors the popup's dark theme (bg #1a1a2e, dark-blue accent).

const HOST_ID = 'form-filler-toast-host';
const AUTO_HIDE_MS = 2000; // success toasts fade out after this; errors stay until dismissed

let hideTimer: ReturnType<typeof setTimeout> | undefined;

interface ToastRefs {
  card: HTMLDivElement;
  icon: HTMLDivElement;
  text: HTMLSpanElement;
  close: HTMLButtonElement;
}

function getOrCreate(): ToastRefs {
  let host = document.getElementById(HOST_ID);
  if (host) {
    return (host as HTMLElement & { _refs: ToastRefs })._refs;
  }

  host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .card {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 180px;
      max-width: 320px;
      padding: 12px 14px;
      background: #16162b;
      border: 1px solid #34345c;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
      color: #f0f0f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      opacity: 0;
      transform: translateY(-8px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .card.visible { opacity: 1; transform: translateY(0); }
    .card.success { border-color: #46a87d; }
    .card.error { border-color: #d06464; }
    .icon { width: 18px; height: 18px; flex: none; display: flex; align-items: center; justify-content: center; }
    .text { flex: 1; line-height: 1.4; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid #44446e;
      border-top-color: #9db4ff;
      border-radius: 50%;
      animation: ff-spin 0.7s linear infinite;
    }
    .check { color: #6fe3aa; font-size: 17px; font-weight: 700; }
    .cross { color: #ff9292; font-size: 17px; font-weight: 700; }
    .close {
      flex: none;
      background: none; border: none;
      color: #b8b8d0; cursor: pointer;
      font-size: 17px; line-height: 1;
      padding: 0 2px;
      display: none;
    }
    .close:hover { color: #f0f0f6; }
    .card.error .close { display: block; }
    @keyframes ff-spin { to { transform: rotate(360deg); } }
  `;

  const card = document.createElement('div');
  card.className = 'card';

  const icon = document.createElement('div');
  icon.className = 'icon';

  const text = document.createElement('span');
  text.className = 'text';

  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Dismiss');
  close.addEventListener('click', () => hideToast());

  card.append(icon, text, close);
  root.append(style, card);
  document.body.appendChild(host);

  const refs: ToastRefs = { card, icon, text, close };
  (host as HTMLElement & { _refs: ToastRefs })._refs = refs;
  return refs;
}

function renderIcon(icon: HTMLDivElement, state: ToastState): void {
  if (state === 'loading') {
    icon.innerHTML = '<div class="spinner"></div>';
  } else if (state === 'success') {
    icon.innerHTML = '<span class="check">✓</span>';
  } else {
    icon.innerHTML = '<span class="cross">✕</span>';
  }
}

export function showToast(state: ToastState, message: string): void {
  const { card, icon, text } = getOrCreate();

  clearTimeout(hideTimer);
  renderIcon(icon, state);
  text.textContent = message;
  card.className = `card visible ${state}`;

  // Loading stays up; success auto-dismisses; error waits for the close button.
  if (state === 'success') {
    hideTimer = setTimeout(hideToast, AUTO_HIDE_MS);
  }
}

export function hideToast(): void {
  clearTimeout(hideTimer);
  const host = document.getElementById(HOST_ID) as
    | (HTMLElement & { _refs?: ToastRefs })
    | null;
  if (!host?._refs) return;

  const { card } = host._refs;
  card.classList.remove('visible');
  // Remove the host after the fade-out transition completes.
  setTimeout(() => host.remove(), 250);
}
