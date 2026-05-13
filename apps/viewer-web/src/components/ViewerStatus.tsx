export type ViewerConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'error';

const statusLabelMap: Record<ViewerConnectionStatus, string> = {
  connecting: '连接中',
  live: '直播中',
  reconnecting: '重连中',
  offline: '已离线',
  error: '连接失败',
};

export function ViewerStatus({ status }: { status: ViewerConnectionStatus }) {
  return <p>{statusLabelMap[status]}</p>;
}
