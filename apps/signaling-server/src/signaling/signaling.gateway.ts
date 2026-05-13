import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  IceCandidatePayload,
  JoinRoomPayload,
  OfferPayload,
} from '@rtmm/contracts';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { RoomStore } from './room-store';

function readSocketTransports() {
  const configuredTransports = process.env.SOCKET_TRANSPORTS?.split(',')
    .map((transport) => transport.trim())
    .filter((transport) => transport === 'websocket' || transport === 'polling');

  // 本地 HTTPS 隧道可能拦截直连 WebSocket，默认允许 polling 兜底。
  return configuredTransports?.length ? configuredTransports : ['websocket', 'polling'];
}

@WebSocketGateway({
  cors: {
    origin: process.env.SIGNALING_ORIGIN,
  },
  transports: readSocketTransports(),
})
export class SignalingGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly roomStore: RoomStore,
  ) {}

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomPayload,
  ) {
    if (!this.authService.isValidToken(body.role, body.token)) {
      client.emit('error-event', { code: 'UNAUTHORIZED', message: 'invalid token' });
      client.disconnect();
      return;
    }

    try {
      this.roomStore.join({ roomId: body.roomId, role: body.role, socketId: client.id });
      client.join(body.roomId);
    } catch (error) {
      client.emit('error-event', {
        code: 'ROOM_REJECTED',
        message: error instanceof Error ? error.message : 'join room failed',
      });
      client.disconnect();
      return;
    }

    if (body.role === 'viewer') {
      const cameraSocketId = this.roomStore.getCameraSocketId(body.roomId);

      if (cameraSocketId) {
        // Viewer 加入后由服务端定向通知 Camera，由 Camera 发起 offer。
        this.server.to(cameraSocketId).emit('viewer-joined', {
          roomId: body.roomId,
          viewerSocketId: client.id,
        });
      }
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: OfferPayload,
  ) {
    this.server.to(body.targetSocketId).emit('offer', {
      ...body,
      // 由服务端附加真实发送方，避免客户端伪造 sourceSocketId。
      sourceSocketId: client.id,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: OfferPayload,
  ) {
    this.server.to(body.targetSocketId).emit('answer', {
      ...body,
      sourceSocketId: client.id,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: IceCandidatePayload,
  ) {
    this.server.to(body.targetSocketId).emit('ice-candidate', {
      ...body,
      sourceSocketId: client.id,
    });
  }
}
