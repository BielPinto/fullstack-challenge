# Jungle Crash — frontend

Vite + React 18, Tailwind CSS v4, componentes no estilo **shadcn/ui**, TanStack Query e OIDC (Keycloak) com PKCE via `oidc-client-ts`.

## Variáveis (`cp .env.example .env`)

| Variável             | Descrição                                      |
| -------------------- | ---------------------------------------------- |
| `VITE_API_BASE_URL`  | REST via Kong (ex.: `http://localhost:8000`)   |
| `VITE_GAME_WS_URL`   | Socket.IO direto no games service (`:4001`)   |
| `VITE_AUTHORITY`     | Realm OIDC (`…/realms/crash-game`)             |
| `VITE_CLIENT_ID`     | `crash-game-client`                           |

## Scripts

```bash
cd frontend
bun install
bun dev          # http://localhost:5173
bun run build
bun run preview  # prod build na :3000
bun test
```

## Docker

O `docker-compose.yml` na raiz do monorepo sobe o frontend na porta **3000**. O build injeta as mesmas URLs `localhost` adequadas ao browser no host.
