FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/camera-pwa/package.json apps/camera-pwa/package.json

RUN pnpm install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY apps/camera-pwa apps/camera-pwa

ARG VITE_SIGNALING_ORIGIN
ARG VITE_ROOM_ID
ARG VITE_CAMERA_DEVICE_TOKEN
ARG VITE_SOCKET_TRANSPORTS
ARG VITE_BASE_PATH=/camera/

ENV VITE_SIGNALING_ORIGIN=$VITE_SIGNALING_ORIGIN
ENV VITE_ROOM_ID=$VITE_ROOM_ID
ENV VITE_CAMERA_DEVICE_TOKEN=$VITE_CAMERA_DEVICE_TOKEN
ENV VITE_SOCKET_TRANSPORTS=$VITE_SOCKET_TRANSPORTS
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN pnpm --filter camera-pwa build

EXPOSE 4174

CMD ["pnpm", "--filter", "camera-pwa", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "4174"]
