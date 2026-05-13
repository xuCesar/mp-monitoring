# Manual Test Checklist

## 局域网链路

1. 启动 `signaling-server`、`viewer-web`、`camera-pwa`。
2. Android 真机打开 `camera-pwa`，允许摄像头和麦克风权限。
3. 桌面浏览器打开 `viewer-web`。
4. 确认 Viewer 状态从“连接中”切到“直播中”，并可听到实时音频。

## HTTPS 真机联调

1. 通过内网穿透或 HTTPS 隧道暴露 `https` 地址。
2. Android 真机通过该地址打开 `camera-pwa`。
3. 确认摄像头和麦克风权限可正常申请。
4. 确认 Viewer 可通过 `wss` 连上 signaling-server。

## 可选跨网链路

1. 在非同一局域网的浏览器中打开 `viewer-web`。
2. 确认 TURN 凭证接口返回 201。
3. 断开本地网络后恢复，确认状态进入“重连中”后恢复。

## 访问控制

1. 使用错误 viewer token 访问。
2. 确认连接被拒绝。
3. 同时打开第 4 个 viewer。
4. 确认收到 `viewer limit reached`。

## 端到端信令顺序

1. Camera 使用 `camera` role 加入房间。
2. Viewer 使用 `viewer` role 加入同一房间。
3. Camera 收到 `viewer-joined`。
4. Camera 向 Viewer 发送 `offer`。
5. Viewer 向 Camera 返回 `answer`。
6. 双方通过 `ice-candidate` 交换 ICE candidate。
