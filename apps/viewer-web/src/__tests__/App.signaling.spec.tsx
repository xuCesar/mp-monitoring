import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SocketHandler = (payload: unknown) => void | Promise<void>;

function createFakeSocket() {
  const handlers = new Map<string, SocketHandler>();

  return {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: SocketHandler) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
    dispatch(event: string, payload: unknown) {
      return handlers.get(event)?.(payload);
    },
  };
}

describe('Viewer App signaling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('joins as viewer and answers an incoming offer', async () => {
    const socket = createFakeSocket();
    const acceptOffer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' });
    const createViewerSocket = vi.fn(() => socket);

    vi.doMock('../lib/signaling-client', () => ({
      createViewerSocket,
      parseSocketTransports: vi.fn(() => ['websocket', 'polling']),
    }));
    vi.doMock('../lib/peer-manager', () => ({
      createViewerPeerManager: vi.fn(() => ({ acceptOffer })),
    }));

    const { App } = await import('../App');

    render(<App />);

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('join-room', {
        roomId: 'camera-01',
        role: 'viewer',
        token: 'viewer-token',
      });
    });

    await socket.dispatch('offer', {
      roomId: 'camera-01',
      sourceSocketId: 'camera-1',
      targetSocketId: 'viewer-1',
      sdp: { type: 'offer', sdp: 'offer-sdp' },
    });

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('answer', {
        roomId: 'camera-01',
        targetSocketId: 'camera-1',
        sdp: { type: 'answer', sdp: 'answer-sdp' },
      });
    });
  });

  it('shows an error when signaling connection fails', async () => {
    const socket = createFakeSocket();
    const createViewerSocket = vi.fn(() => socket);

    vi.doMock('../lib/signaling-client', () => ({
      createViewerSocket,
      parseSocketTransports: vi.fn(() => ['websocket', 'polling']),
    }));

    const { App } = await import('../App');
    const { screen } = await import('@testing-library/react');

    render(<App />);
    await socket.dispatch('connect_error', new Error('websocket failed'));

    await waitFor(() => {
      expect(screen.getByText('连接失败')).toBeTruthy();
    });
  });
});
