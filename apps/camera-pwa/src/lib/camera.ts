export async function startCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持摄像头采集');
  }

  return navigator.mediaDevices.getUserMedia({
    // 旧 Android 手机作为固定采集端，优先使用后置摄像头观察宝宝状态。
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
    },
    // MVP 只做单向监听：Camera 采集音频，Viewer 播放；不采集 Viewer 麦克风。
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}
