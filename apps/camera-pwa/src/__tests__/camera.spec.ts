import { describe, expect, it, vi } from 'vitest';
import { startCamera } from '../lib/camera';

describe('startCamera', () => {
  it('requests environment-facing video and one-way audio', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ id: 'stream' });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    await startCamera();

    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  });
});
