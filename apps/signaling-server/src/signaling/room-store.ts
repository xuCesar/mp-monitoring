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
      // 一个房间只能有一个采集端，避免两个旧手机同时向同一房间推流。
      if (room.cameraSocketId && room.cameraSocketId !== input.socketId) {
        throw new Error('camera already connected');
      }

      room.cameraSocketId = input.socketId;
    } else {
      // Viewer 数量上限保护旧手机上行和编码压力，重复加入同一 socket 不计入新增人数。
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
