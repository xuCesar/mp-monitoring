# Android 旧手机自建实时监控方案 v3

> 文档定位：可直接开工版设计文档
>
> 目标读者：以 TypeScript / React / NestJS 为主的个人开发者
>
> 默认场景：家庭/个人自用，单摄像头，1-3 个观看端；开发阶段使用 OrbStack VM，公网验证/部署阶段使用单台 VPS + Docker Compose
>
> 首要使用场景：照护者暂时不在宝宝身边时，通过旧 Android 手机持续查看宝宝画面，并单向监听宝宝声音

---

## 1. 文档目标

本文档用于将前两版方案收敛为一份可执行的工程设计，重点解决以下问题：

- 明确 MVP 范围，避免首版需求扩散
- 明确实时链路的架构边界和角色模型
- 明确安全、稳定性、部署和验收标准
- 为后续实现拆解提供一致的约束基础

本文档不是产品宣传稿，也不是最终实现计划。它的作用是先把“做什么、为什么这么做、边界在哪里”说清楚。

---

## 2. 目标范围

### 2.1 本版目标

本版系统目标固定为：

- 使用旧 Android 手机作为单一摄像头采集端
- 提供 1-3 个网页观看端的低延迟实时观看与单向音频监听能力
- 支持跨网络访问
- 支持家庭/个人自用场景下的基础访问控制
- 开发阶段优先使用 OrbStack VM，本地验证完成后再按需迁移到单台 VPS 自托管部署
- 优先保证真实可跑、易排障、易迭代

### 2.2 非目标

以下内容不进入首版 MVP 主链路：

- 多摄像头管理
- 多家庭/多租户
- 完整账号体系与复杂权限模型
- 时间轴回放
- AI 检测
- 云同步
- 原生 Android App
- 大规模多人观看
- 双向语音对讲

这些内容可以作为后续阶段扩展，但不应影响首版的实时链路落地。

---

## 3. 核心约束与设计原则

### 3.1 核心约束

- 采集端是旧 Android 手机，性能、电池、散热和系统后台限制都不稳定
- 宝宝看护场景下，音频和视频都属于关键链路，不能只验证画面不验证声音
- 观看端数量上限为 3 个，不能假设支持大规模分发
- 服务端资源优先节省，不引入首版不必要的媒体中转复杂度
- 需要跨网可用，不能只在局域网内可跑
- 所有生产访问必须基于 HTTPS / WSS

### 3.2 设计原则

- 先保证实时链路稳定，再扩展录像、AI、设备管理
- 先选低复杂度方案，必要时为后续扩展预留演进路径
- 敏感凭证不下发到前端
- 服务端只承担必要职责，不主动成为首版视频转发核心
- 所有“长期运行”能力都必须被视为风险项，而不是默认成立

---

## 4. 推荐方案与取舍

### 4.1 备选方案

#### 方案 A：纯 P2P Mesh

手机端分别与每个观看端建立独立 WebRTC 连接，信令服务器只交换 SDP 和 ICE。

优点：

- 实现简单
- 成本低
- 首版迭代快

缺点：

- 跨网穿透失败率高
- 每增加一个观看端，手机都要多承担一路上行和编码压力

#### 方案 B：P2P Mesh + TURN 兜底

默认仍走 P2P；当 NAT 穿透失败时，自动回退到 TURN 中继。

优点：

- 保持首版实现复杂度可控
- 能覆盖跨网访问的现实场景
- 对 1-3 个观看端是合理平衡

缺点：

- TURN 会增加带宽成本
- 信令与运维复杂度高于纯 P2P

#### 方案 C：直接上 SFU

手机只上传一路流到 SFU，再由 SFU 分发给多个观看端。

优点：

- 多观看端扩展性更好

缺点：

- 首版复杂度明显过高
- 部署、运维、调试成本都更大
- 不符合当前 1-3 个观看端的约束

### 4.2 推荐方案

本版采用：

**P2P Mesh + TURN 兜底**

理由：

- 适合当前“单摄像头 + 1-3 个观看端”的目标
- 比纯 P2P 更接近真实可用
- 比直接上 SFU 更容易首版落地
- 后续若观看端规模增长，可以再演进到 SFU

---

## 5. 总体架构

### 5.1 架构概览

```text
Android 手机（Camera PWA）
        │
        │ HTTPS / WSS
        ▼
Nginx 反向代理
        │
        ├── Viewer Web（静态前端）
        ├── Signaling Server（NestJS + Socket.IO）
        └── TURN Credentials API（由 NestJS 提供）

WebRTC 媒体链路：
Camera PWA ───── Viewer 1
Camera PWA ───── Viewer 2
Camera PWA ───── Viewer 3

P2P 失败时：
Camera PWA ─ TURN (Coturn) ─ Viewer
```

### 5.2 组件职责

#### `camera-pwa`

职责：

- 获取摄像头和麦克风权限，并展示本地预览
- 作为唯一采集端连接到指定房间
- 与每个 viewer 建立独立 PeerConnection，并发送视频轨道和音频轨道
- 维护心跳、重连、页面恢复后的重新协商

不负责：

- 保存长期敏感凭证
- 直接持有 MinIO / Telegram / TURN 长期密钥

#### `viewer-web`

职责：

- 完成基础访问鉴权
- 加入房间并接收实时视频与单向音频
- 显示连接状态和错误状态
- 支持最多 3 个观看端并发观看

不负责：

- 媒体处理核心逻辑
- 长期密钥管理

#### `signaling-server`

职责：

- 管理 WebSocket 连接
- 校验用户身份和房间访问权限
- 管理角色：`camera` / `viewer`
- 交换 offer / answer / ICE candidate
- 提供在线状态和基础事件日志
- 提供短期 TURN 凭证签发接口

不负责：

- 首版不直接转发视频流
- 首版不承担录像处理

#### `turn-server`

职责：

- 在 P2P 穿透失败时中继 WebRTC 媒体流

#### `nginx`

职责：

- TLS 终止
- 静态资源分发
- WSS / WebSocket 反向代理

#### `minio`

职责：

- 后续录像阶段的对象存储

说明：

- MinIO 不进入首版实时链路关键路径

---

## 6. 连接模型

### 6.1 房间模型

首版只支持单个逻辑房间，对应一个固定摄像头。

建议抽象：

- `cameraId`：摄像头唯一标识
- `roomId`：房间标识，可与 cameraId 绑定
- `role`：`camera` 或 `viewer`

约束：

- 一个房间同一时刻只允许 1 个 `camera`
- 一个房间最多允许 3 个 `viewer`
- 未授权用户不能加入房间

### 6.2 WebRTC 连接关系

- Camera 端为媒体发送方
- Viewer 端为媒体接收方
- 每个 Viewer 与 Camera 分别建立独立 PeerConnection
- 每条连接默认承载 1 路视频轨道和 1 路音频轨道
- 首版不做 Viewer 之间的媒体交换
- 首版不做 Viewer 到 Camera 的回传音频

### 6.3 协商策略

建议使用固定角色协商：

- Camera 作为 offer 发起方
- Viewer 作为 answer 响应方

好处：

- 降低状态机复杂度
- 更容易处理重连和重复加入

需要注意：

- 服务端需要保证同一 viewer 重复连接时旧连接被正确清理
- Camera 端要按 viewer 维度管理多个 PeerConnection

推荐时序：

1. Viewer 完成鉴权并加入房间
2. Signaling Server 校验房间状态和 viewer 数量上限
3. Signaling Server 向 Camera 发送 `viewer-joined` 事件，并附带 `viewerSocketId` 或等价会话标识
4. Camera 为该 viewer 创建独立 PeerConnection，并生成 offer
5. Camera 将 offer 定向发送给目标 viewer
6. Viewer 返回 answer
7. 双方继续交换 ICE candidate，直到链路建立

这样设计的目的，是把“什么时候由 Camera 发起 offer”从前端猜测逻辑改成服务端驱动，减少并发加入和重连时的状态歧义。

---

## 7. 安全模型

### 7.1 访问控制级别

本版定位为家庭/个人自用，不实现复杂 RBAC，但必须具备基础安全边界。

建议采用：

- Camera 端：长期设备令牌
- Viewer 端：轻量用户登录态或后端签发的短期访问令牌

### 7.2 WebSocket 鉴权

要求：

- WebSocket 连接建立前完成鉴权
- 鉴权失败立即断开连接
- 加入房间前再次校验角色和房间权限

### 7.3 房间隔离

要求：

- 所有信令事件必须带 `roomId`
- 服务端只在目标房间内转发
- 禁止全局广播 offer / answer / candidate

### 7.4 TURN 凭证

要求：

- 不在前端写死长期 TURN 用户名和密码
- 由服务端按需签发短期 TURN 凭证
- 凭证应具备过期时间

推荐实现：

- Coturn 开启 `use-auth-secret`
- Signaling Server 持有 `TURN_SECRET`
- Viewer 或 Camera 在建立 PeerConnection 前，通过受保护接口获取短期 TURN 凭证
- 凭证使用带过期时间的动态用户名，而不是静态账号密码

可采用的签发方式示例：

```ts
import crypto from 'node:crypto';

export function generateTurnCredentials(secret: string, ttlSeconds = 3600) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:camera-or-viewer`;
  const credential = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');

  return {
    username,
    credential,
    ttlSeconds,
  };
}
```

说明：

- 该方案不需要在 Coturn 中维护独立用户名密码表
- 服务端只需保护好 `TURN_SECRET`
- 前端只拿到短期凭证，过期后需重新申请

### 7.5 对象存储与通知凭证

要求：

- MinIO / S3 长期密钥不得下发到前端
- Telegram Bot Token 不得暴露在前端
- 后续录像上传必须通过服务端签名 URL 或服务端代理

### 7.6 传输安全

要求：

- 生产环境统一使用 HTTPS / WSS
- `getUserMedia` 仅在受信任上下文运行
- 所有外部访问入口都经过 TLS

---

## 8. 稳定性与运行策略

### 8.1 前台常驻假设

本方案默认 Camera PWA 在 Android 设备上以前台页面方式运行。

这意味着：

- 不能依赖浏览器后台长时间稳定采集
- 不能把 Wake Lock 视为强保证
- 必须把 Android 系统节电策略视为首要风险
- 必须关注夜间弱光和持续音频采集带来的发热与耗电

### 8.2 设备侧必做设置

在 Android 设备上需要手动关闭或放宽以下限制：

- 电池优化
- 后台冻结
- 深度休眠
- Wi-Fi 休眠断开
- 浏览器后台限制

### 8.3 重连策略

Camera 与 Viewer 都需要具备以下能力：

- WebSocket 断开自动重连
- ICE 失败后触发 `restartIce`
- 页面恢复到前台后检查并恢复连接
- 旧连接残留时主动清理本地状态

建议采用指数退避策略：

- 初始重连间隔为 1 秒
- 每次失败后翻倍
- 最大退避上限为 30 秒
- 每次重连附加少量随机抖动（jitter）

这样做的目的，是避免 Camera 与多个 Viewer 同时掉线后瞬时并发重连，给信令服务造成不必要的峰值压力。

### 8.4 在线状态

系统至少需要区分以下状态：

- `idle`
- `connecting`
- `live`
- `reconnecting`
- `offline`
- `error`

Viewer 端必须将这些状态可视化，避免用户看到黑屏却无法判断原因。

推荐默认判定：

- 正常心跳间隔为 10 秒
- 连续 30 秒未收到对端心跳或服务端在线确认，则判定为 `offline`
- 连接已断开但仍处于自动恢复流程中，显示为 `reconnecting`
- 明确鉴权失败、媒体权限失败或协商失败时，显示为 `error`

### 8.5 日志与可观测性

首版至少记录以下事件：

- socket connect / disconnect
- join room success / reject
- camera occupied
- viewer count changed
- offer / answer 协商开始与结束
- ICE failed / disconnected / connected
- TURN fallback 发生

日志中不得记录敏感令牌、明文密码或长期凭证。

---

## 9. 部署模型

### 9.1 默认部署前提

本版默认使用：

- OrbStack VM 作为开发阶段 Linux 运行环境
- 单台 VPS 作为可选公网验证和后续部署环境
- Docker Compose
- HTTPS 真机联调入口

### 9.2 服务清单

建议首版服务：

- `nginx`
- `viewer-web`
- `signaling-server`
- `coturn`

建议后续阶段再加入：

- `minio`
- `recording-index-service`（如后续需要）

说明：

- 首版 `docker-compose.yml` 不应预置 `minio`
- 首版 compose 只保留实时链路必需服务，降低部署噪音和排障复杂度

### 9.3 部署原则

- 所有服务配置通过环境变量注入
- 敏感信息不写死在镜像和前端代码中
- Nginx 正确转发 WebSocket Upgrade
- TURN 端口、TLS、防火墙规则提前验证

---

## 10. 关键数据与配置模型

### 10.1 核心实体

首版建议至少有以下逻辑实体：

#### `CameraDevice`

- `id`
- `name`
- `status`
- `lastHeartbeatAt`
- `roomId`

#### `ViewerSession`

- `id`
- `userId`
- `roomId`
- `connectedAt`
- `lastSeenAt`

#### `Room`

- `id`
- `cameraId`
- `maxViewers`
- `activeCameraSocketId`

### 10.2 关键配置项

建议显式管理：

- `MAX_VIEWERS_PER_ROOM`
- `SIGNALING_ORIGIN`
- `TURN_SECRET`
- `TURN_TTL_SECONDS`
- `WS_HEARTBEAT_INTERVAL_MS`
- `HEARTBEAT_TIMEOUT_MS`
- `RECONNECT_BACKOFF_MS`
- `RECONNECT_MAX_BACKOFF_MS`
- `SOCKET_TRANSPORTS`

推荐默认值：

```text
MAX_VIEWERS_PER_ROOM=3
TURN_TTL_SECONDS=3600
WS_HEARTBEAT_INTERVAL_MS=10000
HEARTBEAT_TIMEOUT_MS=30000
RECONNECT_BACKOFF_MS=1000
RECONNECT_MAX_BACKOFF_MS=30000
SOCKET_TRANSPORTS=websocket
```

其中：

- `HEARTBEAT_TIMEOUT_MS` 表示连续 3 次心跳窗口未确认后判定离线
- `SOCKET_TRANSPORTS=websocket` 用于避免 Socket.IO 默认 long-polling 降级带来的连接行为不确定性

客户端连接建议显式配置：

```ts
io(SIGNALING_URL, {
  transports: ['websocket'],
});
```

---

## 11. MVP 功能清单

### 11.1 必须完成

- Camera PWA 获取并预览后置摄像头
- Camera PWA 获取麦克风权限并将音频加入同一媒体流
- Camera 连接信令服务并加入固定房间
- Viewer 完成访问鉴权并加入同一房间
- Camera 与 1-3 个 Viewer 建立独立 WebRTC 连接
- Viewer 可同时看到实时视频并听到实时音频
- 跨网环境下 TURN 可作为兜底链路
- 服务端限制单房间只能有 1 个 Camera
- 服务端限制 Viewer 数量上限
- 前后端具备基本断线重连能力
- Viewer 能看到明确连接状态和错误提示
- 全链路 HTTPS / WSS 可用

### 11.2 明确不做

- 录像
- 截图
- 消息通知
- AI 检测
- 多摄像头切换
- 复杂账号后台
- 双向对讲

---

## 12. MVP 验收标准

以下标准满足后，才能认为首版 MVP 完成：

### 12.1 基础连通性

- Android 真机可成功打开 Camera PWA 并获取后置摄像头
- Android 真机可成功获取麦克风权限并将音频加入同一媒体流
- Viewer 可在同局域网下成功观看实时视频并听到实时音频
- Viewer 可在跨网环境下成功观看实时视频并听到实时音频

### 12.2 多观看端能力

- 同时 1-3 个 Viewer 在线时，均可收到视频流与音频流
- 手机端在 3 个 Viewer 下仍可维持可接受的稳定性

### 12.3 稳定性

- 单个 Viewer 连续观看 30 分钟以上，链路不中断或可自动恢复
- 单个 Viewer 连续监听 30 分钟以上，音频不中断或可自动恢复
- 网络短暂中断后，系统能在预期时间内恢复连接
- Camera 重开页面后可重新进入可观看状态

### 12.4 安全性

- 未授权用户无法加入房间
- 非 Camera 角色不能冒充 Camera 占用房间
- 长期敏感凭证不暴露在前端

### 12.5 运行环境

- 所有访问通过 HTTPS / WSS
- WebSocket 代理和 TURN 端口配置通过实测验证

---

## 13. 后续阶段规划

### Phase 2：稳定性增强

范围：

- 更完整的状态机
- 更稳健的重连策略
- 服务端在线状态面板
- 更细粒度日志与告警

### Phase 3：录像

范围：

- MediaRecorder 分片录制
- 服务端签发上传 URL
- MinIO 对象存储
- 录像索引与基础列表页

### Phase 4：AI / 通知

范围：

- 事件检测
- 截图
- Telegram 通知

### Phase 5：多摄像头

范围：

- 多房间管理
- 设备列表
- 更细的权限控制

---

## 14. 已知风险与限制

### 14.1 PWA 长期运行稳定性有限

旧 Android 手机上的 Chrome / PWA 不等于原生前台服务。即使做了 Wake Lock 和系统设置，也不能承诺绝对 24/7 稳定运行。

### 14.2 多 Viewer 会线性增加手机负载

当前方案下，每增加一个 Viewer，手机端都会增加上行和连接压力。因此首版必须严格限制为 1-3 个观看端。

### 14.3 TURN 会引入带宽成本

当 P2P 失败并回退 TURN 时，媒体流将经过中继，VPS 带宽成本会上升，需要在上线前评估。

### 14.4 录像与 AI 不能默认堆在手机端

旧手机性能有限。若后续同时开启推流、录像、AI 检测，必须重新评估端侧 CPU、内存、发热和续航风险。

---

## 15. 实施建议

建议实施顺序：

1. 先完成实时链路 MVP，只做单房间、单 Camera、1-3 Viewer
2. 优先保证“能看到宝宝 + 能听到宝宝”的核心看护闭环
3. 先验证局域网可用，再验证跨网 + TURN
4. 先跑通 HTTPS / WSS，再继续做稳定性增强
5. 稳定运行数天后，再进入录像与 AI 阶段

不建议：

- 首版同时做录像、通知、AI、设备管理
- 首版直接引入 SFU
- 在前端暴露长期凭证以图省事

---

## 16. 结论

在当前约束下，最合理的首版路线是：

**单摄像头 + 单向音频监听 + 1-3 个观看端 + P2P Mesh + TURN 兜底 + OrbStack 本地开发 + 单 VPS 公网验证**

这条路线不是扩展性最强的，但它是当前成本、复杂度、可落地性之间最平衡的方案。首版重点不是“平台化”，而是先把一个真正可运行、可维护、可验证的家庭监控 MVP 做出来。
