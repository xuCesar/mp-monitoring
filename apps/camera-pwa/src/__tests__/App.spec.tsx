import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

describe('Camera App', () => {
  it('shows live status after camera stream starts', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ id: 'stream' }) },
      configurable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('直播中')).toBeTruthy();
    });
  });
});
