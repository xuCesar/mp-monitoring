import { describe, expect, it } from '@jest/globals';
import { RoomStore } from '../src/signaling/room-store';

describe('RoomStore', () => {
  it('rejects a second camera in the same room', () => {
    const store = new RoomStore(3);
    store.join({ roomId: 'camera-01', role: 'camera', socketId: 'camera-1' });

    expect(() =>
      store.join({ roomId: 'camera-01', role: 'camera', socketId: 'camera-2' }),
    ).toThrow('camera already connected');
  });

  it('rejects the fourth viewer in the same room', () => {
    const store = new RoomStore(3);
    store.join({ roomId: 'camera-01', role: 'camera', socketId: 'camera-1' });
    store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-1' });
    store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-2' });
    store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-3' });

    expect(() =>
      store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-4' }),
    ).toThrow('viewer limit reached');
  });
});
