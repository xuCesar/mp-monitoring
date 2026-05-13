import { io, type Socket } from 'socket.io-client';

interface ViewerSocketOptions {
  auth: {
    token: string;
  };
  transports: ['websocket'];
}

type ViewerIoClient = (origin: string, options: ViewerSocketOptions) => Socket;

export function createViewerSocket(
  origin: string,
  token: string,
  ioClient: ViewerIoClient = io as ViewerIoClient,
): Socket {
  return ioClient(origin, {
    auth: { token },
    // 禁用 polling 降级，让 WebRTC 信令连接行为更可预测，便于真机排障。
    transports: ['websocket'],
  });
}
