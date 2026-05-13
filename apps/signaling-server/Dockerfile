FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/signaling-server/package.json apps/signaling-server/package.json

RUN pnpm install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY apps/signaling-server apps/signaling-server

RUN pnpm --filter signaling-server build

EXPOSE 3000

CMD ["pnpm", "--filter", "signaling-server", "start"]
