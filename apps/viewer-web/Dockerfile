FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/viewer-web/package.json apps/viewer-web/package.json

RUN pnpm install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY apps/viewer-web apps/viewer-web

RUN pnpm --filter viewer-web build

EXPOSE 4173

CMD ["pnpm", "--filter", "viewer-web", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
