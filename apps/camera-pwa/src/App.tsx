import { useEffect, useState } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { CameraStatus, type CameraConnectionStatus } from './components/CameraStatus';
import { startCamera } from './lib/camera';

export function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraConnectionStatus>('connecting');

  useEffect(() => {
    void startCamera()
      .then((nextStream) => {
        setStream(nextStream);
        setStatus('live');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  return (
    <main>
      <h1>摄像头采集端</h1>
      <CameraStatus status={status} />
      <CameraPreview stream={stream} />
    </main>
  );
}
