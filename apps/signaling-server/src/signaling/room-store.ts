import { Injectable } from '@nestjs/common';

type RoomRole = 'camera' | 'viewer';

interface RoomState {
  cameraSocketId: string | null;
  viewerSocketIds: Set<string>;
}

@Injectable()
export class RoomStore {
  private readonly rooms = new Map<string, RoomState>();

  constructor(private readonly maxViewersPerRoom: number) {}

  join(input: { roomId: string; role: RoomRole; socketId: string }) {
    const room = this.rooms.get(input.roomId) ?? {
      cameraSocketId: null,
      viewerSocketIds: new Set<string>(),
    };

    if (input.role === 'camera') {
      if (room.cameraSocketId && room.cameraSocketId !== input.socketId) {
        throw new Error('camera already connected');
      }

      room.cameraSocketId = input.socketId;
    } else {
      if (
        !room.viewerSocketIds.has(input.socketId) &&
        room.viewerSocketIds.size >= this.maxViewersPerRoom
      ) {
        throw new Error('viewer limit reached');
      }

      room.viewerSocketIds.add(input.socketId);
    }

    this.rooms.set(input.roomId, room);
    return room;
  }

  getCameraSocketId(roomId: string) {
    return this.rooms.get(roomId)?.cameraSocketId ?? null;
  }
}
