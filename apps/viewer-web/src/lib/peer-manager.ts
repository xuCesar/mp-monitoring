export interface ViewerPeerManagerOptions {
  peerFactory?: () => RTCPeerConnection;
}

export interface ViewerPeerManager {
  acceptOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
}

export function createViewerPeerManager({
  peerFactory = () => new RTCPeerConnection(),
}: ViewerPeerManagerOptions = {}): ViewerPeerManager {
  const peer = peerFactory();

  return {
    async acceptOffer(offer) {
      // Viewer 只响应 Camera 发来的 offer，避免两端同时协商导致 glare。
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      return answer;
    },
  };
}
