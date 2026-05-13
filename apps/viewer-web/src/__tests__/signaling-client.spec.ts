import { describe, expect, it, vi } from 'vitest';
import { createViewerSocket } from '../lib/signaling-client';

describe('createViewerSocket', () => {
  it('uses websocket and polling transports by default for tunnel compatibility', () => {
    const ioClient = vi.fn();

    createViewerSocket('http://localhost:3001', 'viewer-token', ioClient);

    expect(ioClient).toHaveBeenCalledWith('http://localhost:3001', {
      auth: { token: 'viewer-token' },
      transports: ['websocket', 'polling'],
    });
  });

  it('accepts explicit transports when predictable websocket-only behavior is needed', () => {
    const ioClient = vi.fn();

    createViewerSocket('http://localhost:3001', 'viewer-token', ioClient, ['websocket']);

    expect(ioClient).toHaveBeenCalledWith('http://localhost:3001', {
      auth: { token: 'viewer-token' },
      transports: ['websocket'],
    });
  });
});
