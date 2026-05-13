export type SocketRole = 'camera' | 'viewer';

export interface JoinRoomPayload {
  roomId: string;
  role: SocketRole;
  token: string;
}

export interface OfferPayload {
  roomId: string;
  targetSocketId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface RelayedSessionDescriptionPayload extends OfferPayload {
  sourceSocketId: string;
}

export interface IceCandidatePayload {
  roomId: string;
  targetSocketId: string;
  candidate: RTCIceCandidateInit;
}

export interface RelayedIceCandidatePayload extends IceCandidatePayload {
  sourceSocketId: string;
}

export interface ViewerJoinedPayload {
  roomId: string;
  viewerSocketId: string;
}

export interface TurnCredentialsResponse {
  urls: string[];
  username: string;
  credential: string;
  ttlSeconds: number;
}
