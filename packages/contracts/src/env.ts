export interface RuntimeEnv {
  roomId: string;
  signalingOrigin: string;
  maxViewersPerRoom: number;
  transports: 'websocket'[];
}
