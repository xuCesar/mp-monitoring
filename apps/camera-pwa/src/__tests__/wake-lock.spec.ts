import { describe, expect, it, vi } from 'vitest';
import { requestScreenWakeLock } from '../lib/wake-lock';

describe('requestScreenWakeLock', () => {
  it('returns null when Screen Wake Lock API is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
    });

    await expect(requestScreenWakeLock()).resolves.toBeNull();
  });

  it('requests a screen wake lock when supported', async () => {
    const sentinel = { released: false };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    });

    await expect(requestScreenWakeLock()).resolves.toBe(sentinel);
    expect(request).toHaveBeenCalledWith('screen');
  });
});
