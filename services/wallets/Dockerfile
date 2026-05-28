FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json ./
COPY packages/@crash/contracts ./packages/@crash/contracts/
COPY services/wallets ./services/wallets/
# Root workspaces list `frontend`; minimal package.json so monorepo `bun install` resolves.
COPY frontend/package.json ./frontend/package.json

WORKDIR /app
RUN bun install

WORKDIR /app/services/wallets
RUN bunx prisma generate

EXPOSE 4002

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run src/main.ts"]
