FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json ./
COPY packages/@crash/contracts ./packages/@crash/contracts/
COPY services/games ./services/games/

WORKDIR /app
RUN bun install

WORKDIR /app/services/games
RUN bunx prisma generate

EXPOSE 4001

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run src/main.ts"]
