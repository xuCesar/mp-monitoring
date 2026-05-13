import { describe, expect, it, vi } from 'vitest';
import { createCameraSocket } from '../lib/signaling-client';

describe('createCameraSocket', () => {
  it('uses websocket transport for predictable signaling', () => {
    const ioClient = vi.fn();

    createCameraSocket('http://localhost:3001', 'camera-token', ioClient);

    expect(ioClient).toHaveBeenCalledWith('http://localhost:3001', {
      auth: { token: 'camera-token' },
      transports: ['websocket'],
    });
  });
});
