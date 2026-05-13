import { describe, expect, it, jest } from '@jest/globals';
import { AuthService } from '../src/auth/auth.service';
import { RoomStore } from '../src/signaling/room-store';
import { SignalingGateway } from '../src/signaling/signaling.gateway';

beforeEach(() => {
  process.env.CAMERA_DEVICE_TOKEN = 'camera-token';
  process.env.VIEWER_ACCESS_TOKEN = 'viewer-token';
});

function createClient(id: string) {
  return {
    id,
    emit: jest.fn(),
    join: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('SignalingGateway', () => {
  it('emits viewer-joined to camera when a viewer joins', () => {
    const authService = new AuthService();
    const gateway = new SignalingGateway(authService, new RoomStore(3));
    const emit = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit })) } as any;

    const camera = createClient('camera-1');
    const viewer = createClient('viewer-1');

    gateway.handleJoinRoom(camera as any, {
      roomId: 'camera-01',
      role: 'camera',
      token: 'camera-token',
    });
    gateway.handleJoinRoom(viewer as any, {
      roomId: 'camera-01',
      role: 'viewer',
      token: 'viewer-token',
    });

    expect(gateway.server.to).toHaveBeenCalledWith('camera-1');
    expect(emit).toHaveBeenCalledWith('viewer-joined', {
      roomId: 'camera-01',
      viewerSocketId: 'viewer-1',
    });
  });

  it('disconnects clients with invalid tokens', () => {
    const authService = new AuthService();
    const gateway = new SignalingGateway(authService, new RoomStore(3));
    const client = createClient('viewer-1');

    gateway.handleJoinRoom(client as any, {
      roomId: 'camera-01',
      role: 'viewer',
      token: 'bad-token',
    });

    expect(client.emit).toHaveBeenCalledWith('error-event', {
      code: 'UNAUTHORIZED',
      message: 'invalid token',
    });
    expect(client.disconnect).toHaveBeenCalled();
  });
});
