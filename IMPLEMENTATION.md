# Implementação — Crash Game

Documento de entrega com **setup zero-touch**, **decisões técnicas**, **URLs** e **guia de testes locais**. O [README.md](README.md) do desafio permanece como especificação original; detalhes operacionais e de arquitetura da solução estão aqui e em [ARCHITECTURE.md](ARCHITECTURE.md) / [TESTING_SERVICES.md](TESTING_SERVICES.md).

---

## Setup (zero-touch)

### Pré-requisitos

- Bun >= 1.x
- Docker & Docker Compose

### Subir a stack

Na raiz do monorepo:

```bash
bun install
bun run docker:up
```

- `docker:prepare` (chamado automaticamente) cria `services/games/.env` e `services/wallets/.env` a partir de `.env.example` **somente se ainda não existirem** — útil para rodar serviços fora do Docker.
- No Compose, variáveis estão **inline** em `docker-compose.yml` (clone fresco não depende de `.env` commitado).
- Cada serviço NestJS executa `prisma migrate deploy` antes de iniciar.
- O Wallet faz **seed** da carteira do usuário `player` (R$ 1.000,00).
- Keycloak importa o realm `crash-game`; Kong carrega `docker/kong/kong.yml`.

```bash
bun run docker:up:detached   # background + rebuild
bun run docker:down
bun run docker:prune         # remove volumes e imagens (reset total)
docker compose ps            # aguarde todos healthy
```

---

## URLs de desenvolvimento

| O quê | URL | Notas |
| ----- | --- | ----- |
| **Frontend (UI)** | http://localhost:3000 | Login `player` / `player123` |
| **API (Kong)** | http://localhost:8000 | REST unificado (`/games/*`, `/wallets/*`) |
| **Game (direto)** | http://localhost:4001 | Health, Swagger em `/api/docs` |
| **Wallet (direto)** | http://localhost:4002 | Health, Swagger em `/api/docs` |
| **Socket.IO** | http://localhost:4001 | Path `/socket.io` — **não passa pelo Kong** em dev |
| **Keycloak** | http://localhost:8080 | Admin `admin` / `admin` |
| **RabbitMQ UI** | http://localhost:15672 | `admin` / `admin` |
| **PostgreSQL** | `localhost:5432` | DBs `games` e `wallets`, user `admin` |
| **Prometheus** | http://localhost:9090 | Scrape do `games` — ver [OBSERVABILITY.md](OBSERVABILITY.md) |
| **Grafana** | http://localhost:3001 | `admin` / `admin`, dashboard Crash Game |
| **Métricas games** | http://localhost:4001/metrics | Formato Prometheus |

**REST:** `http://localhost:8000/games/...` e `http://localhost:8000/wallets/...`

**Bônus na UI:** auto cashout (multiplicador alvo na aposta), leaderboard (`GET /games/leaderboard?period=24h|7d`).

**WebSocket:** o frontend usa `VITE_GAME_WS_URL=http://localhost:4001` (conexão direta ao Game Service). Em dev local, proxy WebSocket no Kong exige config extra de upgrade; REST já está estável no gateway.

**Eventos push** (`@crash/contracts` → `GAME_WS_EVENTS`): `round:state`, `round:phase`, `round:tick`, `round:crashed`, `bet:placed`, `bet:cashed_out`. Apostar e cashout permanecem **REST**.

### Keycloak (referência)

| Item | Valor |
| ---- | ----- |
| Realm | `crash-game` |
| Client ID | `crash-game-client` (public, PKCE S256) |
| Usuário teste | `player` / `player123` |
| OIDC discovery | http://localhost:8080/realms/crash-game/.well-known/openid-configuration |

O `userId` do `player` no realm (`f47ac10b-58cc-4372-a567-0e02b2c3d479`) corresponde ao seed da carteira no Wallet.

---

## Decisões técnicas e trade-offs

| Tema | Decisão | Trade-off |
| ---- | ------- | --------- |
| **ORM** | Prisma nos dois serviços; `migrate deploy` no entrypoint do container | Migrations versionadas; acoplamento ao Prisma na infra |
| **Dinheiro** | `bigint` centavos no domínio, Postgres `BIGINT`, API expõe strings | Sem float; multiplicador em **micro-units** (`1.00x` = `1_000_000n`) |
| **Mensageria** | RabbitMQ; contratos em `@crash/contracts` (`wallet.commands` / `wallet.events`) | RPC com `correlationId` + idempotência por `commandId`; consistência eventual |
| **Wallet REST** | Apenas criar/consultar carteira; débito/crédito só via fila | Game orquestra saga de aposta |
| **Provably fair** | Commit/reveal + HMAC-SHA256(serverSecret, clientSeed:nonce); micro-units | `GET /games/rounds/:id/verify` + guia [PROVABLY_FAIR.md](PROVABLY_FAIR.md) e `bun scripts/verify-round.ts <roundId>` |
| **Tempo real** | Scheduler no Game + Socket.IO server-push (~100ms/tick) | Cliente não envia ações no WS |
| **Gateway** | Kong só para REST; WS direto em `:4001` | Produção pode unificar host com rota WS no gateway |
| **Auth** | JWT Keycloak (JWKS); issuers Docker + localhost | Saldo seedado via `SEED_PLAYER_*` no Wallet |
| **Frontend** | Vite + React, TanStack Query, Zustand, Tailwind v4, OIDC PKCE | UI em http://localhost:3000 (Docker) ou `:5173` (`bun dev`) |

Mais diagramas e fluxos: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Estrutura implementada

```
fullstack-challenge/
├── services/games/          # Round, Bet, provably fair, WebSocket, REST /games
├── services/wallets/        # Wallet, consumer AMQP, REST /wallets
├── packages/@crash/contracts/
├── frontend/                # UI + OIDC
├── docker/                  # kong, keycloak, postgres
├── scripts/docker-prepare.sh
├── scripts/verify-round.ts   # verificação offline provably fair
├── PROVABLY_FAIR.md          # commit/reveal, algoritmo, auditoria
├── docker-compose.yml
├── IMPLEMENTATION.md        # este arquivo
├── ARCHITECTURE.md
└── TESTING_SERVICES.md
```

---

## Testes locais

### Cobertura

| Tipo | Onde | O que valida |
| ---- | ---- | ------------ |
| **Unitários** | `services/*/tests/unit` | Round, Bet, Wallet, provably fair, serialização `bigint` |
| **E2E API** | `services/games/tests/e2e` | Aposta → cashout; crash; erros de validação |
| **E2E Wallet** | `services/wallets/tests/e2e` | REST + idempotência (opcional) |
| **Frontend** | `frontend/` (Vitest) | Utilitários e componentes leves |

### Comandos (sem Docker)

```bash
cd services/wallets && bun test tests/unit
cd services/games && bun test tests/unit
cd frontend && bun test
```

### Comandos (com Docker)

```bash
bun run docker:up:detached
docker compose ps

cd services/games && bun test tests/e2e
cd services/wallets && bun test tests/e2e   # opcional
```

### Testes manuais e checklist

Fluxos com `curl`, token Keycloak, Socket.IO e saúde dos containers: **[TESTING_SERVICES.md](TESTING_SERVICES.md)**.

**Sincronização em tempo real (eliminatório):** abra http://localhost:3000 em duas abas, login como `player`; multiplicador e apostas devem convergir após cada evento WS.

### Variáveis fora do Docker

```bash
bun run docker:prepare
# ou manualmente:
cp services/games/.env.example services/games/.env
cp services/wallets/.env.example services/wallets/.env
cp frontend/.env.example frontend/.env
```

---

## Precisão monetária (revisão)

- Saldo e apostas: **centavos** (`bigint` / `BIGINT`), nunca `float` para dinheiro.
- Multiplicador: **micro-units** inteiros na engine; formatação `1.00x` só na borda (API/UI).
- Payout: aritmética inteira (`amountInCents * multiplierMicro / 1_000_000n`).

---

## Documentos relacionados

| Arquivo | Conteúdo |
| ------- | -------- |
| [README.md](README.md) | Enunciado do desafio (inalterado como spec) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Diagramas, camadas DDD, fluxos Game ↔ Wallet |
| [TESTING_SERVICES.md](TESTING_SERVICES.md) | Consultas, `curl`, RabbitMQ, Postgres, Socket.IO |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Plano de fases da implementação |
| [PROVABLY_FAIR.md](PROVABLY_FAIR.md) | Commit/reveal, algoritmo, verificação offline (`scripts/verify-round.ts`) |
