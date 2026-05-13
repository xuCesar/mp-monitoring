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

  it('rejects a fourth viewer through the gateway', () => {
    const authService = new AuthService();
    const gateway = new SignalingGateway(authService, new RoomStore(3));
    gateway.server = { to: jest.fn(() => ({ emit: jest.fn() })) } as any;

    gateway.handleJoinRoom(createClient('camera-1') as any, {
      roomId: 'camera-01',
      role: 'camera',
      token: 'camera-token',
    });

    for (const socketId of ['viewer-1', 'viewer-2', 'viewer-3']) {
      gateway.handleJoinRoom(createClient(socketId) as any, {
        roomId: 'camera-01',
        role: 'viewer',
        token: 'viewer-token',
      });
    }

    const fourthViewer = createClient('viewer-4');
    gateway.handleJoinRoom(fourthViewer as any, {
      roomId: 'camera-01',
      role: 'viewer',
      token: 'viewer-token',
    });

    expect(fourthViewer.emit).toHaveBeenCalledWith('error-event', {
      code: 'ROOM_REJECTED',
      message: 'viewer limit reached',
    });
    expect(fourthViewer.disconnect).toHaveBeenCalled();
  });

  it('attaches the sending socket id when forwarding offers', () => {
    const authService = new AuthService();
    const gateway = new SignalingGateway(authService, new RoomStore(3));
    const emit = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit })) } as any;

    gateway.handleOffer(createClient('camera-1') as any, {
      roomId: 'camera-01',
      targetSocketId: 'viewer-1',
      sdp: { type: 'offer', sdp: 'offer-sdp' },
    });

    expect(gateway.server.to).toHaveBeenCalledWith('viewer-1');
    expect(emit).toHaveBeenCalledWith('offer', {
      roomId: 'camera-01',
      targetSocketId: 'viewer-1',
      sourceSocketId: 'camera-1',
      sdp: { type: 'offer', sdp: 'offer-sdp' },
    });
  });
});
