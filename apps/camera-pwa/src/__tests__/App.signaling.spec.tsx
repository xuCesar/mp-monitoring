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

describe('Camera App signaling', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ id: 'video-track' }, { id: 'audio-track' }],
        }),
      },
      configurable: true,
    });
  });

  it('joins as camera and sends an offer when a viewer joins', async () => {
    const socket = createFakeSocket();
    const createOfferForViewer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
    const createCameraSocket = vi.fn(() => socket);

    vi.doMock('../lib/signaling-client', () => ({ createCameraSocket }));
    vi.doMock('../lib/publisher-manager', () => ({
      createPublisherManager: vi.fn(() => ({ createOfferForViewer })),
    }));

    const { App } = await import('../App');

    render(<App />);

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('join-room', {
        roomId: 'camera-01',
        role: 'camera',
        token: 'camera-token',
      });
    });

    await socket.dispatch('viewer-joined', {
      roomId: 'camera-01',
      viewerSocketId: 'viewer-1',
    });

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('offer', {
        roomId: 'camera-01',
        targetSocketId: 'viewer-1',
        sdp: { type: 'offer', sdp: 'offer-sdp' },
      });
    });
  });
});
