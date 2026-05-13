import { Module } from '@nestjs/common';
import { AuthService } from './auth/auth.service';
import { HealthController } from './health.controller';
import { RoomStore } from './signaling/room-store';
import { SignalingGateway } from './signaling/signaling.gateway';
import { TurnController } from './turn.controller';

@Module({
  controllers: [HealthController, TurnController],
  providers: [
    AuthService,
    SignalingGateway,
    {
      provide: RoomStore,
      useFactory: () => new RoomStore(Number(process.env.MAX_VIEWERS_PER_ROOM ?? 3)),
    },
  ],
})
export class AppModule {}
