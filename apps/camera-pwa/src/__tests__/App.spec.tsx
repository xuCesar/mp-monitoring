import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Camera App', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows live status after camera stream starts', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ id: 'stream' }) },
      configurable: true,
    });
    vi.doMock('../lib/signaling-client', () => ({
      createCameraSocket: vi.fn(() => ({
        emit: vi.fn(),
        on: vi.fn(),
        disconnect: vi.fn(),
      })),
    }));

    const { App } = await import('../App');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('直播中')).toBeTruthy();
    });
  });
});
