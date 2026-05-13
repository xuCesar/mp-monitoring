export interface PublisherManagerOptions {
  stream: MediaStream;
  peerFactory?: () => RTCPeerConnection;
}

export interface PublisherManager {
  createOfferForViewer(viewerSocketId: string): Promise<RTCSessionDescriptionInit>;
  getPeer(viewerSocketId: string): RTCPeerConnection | undefined;
}

export function createPublisherManager({
  stream,
  peerFactory = () => new RTCPeerConnection(),
}: PublisherManagerOptions): PublisherManager {
  const peers = new Map<string, RTCPeerConnection>();

  return {
    async createOfferForViewer(viewerSocketId) {
      const peer = peerFactory();

      // 每个 viewer 独立一条 P2P 连接；音视频轨道都会加入同一个 offer。
      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream);
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      peers.set(viewerSocketId, peer);

      return offer;
    },

    getPeer(viewerSocketId) {
      return peers.get(viewerSocketId);
    },
  };
}
