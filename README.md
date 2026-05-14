# Real-Time Mobile Monitoring

旧 Android 手机复用为宝宝状态监控 Camera PWA，家人通过 Viewer Web 实时查看视频并单向监听音频。

## 当前能力

- 单个 Camera PWA 采集视频和音频。
- 1-3 个 Viewer Web 观看端。
- WebRTC P2P Mesh，Camera 为 offer 发起方。
- NestJS + Socket.IO signaling，不转发媒体流。
- Coturn 短期凭证接口和 Docker Compose 部署配置。
- Viewer 路由为 `/`，Camera PWA 路由为 `/camera/`。

## 架构

```text
Android Camera PWA
  -> getUserMedia(video + audio)
  -> Socket.IO signaling
  -> WebRTC offer / ICE
  -> Viewer Web

signaling-server
  -> join-room / viewer-joined / offer / answer / ice-candidate
  -> /health
  -> /turn-credentials

coturn
  -> TURN fallback for cross-network WebRTC
```

## 项目结构

```text
apps/
  camera-pwa/        Android 采集端 PWA
  viewer-web/        Web 观看端
  signaling-server/  NestJS signaling 和 TURN API
packages/
  contracts/         前后端共享类型
coturn/              Coturn 配置
nginx/               反向代理配置
docs/                设计文档和手动测试清单
```

## 环境要求

- Node.js 22+
- pnpm 10
- Docker / Docker Compose
- Android Chrome 真机测试时需要 HTTPS，或使用 `adb reverse` / localhost 安全上下文。

## 安装

```bash
pnpm install
```

创建本地 `.env`：

```bash
cp .env.example .env
```

本地开发建议先使用固定 dev token：

```env
SIGNALING_ORIGIN=*
CAMERA_DEVICE_TOKEN=camera-token
VIEWER_ACCESS_TOKEN=viewer-token
VITE_CAMERA_DEVICE_TOKEN=camera-token
VITE_VIEWER_ACCESS_TOKEN=viewer-token
VITE_ROOM_ID=camera-01
VITE_SOCKET_TRANSPORTS=websocket,polling
```

`VITE_SIGNALING_ORIGIN` 必须是 Camera 和 Viewer 都能访问到的 signaling 地址，例如：

```env
VITE_SIGNALING_ORIGIN=http://192.168.3.236:3000
```

## 本地开发

分别启动三个服务：

```bash
pnpm --filter signaling-server start:dev
```

```bash
pnpm --filter camera-pwa dev -- --host 0.0.0.0 --port 5174
```

```bash
pnpm --filter viewer-web dev -- --host 0.0.0.0 --port 5173
```

访问：

```text
Camera PWA: http://<局域网 IP>:5174
Viewer Web: http://<局域网 IP>:5173
Health:     http://<局域网 IP>:3000/health
```

如果用 HTTPS 隧道或 ngrok，建议：

```env
VITE_SIGNALING_ORIGIN=https://你的-signaling-域名
VITE_SOCKET_TRANSPORTS=websocket,polling
SOCKET_TRANSPORTS=websocket,polling
```

## Docker 部署

服务器 `.env` 示例：

```env
SIGNALING_PORT=3000
SIGNALING_ORIGIN=https://monitor.example.com
ROOM_ID=camera-01
MAX_VIEWERS_PER_ROOM=3

CAMERA_DEVICE_TOKEN=replace-with-strong-random-value
VIEWER_ACCESS_TOKEN=replace-with-strong-random-value

TURN_SECRET=replace-with-strong-random-value
TURN_REALM=monitor.example.com
TURN_TTL_SECONDS=3600
TURN_URLS=turn:monitor.example.com:3478?transport=udp,turn:monitor.example.com:3478?transport=tcp

SOCKET_TRANSPORTS=websocket,polling

VITE_SIGNALING_ORIGIN=https://monitor.example.com
VITE_ROOM_ID=camera-01
VITE_CAMERA_DEVICE_TOKEN=同 CAMERA_DEVICE_TOKEN
VITE_VIEWER_ACCESS_TOKEN=同 VIEWER_ACCESS_TOKEN
VITE_SOCKET_TRANSPORTS=websocket,polling
```

启动：

```bash
docker compose up -d --build
```

验证：

```bash
docker compose ps
curl http://127.0.0.1/api/health
```

访问：

```text
Viewer: https://monitor.example.com/
Camera: https://monitor.example.com/camera/
```

当前 compose 暴露 `80/tcp`。生产 HTTPS 可在服务器外层使用 Caddy、Nginx、云厂商证书服务或负载均衡终止 TLS。

## 服务器端口

基础访问：

```text
80/tcp
443/tcp
```

TURN：

```text
3478/tcp
3478/udp
```

完整 TURN relay 建议额外开放并在 Coturn 中配置 relay 端口范围：

```text
49152-65535/udp
```

## 测试与构建

```bash
pnpm test
pnpm typecheck
pnpm build
```

单独运行：

```bash
pnpm --filter signaling-server test
pnpm --filter viewer-web test
pnpm --filter camera-pwa test
```

## 手动联调

完整清单见 [docs/manual-test-checklist.md](docs/manual-test-checklist.md)。

关键路径：

1. Camera 打开 `/camera/` 并允许摄像头、麦克风权限。
2. Viewer 打开 `/`。
3. Camera 加入房间。
4. Viewer 加入同一房间。
5. signaling-server 通知 Camera `viewer-joined`。
6. Camera 发 `offer`。
7. Viewer 回 `answer`。
8. 双方交换 ICE candidate。

## 常见问题

### Camera 有画面但显示连接失败

通常是 signaling join-room 被拒绝或 Socket.IO 连接失败。检查：

- `CAMERA_DEVICE_TOKEN` 是否等于 `VITE_CAMERA_DEVICE_TOKEN`
- `SIGNALING_ORIGIN` 是否允许当前页面来源
- `VITE_SIGNALING_ORIGIN` 是否是 Camera 真机可访问地址
- `/health` 是否返回 `{"ok":true}`

### Viewer 一直显示连接中

通常是 Viewer 没有收到 offer。检查：

- Camera 是否已经加入同一 `VITE_ROOM_ID`
- Viewer token 是否正确
- 浏览器 Network 中 `/socket.io/` 是否连接成功
- ngrok 等隧道下是否设置 `VITE_SOCKET_TRANSPORTS=websocket,polling`

### ngrok WebSocket 失败

`/health` 正常但 `wss://.../socket.io` 失败时，先允许 polling fallback：

```env
SOCKET_TRANSPORTS=websocket,polling
VITE_SOCKET_TRANSPORTS=websocket,polling
```

重启 signaling-server、camera-pwa、viewer-web。

### 公网 IP 测试仍没有画面

跨网 WebRTC 不只需要 signaling，还需要 STUN/TURN 可达。确保：

- 域名已解析到服务器公网 IP
- 服务器安全组开放 `3478/tcp` 和 `3478/udp`
- `TURN_URLS` 指向公网域名
- coturn 使用与 `/turn-credentials` 相同的 `TURN_SECRET`

## 安全注意

- 不要把真实 `.env` 提交到仓库。
- `CAMERA_DEVICE_TOKEN`、`VIEWER_ACCESS_TOKEN`、`TURN_SECRET` 必须使用强随机值。
- 生产环境不要长期使用 `SIGNALING_ORIGIN=*`。
- 当前 MVP 不包含录像、AI 分析、多 Camera 管理和用户系统。
