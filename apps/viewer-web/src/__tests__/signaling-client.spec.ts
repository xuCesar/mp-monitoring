import { describe, expect, it, vi } from 'vitest';
import { createViewerSocket } from '../lib/signaling-client';

describe('createViewerSocket', () => {
  it('uses websocket transport to make signaling behavior predictable', () => {
    const ioClient = vi.fn();

    createViewerSocket('http://localhost:3001', 'viewer-token', ioClient);

    expect(ioClient).toHaveBeenCalledWith('http://localhost:3001', {
      auth: { token: 'viewer-token' },
      transports: ['websocket'],
    });
  });
});
