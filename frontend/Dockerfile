# Build stage
FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json ./
RUN bun install

COPY tsconfig.json vite.config.ts vitest.config.ts index.html ./
COPY src ./src

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_GAME_WS_URL=http://localhost:4001
ARG VITE_AUTHORITY=http://localhost:8080/realms/crash-game
ARG VITE_CLIENT_ID=crash-game-client

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GAME_WS_URL=$VITE_GAME_WS_URL
ENV VITE_AUTHORITY=$VITE_AUTHORITY
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID

RUN bun run build

# Serve static SPA
FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000
