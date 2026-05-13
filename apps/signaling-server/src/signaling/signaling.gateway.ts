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

@WebSocketGateway({
  cors: {
    origin: process.env.SIGNALING_ORIGIN,
  },
  transports: ['websocket'],
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
  handleOffer(@MessageBody() body: OfferPayload) {
    this.server.to(body.targetSocketId).emit('offer', body);
  }

  @SubscribeMessage('answer')
  handleAnswer(@MessageBody() body: OfferPayload) {
    this.server.to(body.targetSocketId).emit('answer', body);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(@MessageBody() body: IceCandidatePayload) {
    this.server.to(body.targetSocketId).emit('ice-candidate', body);
  }
}
