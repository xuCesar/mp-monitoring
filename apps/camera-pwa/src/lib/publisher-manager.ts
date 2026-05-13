export interface PublisherManagerOptions {
  stream: MediaStream;
  peerFactory?: () => RTCPeerConnection;
  onIceCandidate?: (viewerSocketId: string, candidate: RTCIceCandidateInit) => void;
}

export interface PublisherManager {
  createOfferForViewer(viewerSocketId: string): Promise<RTCSessionDescriptionInit>;
  acceptAnswerFromViewer(viewerSocketId: string, answer: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidateFromViewer(viewerSocketId: string, candidate: RTCIceCandidateInit): Promise<void>;
  getPeer(viewerSocketId: string): RTCPeerConnection | undefined;
}

export function createPublisherManager({
  stream,
  peerFactory = () => new RTCPeerConnection(),
  onIceCandidate,
}: PublisherManagerOptions): PublisherManager {
  const peers = new Map<string, RTCPeerConnection>();

  return {
    async createOfferForViewer(viewerSocketId) {
      const peer = peerFactory();

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          onIceCandidate?.(viewerSocketId, event.candidate.toJSON());
        }
      };

      // 每个 viewer 独立一条 P2P 连接；音视频轨道都会加入同一个 offer。
      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream);
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      peers.set(viewerSocketId, peer);

      return offer;
    },

    async acceptAnswerFromViewer(viewerSocketId, answer) {
      const peer = peers.get(viewerSocketId);
      if (!peer) {
        return;
      }

      await peer.setRemoteDescription(answer);
    },

    async addIceCandidateFromViewer(viewerSocketId, candidate) {
      const peer = peers.get(viewerSocketId);
      if (!peer) {
        return;
      }

      await peer.addIceCandidate(candidate);
    },

    getPeer(viewerSocketId) {
      return peers.get(viewerSocketId);
    },
  };
}
