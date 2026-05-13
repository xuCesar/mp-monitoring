export interface ViewerPeerManagerOptions {
  peerFactory?: () => RTCPeerConnection;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream?: (stream: MediaStream) => void;
}

export interface ViewerPeerManager {
  acceptOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
}

export function createViewerPeerManager({
  peerFactory = () => new RTCPeerConnection(),
  onIceCandidate,
  onRemoteStream,
}: ViewerPeerManagerOptions = {}): ViewerPeerManager {
  const peer = peerFactory();

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate.toJSON());
    }
  };

  peer.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      onRemoteStream?.(stream);
    }
  };

  return {
    async acceptOffer(offer) {
      // Viewer 只响应 Camera 发来的 offer，避免两端同时协商导致 glare。
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      return answer;
    },

    async addIceCandidate(candidate) {
      await peer.addIceCandidate(candidate);
    },
  };
}
