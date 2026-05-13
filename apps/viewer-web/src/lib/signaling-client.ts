import { io, type Socket } from 'socket.io-client';

export type SocketTransport = 'websocket' | 'polling';

interface ViewerSocketOptions {
  auth: {
    token: string;
  };
  transports: SocketTransport[];
}

type ViewerIoClient = (origin: string, options: ViewerSocketOptions) => Socket;

const defaultTransports: SocketTransport[] = ['websocket', 'polling'];

export function parseSocketTransports(value?: string): SocketTransport[] {
  if (!value) {
    return defaultTransports;
  }

  const transports = value
    .split(',')
    .map((transport) => transport.trim())
    .filter((transport): transport is SocketTransport =>
      transport === 'websocket' || transport === 'polling',
    );

  return transports.length > 0 ? transports : defaultTransports;
}

export function createViewerSocket(
  origin: string,
  token: string,
  ioClient: ViewerIoClient = io as ViewerIoClient,
  transports: SocketTransport[] = defaultTransports,
): Socket {
  return ioClient(origin, {
    auth: { token },
    // ngrok/HTTPS 隧道可能拦截直连 WebSocket，开发默认允许 polling 兜底。
    transports,
  });
}
