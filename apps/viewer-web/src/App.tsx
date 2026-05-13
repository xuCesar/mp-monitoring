import type {
  IceCandidatePayload,
  JoinRoomPayload,
  RelayedIceCandidatePayload,
  RelayedSessionDescriptionPayload,
} from '@rtmm/contracts';
import { useEffect, useRef, useState } from 'react';
import { RemoteVideo } from './components/RemoteVideo';
import { ViewerStatus, type ViewerConnectionStatus } from './components/ViewerStatus';
import { createViewerPeerManager, type ViewerPeerManager } from './lib/peer-manager';
import { createViewerSocket } from './lib/signaling-client';

function readViewerConfig() {
  return {
    signalingOrigin: import.meta.env.VITE_SIGNALING_ORIGIN ?? window.location.origin,
    roomId: import.meta.env.VITE_ROOM_ID ?? 'camera-01',
    token: import.meta.env.VITE_VIEWER_ACCESS_TOKEN ?? 'viewer-token',
  };
}

export function App() {
  const [status, setStatus] = useState<ViewerConnectionStatus>('connecting');
  const [remoteStream, setRemoteStream] = useState<MediaStream | undefined>();
  const cameraSocketIdRef = useRef<string | null>(null);
  const peerManagerRef = useRef<ViewerPeerManager | null>(null);

  useEffect(() => {
    const config = readViewerConfig();
    const socket = createViewerSocket(config.signalingOrigin, config.token);
    const joinPayload: JoinRoomPayload = {
      roomId: config.roomId,
      role: 'viewer',
      token: config.token,
    };

    socket.emit('join-room', joinPayload);

    socket.on('offer', (payload: RelayedSessionDescriptionPayload) => {
      cameraSocketIdRef.current = payload.sourceSocketId;
      peerManagerRef.current ??= createViewerPeerManager({
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          setStatus('live');
        },
        onIceCandidate: (candidate) => {
          const cameraSocketId = cameraSocketIdRef.current;
          if (!cameraSocketId) {
            return;
          }

          const candidatePayload: IceCandidatePayload = {
            roomId: config.roomId,
            targetSocketId: cameraSocketId,
            candidate,
          };
          socket.emit('ice-candidate', candidatePayload);
        },
      });

      void peerManagerRef.current.acceptOffer(payload.sdp).then((answer) => {
        socket.emit('answer', {
          roomId: payload.roomId,
          targetSocketId: payload.sourceSocketId,
          sdp: answer,
        });
      });
    });

    socket.on('ice-candidate', (payload: RelayedIceCandidatePayload) => {
      void peerManagerRef.current?.addIceCandidate(payload.candidate);
    });

    socket.on('error-event', () => {
      setStatus('error');
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main>
      <h1>实时监控</h1>
      <ViewerStatus status={status} />
      <RemoteVideo stream={remoteStream} />
    </main>
  );
}
