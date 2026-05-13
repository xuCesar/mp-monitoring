import { io, type Socket } from 'socket.io-client';

interface CameraSocketOptions {
  auth: {
    token: string;
  };
  transports: ['websocket'];
}

type CameraIoClient = (origin: string, options: CameraSocketOptions) => Socket;

export function createCameraSocket(
  origin: string,
  token: string,
  ioClient: CameraIoClient = io as CameraIoClient,
): Socket {
  return ioClient(origin, {
    auth: { token },
    // Camera 端同样固定 websocket，避免 polling 降级影响 offer/answer 排障。
    transports: ['websocket'],
  });
}
