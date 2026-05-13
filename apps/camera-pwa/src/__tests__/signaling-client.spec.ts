import { describe, expect, it, vi } from 'vitest';
import { createCameraSocket } from '../lib/signaling-client';

describe('createCameraSocket', () => {
  it('uses websocket and polling transports by default for tunnel compatibility', () => {
    const ioClient = vi.fn();

    createCameraSocket('http://localhost:3001', 'camera-token', ioClient);

    expect(ioClient).toHaveBeenCalledWith('http://localhost:3001', {
      auth: { token: 'camera-token' },
      transports: ['websocket', 'polling'],
    });
  });

  it('accepts explicit transports when predictable websocket-only behavior is needed', () => {
    const ioClient = vi.fn();

    createCameraSocket('http://localhost:3001', 'camera-token', ioClient, ['websocket']);

    expect(ioClient).toHaveBeenCalledWith('http://localhost:3001', {
      auth: { token: 'camera-token' },
      transports: ['websocket'],
    });
  });
});
