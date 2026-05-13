import { useEffect, useRef } from 'react';

export function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  return <video ref={videoRef} autoPlay muted playsInline />;
}
