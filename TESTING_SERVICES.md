# Guia de consulta e testes — serviços locais

Instruções para subir a stack, verificar saúde e testar cada componente do Crash Game em desenvolvimento local.

Setup zero-touch, decisões técnicas e URLs: **[IMPLEMENTATION.md](IMPLEMENTATION.md)**.

## Pré-requisitos

- [Bun](https://bun.sh) >= 1.x
- Docker e Docker Compose
- `curl` e `jq` (opcional, facilitam os exemplos)

## Subir a stack

Na raiz do monorepo (`fullstack-challenge/`):

```bash
bun install
bun run docker:up              # foreground + rebuild
# ou
bun run docker:up:detached     # background + rebuild
```

Não é necessário copiar `.env` manualmente: o Compose injeta variáveis inline; `docker:prepare` só cria `.env` para dev fora do Docker.

Aguarde todos os containers ficarem **healthy**:

```bash
docker compose ps
```

Se alterou código dos serviços, `docker:up` já passa `--build`. Para rebuild isolado:

```bash
docker compose build games wallets frontend
docker compose up -d
```

Parar e remover volumes (reset completo de dados):

```bash
bun run docker:down    # ou: docker compose down
bun run docker:prune  # remove volumes e imagens (cuidado)
```

---

## Referência rápida

| Serviço    | URL / porta principal        | Credenciais        |
| ---------- | ---------------------------- | ------------------ |
| Kong (API) | http://localhost:8000        | —                  |
| Kong Admin | http://localhost:8001        | —                  |
| Game       | http://localhost:4001      | JWT (rotas auth)   |
| Wallet     | http://localhost:4002      | JWT (rotas auth)   |
| Socket.IO  | http://localhost:4001        | sem auth (push)    |
| Keycloak   | http://localhost:8080        | admin / admin      |
| RabbitMQ   | http://localhost:15672       | admin / admin      |
| PostgreSQL | localhost:5432               | admin / admin      |

**Usuário de teste (jogo):** `player` / `player123`  
**Realm OIDC:** `crash-game`  
**Client ID:** `crash-game-client`

---

## PostgreSQL

### Consultar

```bash
# Health do container
docker compose exec postgres pg_isready -U admin -d postgres

# Listar databases
docker compose exec postgres psql -U admin -d postgres -c '\l'

# Conectar ao DB do jogo
docker compose exec postgres psql -U admin -d games

# Conectar ao DB da carteira
docker compose exec postgres psql -U admin -d wallets
```

### Testar

```sql
-- Dentro de psql -d games
\dt
SELECT id, phase, "bettingEndsAt" FROM rounds ORDER BY "createdAt" DESC LIMIT 5;

-- Dentro de psql -d wallets
\dt
SELECT "userId", "balanceInCents" FROM wallets;
```

### Connection strings (host local)

| Database | URL |
| -------- | --- |
| games    | `postgresql://admin:admin@localhost:5432/games` |
| wallets  | `postgresql://admin:admin@localhost:5432/wallets` |

---

## Keycloak

### Consultar

| Item | URL |
| ---- | --- |
| Admin Console | http://localhost:8080 (login: `admin` / `admin`) |
| Realm | `crash-game` |
| OIDC discovery | http://localhost:8080/realms/crash-game/.well-known/openid-configuration |
| JWKS | http://localhost:8080/realms/crash-game/protocol/openid-connect/certs |

```bash
# Health (porta de management interna 9000)
docker compose exec keycloak sh -c \
  "exec 3<>/dev/tcp/localhost/9000 && echo -e 'GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3 && cat <&3"
```

### Testar — obter token JWT

Fluxo **password** (apenas dev; o client também suporta PKCE no frontend):

```bash
export TOKEN=$(curl -sS -X POST \
  'http://localhost:8080/realms/crash-game/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password' \
  -d 'client_id=crash-game-client' \
  -d 'username=player' \
  -d 'password=player123' \
  | jq -r '.access_token')

echo "$TOKEN" | head -c 40 && echo '...'
```

Decodificar claims (requer `jq`):

```bash
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

O `sub` do usuário `player` deve ser `f47ac10b-58cc-4372-a567-0e02b2c3d479` (mesmo ID usado no seed da carteira).

---

## RabbitMQ

### Consultar

| Item | URL / porta |
| ---- | ----------- |
| AMQP | `localhost:5672` |
| Management UI | http://localhost:15672 (`admin` / `admin`) |

```bash
docker compose exec rabbitmq rabbitmq-diagnostics -q ping
```

No painel **Queues and Streams**, filas esperadas após subir games/wallets (nomes podem variar conforme implementação):

- Consumo de comandos no Wallet
- Consumo de eventos no Game

**Exchanges** (pacote `@crash/contracts`):

| Nome | Tipo |
| ---- | ---- |
| `wallet.commands` | commands Game → Wallet |
| `wallet.events` | events Wallet → Game |

**Routing keys** (exemplos):

- `wallet.debit.request.v1`
- `wallet.credit.request.v1`
- `wallet.debit.succeeded.v1` / `wallet.debit.failed.v1`
- `wallet.credit.succeeded.v1` / `wallet.credit.failed.v1`

### Testar

1. Abra http://localhost:15672 e confira que o nó está **running**.
2. Faça uma aposta via API do Game (ver seção Game) e observe mensagens nas filas/exchanges.
3. Logs do consumer:

```bash
docker compose logs -f wallets
docker compose logs -f games
```

---

## Kong (API Gateway)

### Consultar

| Porta | Uso |
| ----- | --- |
| 8000 | Proxy HTTP (entrada do frontend) |
| 8001 | Admin API |

Rotas declaradas em `docker/kong/kong.yml`:

| Path prefix | Upstream |
| ----------- | -------- |
| `/games`    | `games:4001` (strip `/games`) |
| `/wallets`  | `wallets:4002` (strip `/wallets`) |

```bash
curl -sS http://localhost:8001/services | jq '.data[].name'
```

### Testar

```bash
# Health indireto (Kong não expõe /health próprio no 8000)
curl -sS http://localhost:8000/games/rounds/current | jq .

# Carteira via Kong (requer token)
curl -sS http://localhost:8000/wallets/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

> **WebSocket não passa pelo Kong** em dev local. Use `http://localhost:4001` (ver seção Socket.IO).

---

## Wallet Service

### Consultar

| Modo | Base URL |
| ---- | -------- |
| Direto | http://localhost:4002 |
| Via Kong | http://localhost:8000/wallets |

```bash
curl -sS http://localhost:4002/health | jq .
docker compose logs -f wallets --tail 100
```

### Endpoints

| Método | Path (Kong) | Auth | Descrição |
| ------ | ----------- | ---- | --------- |
| GET | `/wallets/health` | Não | Health (direto: `/health`) |
| POST | `/wallets` | Sim | Criar carteira |
| GET | `/wallets/me` | Sim | Saldo da carteira |

Débito/crédito **não** são REST — apenas via RabbitMQ.

### Testar

```bash
# Health
curl -sS http://localhost:4002/health

# Criar carteira (idempotente se já existir)
curl -sS -X POST http://localhost:8000/wallets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .

# Consultar saldo (seed: R$ 1000,00 = 100000 centavos)
curl -sS http://localhost:8000/wallets/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Testes automatizados (com Docker rodando):

```bash
cd services/wallets
bun test tests/e2e
```

**Swagger UI** (serviços diretos): http://localhost:4002/api/docs (wallets), http://localhost:4001/api/docs (games).

---

## Game Service

### Consultar

| Modo | Base URL |
| ---- | -------- |
| Direto | http://localhost:4001 |
| Via Kong | http://localhost:8000/games |

```bash
curl -sS http://localhost:4001/health | jq .
docker compose logs -f games --tail 100
```

### Endpoints REST

| Método | Path (Kong) | Auth | Descrição |
| ------ | ----------- | ---- | --------- |
| GET | `/games/rounds/current` | Não | Rodada atual + apostas |
| GET | `/games/rounds/history` | Não | Histórico (`?skip=0&take=20`) |
| GET | `/games/rounds/:id/verify` | Não | Dados provably fair |
| GET | `/games/bets/me` | Sim | Minhas apostas |
| POST | `/games/bet` | Sim | Apostar |
| POST | `/games/bet/cashout` | Sim | Sacar |

### Testar — fluxo manual

```bash
# Rodada atual (público)
curl -sS http://localhost:8000/games/rounds/current | jq .

# Histórico
curl -sS 'http://localhost:8000/games/rounds/history?take=5' | jq .

# Apostar R$ 10,00 (1000 centavos) — só na fase BETTING
curl -sS -X POST http://localhost:8000/games/bet \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountInCents": "1000"}' | jq .

# Cash out — só na fase RUNNING com aposta ACTIVE
curl -sS -X POST http://localhost:8000/games/bet/cashout \
  -H "Authorization: Bearer $TOKEN" | jq .

# Verificar saldo após aposta/cashout
curl -sS http://localhost:8000/wallets/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# Provably fair (substitua ROUND_ID)
curl -sS http://localhost:8000/games/rounds/ROUND_ID/verify | jq .
```

Testes unitários (sem Docker):

```bash
cd services/games
bun run test:unit
```

Testes E2E (com Docker rodando):

```bash
cd services/games
bun test tests/e2e
```

---

## Socket.IO (tempo real — Game)

### Consultar

| Item | Valor |
| ---- | ----- |
| URL | `http://localhost:4001` |
| Path Engine.IO | `/socket.io/` |
| Direção | **Somente servidor → cliente** |
| CORS | `WS_CORS_ORIGIN` no `.env` do games (padrão `*`) |

**Decisão local:** REST via Kong (`:8000`); WebSocket **direto** no Game (`:4001`). Variável sugerida para o frontend: `VITE_GAME_WS_URL=http://localhost:4001`.

### Eventos (`@crash/contracts`)

| Evento | Quando |
| ------ | ------ |
| `round:state` | Ao conectar + snapshot completo |
| `round:phase` | Mudança de fase da rodada |
| `round:tick` | Multiplicador durante `RUNNING` (~100ms) |
| `round:crashed` | Crash + bloco `verify` |
| `bet:placed` | Aposta confirmada |
| `bet:cashed_out` | Cash out de qualquer jogador |

### Testar — script Node/Bun

Na raiz do monorepo (após `bun install` na raiz ou em `services/games`):

```bash
cd fullstack-challenge
bun add -d socket.io-client   # se ainda não estiver instalado
```

Crie um arquivo temporário ou use:

```bash
bun -e "
import { io } from 'socket.io-client';
const socket = io('http://localhost:4001', { transports: ['websocket'] });
socket.on('connect', () => console.log('connected', socket.id));
socket.on('round:state', (p) => console.log('round:state', p.phase, p.currentMultiplier));
socket.on('round:phase', (p) => console.log('round:phase', p.phase));
socket.on('round:tick', (p) => process.stdout.write('tick ' + p.currentMultiplier + '\r'));
socket.on('round:crashed', (p) => console.log('\nround:crashed', p.crashMultiplier));
socket.on('bet:placed', (p) => console.log('bet:placed', p.userId, p.amount));
socket.on('bet:cashed_out', (p) => console.log('bet:cashed_out', p.userId, p.cashoutMultiplier));
setTimeout(() => { socket.disconnect(); process.exit(0); }, 30000);
"
```

Abra **duas abas** com o script acima — ambas devem receber os mesmos `round:tick` e eventos de fase.

### Testar — navegador

No DevTools (Console), após carregar `socket.io` via CDN ou extensão, ou use a aba **Network → WS** enquanto o frontend conecta em `http://localhost:4001`.

---

## Checklist de sanidade (tudo OK?)

```bash
# 1. Containers
docker compose ps

# 2. Postgres
docker compose exec postgres pg_isready -U admin -d postgres

# 3. Keycloak token
curl -sS -X POST 'http://localhost:8080/realms/crash-game/protocol/openid-connect/token' \
  -d 'grant_type=password' -d 'client_id=crash-game-client' \
  -d 'username=player' -d 'password=player123' | jq -r '.access_token' | head -c 20

# 4. Game + Wallet health
curl -sf http://localhost:4001/health && echo " games OK"
curl -sf http://localhost:4002/health && echo " wallets OK"

# 5. Kong → Game
curl -sf http://localhost:8000/games/rounds/current > /dev/null && echo " kong→games OK"

# 6. Socket (conexão rápida)
curl -sf 'http://localhost:4001/socket.io/?EIO=4&transport=polling' | head -c 1 && echo " socket.io OK"
```

---

## Problemas comuns

| Sintoma | Causa provável | Ação |
| ------- | -------------- | ---- |
| `database "admin" does not exist` nos logs do Postgres | Healthcheck antigo sem `-d postgres` | `docker compose pull` não resolve; use o `docker-compose.yml` atual e `docker compose up -d --force-recreate postgres` |
| Keycloak **unhealthy** | Health na porta 8080 em vez de 9000 | Recrie o container Keycloak com o compose atual |
| Game reinicia com `server.listeners is not a function` | Socket.IO no Bun sem `node:http` | Rebuild da imagem games (`docker compose build games`) |
| Kong retorna 503 em `/games/*` | Container `games` parado ou DNS | `docker compose ps` e `docker compose logs games` |
| 401 nas rotas autenticadas | Token expirado ou issuer errado | Gere novo `$TOKEN`; confira `KEYCLOAK_ISSUER` no `.env` |
| Aposta rejeitada / timeout | Rabbit ou Wallet down | Verifique filas em http://localhost:15672 e logs `wallets` |

---

## Variáveis de ambiente úteis

| Variável | Serviço | Padrão | Efeito |
| -------- | ------- | ------ | ------ |
| `BETTING_WINDOW_MS` | games | `10000` | Duração da fase de apostas |
| `RUNNING_TICK_INTERVAL_MS` | games | `100` | Intervalo dos `round:tick` |
| `WS_CORS_ORIGIN` | games | `*` | Origens permitidas no Socket.IO |
| `VITE_GAME_WS_URL` | frontend | `http://localhost:4001` | URL do WebSocket no cliente |

Arquivos de exemplo: `services/games/.env.example`, `services/wallets/.env.example`.
