import type {
  IceCandidatePayload,
  JoinRoomPayload,
  RelayedIceCandidatePayload,
  RelayedSessionDescriptionPayload,
  ViewerJoinedPayload,
} from '@rtmm/contracts';
import { useEffect, useState } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { CameraStatus, type CameraConnectionStatus } from './components/CameraStatus';
import { startCamera } from './lib/camera';
import { createPublisherManager } from './lib/publisher-manager';
import { createCameraSocket } from './lib/signaling-client';

function readCameraConfig() {
  return {
    signalingOrigin: import.meta.env.VITE_SIGNALING_ORIGIN ?? window.location.origin,
    roomId: import.meta.env.VITE_ROOM_ID ?? 'camera-01',
    token: import.meta.env.VITE_CAMERA_DEVICE_TOKEN ?? 'camera-token',
  };
}

export function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraConnectionStatus>('connecting');

  useEffect(() => {
    const config = readCameraConfig();
    const socket = createCameraSocket(config.signalingOrigin, config.token);
    let isActive = true;

    void startCamera()
      .then((nextStream) => {
        if (!isActive) {
          return;
        }

        setStream(nextStream);
        setStatus('live');

        const publisherManager = createPublisherManager({
          stream: nextStream,
          onIceCandidate: (viewerSocketId, candidate) => {
            const payload: IceCandidatePayload = {
              roomId: config.roomId,
              targetSocketId: viewerSocketId,
              candidate,
            };
            socket.emit('ice-candidate', payload);
          },
        });
        const joinPayload: JoinRoomPayload = {
          roomId: config.roomId,
          role: 'camera',
          token: config.token,
        };

        socket.emit('join-room', joinPayload);

        socket.on('viewer-joined', (payload: ViewerJoinedPayload) => {
          // viewer-joined 是协商起点：Camera 为每个 Viewer 创建独立 offer。
          void publisherManager.createOfferForViewer(payload.viewerSocketId).then((offer) => {
            socket.emit('offer', {
              roomId: payload.roomId,
              targetSocketId: payload.viewerSocketId,
              sdp: offer,
            });
          });
        });

        socket.on('answer', (payload: RelayedSessionDescriptionPayload) => {
          void publisherManager.acceptAnswerFromViewer(payload.sourceSocketId, payload.sdp);
        });

        socket.on('ice-candidate', (payload: RelayedIceCandidatePayload) => {
          void publisherManager.addIceCandidateFromViewer(
            payload.sourceSocketId,
            payload.candidate,
          );
        });
      })
      .catch(() => {
        setStatus('error');
      });

    socket.on('error-event', () => {
      setStatus('error');
    });

    return () => {
      isActive = false;
      socket.disconnect();
    };
  }, []);

  return (
    <main>
      <h1>摄像头采集端</h1>
      <CameraStatus status={status} />
      <CameraPreview stream={stream} />
    </main>
  );
}
