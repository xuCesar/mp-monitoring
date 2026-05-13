# AGENTS.md

## 项目定位

本项目是一个家庭/个人自用的旧 Android 手机宝宝看护系统。

首要使用场景：

- 照护者暂时不在宝宝身边时，通过旧 Android 手机持续查看宝宝画面。
- Viewer 端需要能单向监听宝宝声音。
- 首版目标是可真实运行、可维护、可验证的 MVP，而不是通用监控平台。

本项目当前以以下文档为准：

- 设计文档：`docs/superpowers/specs/2026-05-12-android-self-hosted-monitoring-v3-design.md`
- 实施计划：`docs/superpowers/plans/2026-05-13-android-self-hosted-monitoring-mvp.md`

修改项目目标、架构边界、阶段划分或核心链路前，必须先阅读这两份文档。

---

## 当前 MVP 范围

必须支持：

- 单个旧 Android 手机作为 Camera 采集端
- 1-3 个 Viewer 网页端
- 实时视频
- 单向音频监听
- P2P Mesh WebRTC 连接
- TURN 作为跨网失败时的兜底
- 基础鉴权和房间隔离
- OrbStack VM 本地开发
- HTTPS 真机联调

首版明确不做：

- 多摄像头管理
- 多家庭/多租户
- 完整账号体系
- 双向语音对讲
- 录像
- 截图
- AI 检测
- Telegram 通知
- 时间轴回放
- 大规模多人观看
- 首版直接引入 SFU

如需加入上述功能，应先更新设计文档和实施计划，不要直接写实现。

---

## 架构约束

默认架构：

- `apps/camera-pwa`：旧 Android 手机端 PWA，负责采集后置摄像头和麦克风。
- `apps/viewer-web`：观看端网页，负责播放实时视频和单向音频。
- `apps/signaling-server`：NestJS + Socket.IO 信令服务，负责鉴权、房间管理、SDP/ICE 转发、TURN 凭证签发。
- `packages/contracts`：共享类型、信令事件和运行配置契约。
- `nginx`：HTTPS/WSS 入口和反向代理。
- `coturn`：TURN 中继服务。

媒体链路原则：

- 业务服务器不转发视频或音频。
- Camera 与每个 Viewer 建立独立 `RTCPeerConnection`。
- 每条连接默认承载 1 路视频轨道和 1 路音频轨道。
- Camera 是 offer 发起方。
- Viewer 加入房间后，由信令服务通知 Camera：`viewer-joined`。
- Camera 收到 `viewer-joined` 后，为该 Viewer 创建独立 PeerConnection 并发送 offer。

房间约束：

- 首版只有一个逻辑房间。
- 一个房间同一时刻只允许 1 个 Camera。
- 一个房间最多允许 3 个 Viewer。
- 所有信令事件必须限定在房间内定向转发，禁止全局 broadcast。

---

## 开发环境策略

开发阶段优先使用 OrbStack VM，不要求购买 VPS。

推荐阶段：

1. OrbStack 本地开发：完成 monorepo、前后端、信令、Nginx、Coturn、自测和局域网联调。
2. HTTPS 真机联调：通过内网穿透或 HTTPS 隧道，让 Android 真机访问 `camera-pwa` 并验证摄像头和麦克风权限。
3. 可选公网验证：只有需要验证真实跨网、TURN 中继带宽和长时间公网稳定性时，才迁移到单台 VPS。

内网穿透或 HTTPS 隧道可以用于：

- 手机访问本地前端页面
- `getUserMedia` 所需的受信任上下文
- `https` / `wss` 条件下的真机联调

内网穿透或 HTTPS 隧道不能替代：

- 真实公网 NAT 场景验证
- 最终 TURN 中继效果验证
- 长时间公网运行稳定性验证

---

## 技术栈约定

默认使用：

- TypeScript
- pnpm workspace
- React + Vite
- NestJS
- Socket.IO
- WebRTC
- Coturn
- Nginx
- Docker Compose
- Vitest / Jest

不要主动新增依赖。确需新增时，必须说明：

- 解决的具体问题
- 为什么现有工具不足
- 对构建、运行、维护和安全的影响

---

## 实现原则

优先顺序：

1. 先保证宝宝看护核心闭环：能看到宝宝，能听到宝宝。
2. 先完成局域网实时链路，再做 HTTPS 真机联调。
3. 先验证 P2P，再验证 TURN 兜底。
4. 先做稳定性和状态可见性，再扩展录像、AI、通知。

实现时必须保持小步修改：

- 优先按实施计划的 Task 顺序推进。
- 不做无关重构。
- 不把后续阶段功能提前塞进 MVP。
- 不把业务服务器改成媒体转发服务器。
- 不把双向对讲混入首版实现。

编码规范：

- 关键代码或核心业务逻辑必须添加必要注释，注释默认使用中文。
- 注释解释业务意图、边界条件或容易误改的约束，不重复描述代码本身。
- 单个文件的代码逻辑超过 200 行时，应优先考虑按职责拆分。
- 拆分逻辑时保持现有模块边界清晰，不为了拆分而制造过度抽象。

---

## WebRTC 与媒体规则

Camera 端必须：

- 使用后置摄像头。
- 同时申请麦克风权限。
- 使用同一个 `MediaStream` 承载视频轨道和音频轨道。
- 将视频轨道和音频轨道都加入每个 Viewer 对应的 PeerConnection。
- 按 Viewer 维度管理 PeerConnection。
- 处理 Viewer 离开、连接失败和页面恢复后的清理与重连。

Viewer 端必须：

- 使用 `video` 元素播放远端 `MediaStream`，以同时承载视频和音频。
- 明确展示连接状态。
- 至少区分 `connecting`、`live`、`reconnecting`、`offline`、`error`。

首版不做：

- Viewer 到 Camera 的音频回传。
- 多 Viewer 之间的媒体转发。
- SFU。

---

## 安全规则

必须遵守：

- Camera 使用设备令牌。
- Viewer 使用访问令牌或后端签发的短期访问凭证。
- WebSocket 连接和加入房间都要校验权限。
- TURN 凭证必须由服务端短期签发。
- 不在前端写死长期 TURN 用户名和密码。
- 不在前端暴露 MinIO / S3 / Telegram 等长期密钥。
- 生产和真机联调入口必须使用 HTTPS / WSS。
- 日志不得记录 token、密码、TURN secret 等敏感信息。

---

## 稳定性规则

宝宝看护场景下，稳定性优先级高于画面效果。

必须考虑：

- Android 电池优化、后台冻结、Wi-Fi 休眠断开
- PWA 前台常驻假设
- Wake Lock 不是强保证
- 夜间弱光
- 持续音频采集带来的耗电和发热
- 断线重连
- ICE restart
- 心跳超时

推荐默认值：

- `MAX_VIEWERS_PER_ROOM=3`
- `WS_HEARTBEAT_INTERVAL_MS=10000`
- `HEARTBEAT_TIMEOUT_MS=30000`
- `RECONNECT_BACKOFF_MS=1000`
- `RECONNECT_MAX_BACKOFF_MS=30000`
- `SOCKET_TRANSPORTS=websocket`

Socket.IO 客户端应显式使用：

```ts
io(SIGNALING_URL, {
  transports: ['websocket'],
});
```

---

## 测试与验证

实现功能时优先补测试。

至少覆盖：

- 房间只允许 1 个 Camera
- 房间最多允许 3 个 Viewer
- 第 4 个 Viewer 被拒绝
- `viewer-joined` 会触发 Camera 侧 offer 流程
- TURN 短期凭证签发
- Camera 端申请视频和音频
- Camera 端将视频轨道和音频轨道都加入 PeerConnection
- Viewer 端能进入明确连接状态

完成阶段性改动后，优先运行：

```bash
pnpm test
pnpm typecheck
```

真机联调必须验证：

- Android 真机可打开 `camera-pwa`
- 摄像头权限可申请
- 麦克风权限可申请
- Viewer 可看到实时视频
- Viewer 可听到实时音频
- 断网恢复后状态可恢复或能明确显示错误

没有实际运行的验证，不要写成“已通过”。

---

## 文档维护

以下情况必须同步更新设计或计划文档：

- 修改 MVP 范围
- 修改部署阶段
- 引入 VPS 作为前置条件
- 引入 SFU
- 加入双向对讲
- 加入录像、AI、通知或多摄像头
- 修改信令事件契约
- 修改安全模型

小的实现细节变化可以只更新代码和测试；影响架构边界、验收标准或用户场景的变化必须更新文档。
