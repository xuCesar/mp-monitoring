export type CameraConnectionStatus = 'connecting' | 'live' | 'error';

const statusLabelMap: Record<CameraConnectionStatus, string> = {
  connecting: '连接中',
  live: '直播中',
  error: '连接失败',
};

export function CameraStatus({ status }: { status: CameraConnectionStatus }) {
  return <p>{statusLabelMap[status]}</p>;
}
