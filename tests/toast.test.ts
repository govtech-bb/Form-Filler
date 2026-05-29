import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast, hideToast } from '../src/content/toast';

const HOST_ID = 'form-filler-toast-host';

function card(): HTMLDivElement | null {
  const host = document.getElementById(HOST_ID);
  return host?.shadowRoot?.querySelector('.card') ?? null;
}

describe('showToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a single toast host with the loading state and message', () => {
    showToast('loading', 'Filling form…');
    expect(document.querySelectorAll(`#${HOST_ID}`).length).toBe(1);
    const c = card()!;
    expect(c.className).toContain('loading');
    expect(c.className).toContain('visible');
    expect(c.textContent).toContain('Filling form…');
    expect(c.querySelector('.spinner')).not.toBeNull();
  });

  it('reuses the same host element across updates', () => {
    showToast('loading', 'Filling form…');
    showToast('success', '✓ 5 fields filled');
    expect(document.querySelectorAll(`#${HOST_ID}`).length).toBe(1);
    expect(card()!.className).toContain('success');
    expect(card()!.textContent).toContain('✓ 5 fields filled');
  });

  it('auto-dismisses a success toast', () => {
    showToast('success', '✓ done');
    expect(card()!.className).toContain('visible');
    vi.advanceTimersByTime(2000); // auto-hide fires
    expect(card()!.className).not.toContain('visible');
    vi.advanceTimersByTime(250); // fade-out removal
    expect(document.getElementById(HOST_ID)).toBeNull();
  });

  it('keeps an error toast on screen until dismissed', () => {
    showToast('error', 'Fill failed');
    vi.advanceTimersByTime(5000);
    expect(card()!.className).toContain('visible');
    expect(card()!.className).toContain('error');

    hideToast();
    vi.advanceTimersByTime(250);
    expect(document.getElementById(HOST_ID)).toBeNull();
  });
});
