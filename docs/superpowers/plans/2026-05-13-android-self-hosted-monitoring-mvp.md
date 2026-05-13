# Android Self-Hosted Monitoring MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从空目录开始搭建一个可运行的宝宝看护首版 MVP，覆盖 `camera-pwa`、`viewer-web`、`signaling-server`、`coturn/nginx`，满足单摄像头、单向音频监听、1-3 个观看端、P2P Mesh + TURN 兜底的实时链路目标。

**Architecture:** 采用 `pnpm workspace` monorepo。前端拆为 `apps/camera-pwa` 和 `apps/viewer-web` 两个 Vite React 应用；`camera-pwa` 采集后置摄像头和麦克风，`viewer-web` 负责播放实时视频和单向音频；后端使用 NestJS 提供信令、鉴权、TURN 凭证签发与健康检查；共享事件类型和配置常量放在 `packages/contracts`。开发阶段优先在 OrbStack Linux VM 中运行 `nginx + signaling-server + coturn`；公网 VPS 只在最后做外网验证时再引入。首版不引入 MinIO。

**Tech Stack:** TypeScript, pnpm workspace, React, Vite, Vitest, React Testing Library, NestJS, Socket.IO, Jest, Docker Compose, Nginx, Coturn

---

## Planned File Structure

```text
/Users/xuzheng/individual/real-time-mobile-monitoring/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  .editorconfig
  .env.example
  docker-compose.yml
  nginx/
    default.conf
  coturn/
    turnserver.conf
  packages/
    contracts/
      package.json
      tsconfig.json
      src/
        index.ts
        signaling.ts
        env.ts
  apps/
    signaling-server/
      package.json
      tsconfig.json
      nest-cli.json
      src/
        main.ts
        app.module.ts
        health.controller.ts
        turn.controller.ts
        auth/
          auth.service.ts
        signaling/
          signaling.gateway.ts
          room-store.ts
          turn-credentials.ts
      test/
        room-store.spec.ts
        turn-credentials.spec.ts
        signaling.gateway.spec.ts
        turn.controller.spec.ts
    viewer-web/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/
        main.tsx
        App.tsx
        lib/
          signaling-client.ts
          peer-manager.ts
        components/
          ViewerStatus.tsx
          RemoteVideo.tsx
      src/__tests__/
        App.spec.tsx
        peer-manager.spec.ts
    camera-pwa/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      public/
        manifest.webmanifest
      src/
        main.tsx
        App.tsx
        lib/
          camera.ts
          wake-lock.ts
          signaling-client.ts
          publisher-manager.ts
        components/
          CameraPreview.tsx
          CameraStatus.tsx
      src/__tests__/
        App.spec.tsx
        publisher-manager.spec.ts
  docs/
    superpowers/
      specs/
      plans/
```

## Interface Draft

### Socket Events

- Client -> Server
  - `join-room`: `{ roomId: string; role: 'camera' | 'viewer'; token: string }`
  - `offer`: `{ roomId: string; targetSocketId: string; sdp: RTCSessionDescriptionInit }`
  - `answer`: `{ roomId: string; targetSocketId: string; sdp: RTCSessionDescriptionInit }`
  - `ice-candidate`: `{ roomId: string; targetSocketId: string; candidate: RTCIceCandidateInit }`
  - `heartbeat`: `{ roomId: string; role: 'camera' | 'viewer'; sentAt: number }`

- Server -> Client
  - `viewer-joined`: `{ roomId: string; viewerSocketId: string }`
  - `peer-left`: `{ roomId: string; socketId: string }`
  - `offer`, `answer`, `ice-candidate`
  - `room-state`: `{ roomId: string; viewerCount: number; cameraConnected: boolean }`
  - `error-event`: `{ code: string; message: string }`

### HTTP APIs

- `GET /health`
- `POST /turn-credentials`
  - Request header: `Authorization: Bearer <token>`
  - Response: `{ urls: string[]; username: string; credential: string; ttlSeconds: number }`

## Execution Stages

### Stage 1: OrbStack 本地开发

目标：

- 在 OrbStack 的 `ubuntu` VM 中完成 monorepo、前后端、信令服务、Nginx、Coturn 的开发与自测
- 优先完成所有类型检查、单元测试、伪集成测试和局域网内联调

说明：

- 这一阶段不需要购买 VPS
- OrbStack VM 在本计划中承担“本地 Linux 运行环境”和“本地部署预演环境”的角色

### Stage 2: HTTPS 真机联调

目标：

- 让 Android 真机通过一个可访问的 HTTPS 地址打开 `camera-pwa`
- 验证 `getUserMedia` 可同时获取摄像头和麦克风
- 验证 `WSS`、Viewer 状态流转和基础实时链路

推荐方式：

- 继续使用 OrbStack VM 承载服务
- 通过内网穿透或 HTTPS 隧道暴露一个临时 HTTPS 域名给手机访问

说明：

- 内网穿透可以解决“真机必须使用 HTTPS 才能拿摄像头”的问题
- 它适合开发联调，不等同于最终公网部署

### Stage 3: 可选公网验证

目标：

- 在确实需要时，再将同一套 Compose 和配置迁移到单台 VPS
- 验证真实外网环境中的 TURN、中继带宽、跨网访问和长时间稳定性

说明：

- 这一步不是当前开发前置条件
- 只有在需要验证真实公网行为时才执行

### Tunnel Scope

内网穿透或 HTTPS 隧道可以解决：

- 手机访问前端页面
- `getUserMedia` 所需的受信任上下文
- `https` / `wss` 条件下的真机联调

内网穿透或 HTTPS 隧道不能替代：

- 真实公网 NAT 场景验证
- 最终 TURN 中继效果验证
- 长时间公网运行稳定性验证

---

### Task 1: Bootstrap Monorepo Workspace

**Files:**
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/package.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/pnpm-workspace.yaml`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/tsconfig.base.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/.gitignore`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/.editorconfig`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/.env.example`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/packages/contracts/package.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/packages/contracts/tsconfig.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/packages/contracts/src/index.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/packages/contracts/src/signaling.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/packages/contracts/src/env.ts`

- [ ] **Step 1: 创建根工作区配置**

```json
{
  "name": "real-time-mobile-monitoring",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

```yaml
packages:
  - apps/*
  - packages/*
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@rtmm/contracts": [
        "packages/contracts/src/index.ts"
      ]
    }
  }
}
```

- [ ] **Step 2: 创建基础仓库文件**

```gitignore
node_modules
dist
.DS_Store
.env
.env.local
coverage
```

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

```dotenv
SIGNALING_PORT=3000
SIGNALING_ORIGIN=https://monitor.example.com
ROOM_ID=camera-01
MAX_VIEWERS_PER_ROOM=3
CAMERA_DEVICE_TOKEN=replace-me
VIEWER_ACCESS_TOKEN=replace-me
TURN_SECRET=replace-me
TURN_TTL_SECONDS=3600
TURN_URLS=turn:monitor.example.com:3478?transport=udp,turn:monitor.example.com:3478?transport=tcp
WS_HEARTBEAT_INTERVAL_MS=10000
HEARTBEAT_TIMEOUT_MS=30000
RECONNECT_BACKOFF_MS=1000
RECONNECT_MAX_BACKOFF_MS=30000
SOCKET_TRANSPORTS=websocket
```

- [ ] **Step 3: 创建共享 contracts 包**

```json
{
  "name": "@rtmm/contracts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "echo \"contracts: no tests\"",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

```ts
export type SocketRole = 'camera' | 'viewer';

export interface JoinRoomPayload {
  roomId: string;
  role: SocketRole;
  token: string;
}

export interface OfferPayload {
  roomId: string;
  targetSocketId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  roomId: string;
  targetSocketId: string;
  candidate: RTCIceCandidateInit;
}

export interface TurnCredentialsResponse {
  urls: string[];
  username: string;
  credential: string;
  ttlSeconds: number;
}
```

```ts
export interface RuntimeEnv {
  roomId: string;
  signalingOrigin: string;
  maxViewersPerRoom: number;
  transports: 'websocket'[];
}
```

```ts
export * from './signaling';
export * from './env';
```

- [ ] **Step 4: 安装依赖并验证工作区脚本**

Run: `pnpm install`

Expected: 安装成功，并生成根目录 `pnpm-lock.yaml`

Run: `pnpm typecheck`

Expected: `packages/contracts` 类型检查通过

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .editorconfig .env.example packages/contracts
git commit -m "chore: bootstrap workspace and shared contracts"
```

### Task 2: Implement Signaling Server Domain and TURN Credentials

**Files:**
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/package.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/tsconfig.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/nest-cli.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/signaling/room-store.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/signaling/turn-credentials.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/test/room-store.spec.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/test/turn-credentials.spec.ts`

- [ ] **Step 1: 写房间状态和 TURN 凭证单测**

```json
{
  "name": "signaling-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest --runInBand",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.6",
    "@nestjs/core": "^11.1.6",
    "@nestjs/platform-express": "^11.1.6",
    "@nestjs/platform-socket.io": "^11.1.6",
    "@nestjs/websockets": "^11.1.6",
    "@rtmm/contracts": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "@nestjs/testing": "^11.1.6",
    "@types/jest": "^29.5.14",
    "@types/supertest": "^6.0.3",
    "jest": "^29.7.0",
    "supertest": "^7.1.1",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "src/**/*.ts",
    "test/**/*.ts"
  ]
}
```

```ts
import { describe, expect, it } from '@jest/globals';
import { RoomStore } from '../src/signaling/room-store';

describe('RoomStore', () => {
  it('rejects a second camera in the same room', () => {
    const store = new RoomStore(3);
    store.join({ roomId: 'camera-01', role: 'camera', socketId: 'camera-1' });
    expect(() =>
      store.join({ roomId: 'camera-01', role: 'camera', socketId: 'camera-2' }),
    ).toThrow('camera already connected');
  });

  it('rejects the fourth viewer in the same room', () => {
    const store = new RoomStore(3);
    store.join({ roomId: 'camera-01', role: 'camera', socketId: 'camera-1' });
    store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-1' });
    store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-2' });
    store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-3' });

    expect(() =>
      store.join({ roomId: 'camera-01', role: 'viewer', socketId: 'viewer-4' }),
    ).toThrow('viewer limit reached');
  });
});
```

```ts
import { describe, expect, it } from '@jest/globals';
import { generateTurnCredentials } from '../src/signaling/turn-credentials';

describe('generateTurnCredentials', () => {
  it('returns expiring credentials for coturn shared secret auth', () => {
    const result = generateTurnCredentials('top-secret', 3600, 1_700_000_000_000);

    expect(result.username).toMatch(/^\d+:viewer$/);
    expect(result.credential).toBeTruthy();
    expect(result.ttlSeconds).toBe(3600);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter signaling-server test`

Expected: FAIL，提示 `RoomStore` 和 `generateTurnCredentials` 尚未实现

- [ ] **Step 3: 写最小实现**

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomStore {
  private readonly rooms = new Map<
    string,
    { cameraSocketId: string | null; viewerSocketIds: Set<string> }
  >();

  constructor(private readonly maxViewersPerRoom: number) {}

  join(input: { roomId: string; role: 'camera' | 'viewer'; socketId: string }) {
    const room = this.rooms.get(input.roomId) ?? {
      cameraSocketId: null,
      viewerSocketIds: new Set<string>(),
    };

    if (input.role === 'camera') {
      if (room.cameraSocketId && room.cameraSocketId !== input.socketId) {
        throw new Error('camera already connected');
      }
      room.cameraSocketId = input.socketId;
    } else {
      if (room.viewerSocketIds.size >= this.maxViewersPerRoom) {
        throw new Error('viewer limit reached');
      }
      room.viewerSocketIds.add(input.socketId);
    }

    this.rooms.set(input.roomId, room);
    return room;
  }

  getCameraSocketId(roomId: string) {
    return this.rooms.get(roomId)?.cameraSocketId ?? null;
  }
}
```

```ts
import crypto from 'node:crypto';

export function generateTurnCredentials(
  secret: string,
  ttlSeconds: number,
  nowMs = Date.now(),
) {
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const username = `${expiresAt}:viewer`;
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

- [ ] **Step 4: 再跑测试**

Run: `pnpm --filter signaling-server test`

Expected: PASS，`room-store.spec.ts` 与 `turn-credentials.spec.ts` 通过

- [ ] **Step 5: Commit**

```bash
git add apps/signaling-server
git commit -m "feat: add signaling domain and turn credentials"
```

### Task 3: Implement NestJS Signaling Gateway and TURN API

**Files:**
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/main.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/app.module.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/health.controller.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/turn.controller.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/auth/auth.service.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/signaling/signaling.gateway.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/test/signaling.gateway.spec.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/test/turn.controller.spec.ts`

- [ ] **Step 1: 写 Gateway 和 TURN API 测试**

```ts
import { Test } from '@nestjs/testing';
import { SignalingGateway } from '../src/signaling/signaling.gateway';
import { RoomStore } from '../src/signaling/room-store';

describe('SignalingGateway', () => {
  it('emits viewer-joined to camera when a viewer joins', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SignalingGateway,
        { provide: RoomStore, useValue: new RoomStore(3) },
      ],
    }).compile();

    const gateway = moduleRef.get(SignalingGateway);
    const camera = { id: 'camera-1', emit: jest.fn(), join: jest.fn(), handshake: { auth: { token: 'camera-token' } } } as any;
    const viewer = { id: 'viewer-1', emit: jest.fn(), join: jest.fn(), handshake: { auth: { token: 'viewer-token' } } } as any;

    gateway.handleJoinRoom(camera, { roomId: 'camera-01', role: 'camera', token: 'camera-token' });
    gateway.handleJoinRoom(viewer, { roomId: 'camera-01', role: 'viewer', token: 'viewer-token' });

    expect(camera.emit).toHaveBeenCalledWith('viewer-joined', {
      roomId: 'camera-01',
      viewerSocketId: 'viewer-1',
    });
  });
});
```

```ts
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('POST /turn-credentials', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('returns short-lived credentials for authorized callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/turn-credentials')
      .set('authorization', 'Bearer viewer-token')
      .expect(201);

    expect(response.body.username).toBeTruthy();
    expect(response.body.credential).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter signaling-server test -- --runInBand`

Expected: FAIL，提示 `SignalingGateway`、`AppModule`、`turn.controller` 尚未实现

- [ ] **Step 3: 实现 Gateway、鉴权服务和控制器**

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  isValidToken(role: 'camera' | 'viewer', token: string) {
    if (role === 'camera') {
      return token === process.env.CAMERA_DEVICE_TOKEN;
    }
    return token === process.env.VIEWER_ACCESS_TOKEN;
  }
}
```

```ts
import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { generateTurnCredentials } from './signaling/turn-credentials';

@Controller()
export class TurnController {
  @Post('/turn-credentials')
  create(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (token !== process.env.VIEWER_ACCESS_TOKEN && token !== process.env.CAMERA_DEVICE_TOKEN) {
      throw new UnauthorizedException();
    }

    const credentials = generateTurnCredentials(
      process.env.TURN_SECRET ?? '',
      Number(process.env.TURN_TTL_SECONDS ?? 3600),
    );

    return {
      urls: (process.env.TURN_URLS ?? '').split(','),
      ...credentials,
    };
  }
}
```

```ts
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { RoomStore } from './room-store';

@WebSocketGateway({
  cors: {
    origin: process.env.SIGNALING_ORIGIN,
  },
  transports: ['websocket'],
})
export class SignalingGateway {
  constructor(
    private readonly authService: AuthService,
    private readonly roomStore: RoomStore,
  ) {}

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; role: 'camera' | 'viewer'; token: string },
  ) {
    if (!this.authService.isValidToken(body.role, body.token)) {
      client.emit('error-event', { code: 'UNAUTHORIZED', message: 'invalid token' });
      client.disconnect();
      return;
    }

    this.roomStore.join({ roomId: body.roomId, role: body.role, socketId: client.id });
    client.join(body.roomId);

    if (body.role === 'viewer') {
      const cameraSocketId = this.roomStore.getCameraSocketId(body.roomId);
      if (cameraSocketId) {
        client.to(cameraSocketId).emit('viewer-joined', {
          roomId: body.roomId,
          viewerSocketId: client.id,
        });
      }
    }
  }
}
```

- [ ] **Step 4: 跑服务端测试与类型检查**

Run: `pnpm --filter signaling-server test -- --runInBand`

Expected: PASS

Run: `pnpm --filter signaling-server typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/signaling-server
git commit -m "feat: add signaling gateway and turn api"
```

### Task 4: Build Viewer Web MVP

**Files:**
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/package.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/tsconfig.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/vite.config.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/index.html`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/main.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/App.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/components/ViewerStatus.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/components/RemoteVideo.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/lib/signaling-client.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/lib/peer-manager.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/__tests__/App.spec.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/__tests__/peer-manager.spec.ts`

- [ ] **Step 1: 写 Viewer 状态和协商单测**

```json
{
  "name": "viewer-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@rtmm/contracts": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.2.0",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^26.1.0",
    "vite": "^6.3.5",
    "vitest": "^3.1.2"
  }
}
```

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": [
      "vite/client",
      "vitest/globals"
    ]
  },
  "include": [
    "src"
  ]
}
```

```tsx
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('Viewer App', () => {
  it('shows connecting state before media is live', () => {
    render(<App />);
    expect(screen.getByText('连接中')).toBeInTheDocument();
  });
});
```

```ts
import { describe, expect, it, vi } from 'vitest';
import { createViewerPeerManager } from '../lib/peer-manager';

describe('createViewerPeerManager', () => {
  it('creates an answer when an offer arrives', async () => {
    const setRemoteDescription = vi.fn();
    const createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' });
    const setLocalDescription = vi.fn();

    const manager = createViewerPeerManager({
      peerFactory: () =>
        ({
          setRemoteDescription,
          createAnswer,
          setLocalDescription,
        }) as any,
    });

    const answer = await manager.acceptOffer({
      type: 'offer',
      sdp: 'offer-sdp',
    });

    expect(setRemoteDescription).toHaveBeenCalled();
    expect(createAnswer).toHaveBeenCalled();
    expect(answer.type).toBe('answer');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter viewer-web test`

Expected: FAIL，提示 `App` 和 `createViewerPeerManager` 尚未实现

- [ ] **Step 3: 实现 Viewer 页面和 Peer 管理器**

```tsx
import { useEffect, useState } from 'react';
import { ViewerStatus } from './components/ViewerStatus';
import { RemoteVideo } from './components/RemoteVideo';

export function App() {
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'offline' | 'error'>('connecting');

  useEffect(() => {
    void Promise.resolve().then(() => {
      setStatus('connecting');
    });
  }, []);

  return (
    <main>
      <h1>实时监控</h1>
      <ViewerStatus status={status} />
      <RemoteVideo />
    </main>
  );
}
```

```tsx
export function ViewerStatus({ status }: { status: 'connecting' | 'live' | 'reconnecting' | 'offline' | 'error' }) {
  const labelMap = {
    connecting: '连接中',
    live: '直播中',
    reconnecting: '重连中',
    offline: '已离线',
    error: '连接失败',
  } as const;

  return <p>{labelMap[status]}</p>;
}
```

```tsx
import { useRef } from 'react';

export function RemoteVideo({ stream }: { stream?: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
    videoRef.current.srcObject = stream;
  }

  return <video ref={videoRef} autoPlay playsInline controls />;
}
```

```ts
export function createViewerPeerManager({
  peerFactory = () => new RTCPeerConnection(),
}: {
  peerFactory?: () => RTCPeerConnection;
}) {
  const peer = peerFactory();

  return {
    async acceptOffer(offer: RTCSessionDescriptionInit) {
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      return answer;
    },
  };
}
```

```ts
import { io } from 'socket.io-client';

export function createViewerSocket(origin: string, token: string) {
  return io(origin, {
    auth: { token },
    transports: ['websocket'],
  });
}
```

- [ ] **Step 4: 跑前端测试和类型检查**

Run: `pnpm --filter viewer-web test`

Expected: PASS

Run: `pnpm --filter viewer-web typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/viewer-web
git commit -m "feat: add viewer web mvp shell"
```

### Task 5: Build Camera PWA MVP

**Files:**
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/package.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/tsconfig.json`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/vite.config.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/index.html`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/public/manifest.webmanifest`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/main.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/App.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/components/CameraPreview.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/components/CameraStatus.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/lib/camera.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/lib/wake-lock.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/lib/signaling-client.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/lib/publisher-manager.ts`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/__tests__/App.spec.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/__tests__/publisher-manager.spec.ts`

- [ ] **Step 1: 写摄像头权限和 viewer-joined 行为单测**

```json
{
  "name": "camera-pwa",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@rtmm/contracts": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.2.0",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^26.1.0",
    "vite": "^6.3.5",
    "vitest": "^3.1.2"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": [
      "vite/client",
      "vitest/globals"
    ]
  },
  "include": [
    "src"
  ]
}
```

```ts
import { describe, expect, it, vi } from 'vitest';
import { startCamera } from '../lib/camera';

describe('startCamera', () => {
  it('requests environment-facing video and one-way audio', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ id: 'stream' });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    await startCamera();

    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  });
});
```

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPublisherManager } from '../lib/publisher-manager';

describe('createPublisherManager', () => {
  it('creates an offer for a joined viewer', async () => {
    const createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
    const setLocalDescription = vi.fn();
    const addTrack = vi.fn();

    const manager = createPublisherManager({
      stream: { getTracks: () => [{ id: 'video-track' }, { id: 'audio-track' }] } as any,
      peerFactory: () =>
        ({
          createOffer,
          setLocalDescription,
          addTrack,
        }) as any,
    });

    const offer = await manager.createOfferForViewer('viewer-1');
    expect(addTrack).toHaveBeenCalledTimes(2);
    expect(offer.sdp).toBe('offer-sdp');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter camera-pwa test`

Expected: FAIL，提示 `startCamera` 与 `createPublisherManager` 尚未实现

- [ ] **Step 3: 实现 Camera PWA 核心逻辑**

```ts
export async function startCamera() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}
```

```ts
export function createPublisherManager({
  stream,
  peerFactory = () => new RTCPeerConnection(),
}: {
  stream: MediaStream;
  peerFactory?: () => RTCPeerConnection;
}) {
  const peers = new Map<string, RTCPeerConnection>();

  return {
    async createOfferForViewer(viewerSocketId: string) {
      const peer = peerFactory();
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      peers.set(viewerSocketId, peer);
      return offer;
    },
  };
}
```

```tsx
import { useEffect, useState } from 'react';
import { CameraPreview } from './components/CameraPreview';
import { startCamera } from './lib/camera';

export function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState('连接中');

  useEffect(() => {
    void startCamera()
      .then((nextStream) => {
        setStream(nextStream);
        setStatus('直播中');
      })
      .catch(() => {
        setStatus('连接失败');
      });
  }, []);

  return (
    <main>
      <h1>摄像头采集端</h1>
      <p>{status}</p>
      <CameraPreview stream={stream} />
    </main>
  );
}
```

- [ ] **Step 4: 跑前端测试和类型检查**

Run: `pnpm --filter camera-pwa test`

Expected: PASS

Run: `pnpm --filter camera-pwa typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/camera-pwa
git commit -m "feat: add camera pwa mvp shell"
```

### Task 6: Add Docker Compose, Nginx, and Coturn

**Files:**
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/docker-compose.yml`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/nginx/default.conf`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/coturn/turnserver.conf`

- [ ] **Step 1: 写部署文件静态检查清单**

```text
必须满足：
1. compose 只包含 nginx、signaling-server、coturn、viewer-web
2. 不包含 minio
3. nginx 转发 /socket.io/ 和 /api/
4. coturn 开启 use-auth-secret
5. 本地可在 OrbStack VM 中直接运行
```

- [ ] **Step 2: 创建首版 compose 和配置文件**

```yaml
services:
  signaling-server:
    build: ./apps/signaling-server
    env_file:
      - .env
    expose:
      - "3000"

  viewer-web:
    build: ./apps/viewer-web
    expose:
      - "4173"

  coturn:
    image: coturn/coturn:4.6
    network_mode: host
    env_file:
      - .env
    volumes:
      - ./coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - signaling-server
      - viewer-web
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

```nginx
server {
  listen 80;
  server_name _;

  location /socket.io/ {
    proxy_pass http://signaling-server:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location /api/ {
    proxy_pass http://signaling-server:3000/;
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://viewer-web:4173/;
    proxy_set_header Host $host;
  }
}
```

```ini
use-auth-secret
static-auth-secret=replace-me
realm=monitor.example.com
listening-port=3478
fingerprint
total-quota=12
stale-nonce=600
no-cli
no-multicast-peers
```

- [ ] **Step 3: 本地校验 compose 结构**

Run: `docker compose config`

Expected: 配置解析成功，且输出中不包含 `minio`

- [ ] **Step 4: 记录手动验证命令**

Run: `curl http://127.0.0.1:3000/health`

Expected: 返回 `{"ok":true}`

Run: `docker compose up -d`

Expected: `nginx`、`signaling-server`、`coturn`、`viewer-web` 均为运行状态

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml nginx coturn .env.example
git commit -m "chore: add deployment config for nginx and coturn"
```

### Task 7: Wire End-to-End Flow and Verification Docs

**Files:**
- Modify: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/signaling-server/src/signaling/signaling.gateway.ts`
- Modify: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/viewer-web/src/App.tsx`
- Modify: `/Users/xuzheng/individual/real-time-mobile-monitoring/apps/camera-pwa/src/App.tsx`
- Create: `/Users/xuzheng/individual/real-time-mobile-monitoring/docs/manual-test-checklist.md`

- [ ] **Step 1: 写端到端行为测试或伪集成用例**

```text
场景 A：
1. camera 登录并加入房间
2. viewer 登录并加入房间
3. camera 收到 viewer-joined
4. camera 发送 offer
5. viewer 返回 answer
6. 双方交换 ICE

场景 B：
1. 第四个 viewer 加入
2. signaling-server 返回 viewer limit reached

场景 C：
1. viewer token 错误
2. 连接被拒绝并显示连接失败
```

- [ ] **Step 2: 将 apps 串联起来**

```tsx
// viewer-web/src/App.tsx
useEffect(() => {
  const socket = createViewerSocket(import.meta.env.VITE_SIGNALING_ORIGIN, import.meta.env.VITE_VIEWER_ACCESS_TOKEN);
  socket.emit('join-room', {
    roomId: import.meta.env.VITE_ROOM_ID,
    role: 'viewer',
    token: import.meta.env.VITE_VIEWER_ACCESS_TOKEN,
  });
}, []);
```

```tsx
// camera-pwa/src/App.tsx
useEffect(() => {
  const socket = createCameraSocket(import.meta.env.VITE_SIGNALING_ORIGIN, import.meta.env.VITE_CAMERA_DEVICE_TOKEN);
  socket.emit('join-room', {
    roomId: import.meta.env.VITE_ROOM_ID,
    role: 'camera',
    token: import.meta.env.VITE_CAMERA_DEVICE_TOKEN,
  });

  socket.on('viewer-joined', async ({ viewerSocketId }) => {
    const offer = await publisherManager.createOfferForViewer(viewerSocketId);
    socket.emit('offer', {
      roomId: import.meta.env.VITE_ROOM_ID,
      targetSocketId: viewerSocketId,
      sdp: offer,
    });
  });
}, [publisherManager]);
```

- [ ] **Step 3: 写手动联调清单**

```md
# Manual Test Checklist

## 局域网链路

1. 启动 signaling-server、viewer-web、camera-pwa
2. Android 真机打开 camera-pwa，允许摄像头和麦克风权限
3. 桌面浏览器打开 viewer-web
4. 确认 Viewer 状态从“连接中”切到“直播中”，并可听到实时音频

## HTTPS 真机联调

1. 通过内网穿透或 HTTPS 隧道暴露 `https` 地址
2. Android 真机通过该地址打开 camera-pwa
3. 确认摄像头和麦克风权限可正常申请
4. 确认 Viewer 可通过 `wss` 连上 signaling-server

## 可选跨网链路

1. 在非同一局域网的浏览器中打开 viewer-web
2. 确认 TURN 凭证接口返回 201
3. 断开本地网络后恢复，确认状态进入“重连中”后恢复

## 访问控制

1. 使用错误 viewer token 访问
2. 确认连接被拒绝
3. 同时打开第 4 个 viewer
4. 确认收到 viewer limit reached
```

- [ ] **Step 4: 运行整体验证**

Run: `pnpm test`

Expected: 所有 workspace 测试通过

Run: `pnpm typecheck`

Expected: 所有 workspace 类型检查通过

- [ ] **Step 5: Commit**

```bash
git add apps docs/manual-test-checklist.md
git commit -m "docs: add end-to-end verification checklist"
```

---

## Self-Review

### Spec Coverage

- `单摄像头 + 1-3 viewer`：Task 2、Task 3、Task 7 覆盖
- `单向音频监听`：Task 4、Task 5、Task 7 覆盖
- `TURN 短期凭证`：Task 2、Task 3 覆盖
- `viewer-joined 驱动 offer`：Task 3、Task 7 覆盖
- `PWA + Viewer 状态`：Task 4、Task 5 覆盖
- `Docker Compose + nginx + coturn`：Task 6 覆盖
- `手动验收`：Task 7 覆盖

### Placeholder Scan

- 无 `TODO` / `TBD`
- 所有任务都包含明确文件路径、命令和期望结果

### Type Consistency

- 房间角色统一使用 `'camera' | 'viewer'`
- TURN 响应统一使用 `{ urls, username, credential, ttlSeconds }`
- WebSocket 事件统一使用 `join-room`、`viewer-joined`、`offer`、`answer`、`ice-candidate`

---

Plan complete and saved to `docs/superpowers/plans/2026-05-13-android-self-hosted-monitoring-mvp.md`. Two execution options:

1. Subagent-Driven (recommended) - 我按任务逐个派发子代理执行并复核
2. Inline Execution - 我在当前会话直接按计划开始实现

Which approach?
