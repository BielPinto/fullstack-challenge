# Arquitetura — Crash Game (Full-stack Challenge)

Documento de análise da estrutura do repositório, visão da arquitetura implementada e como as tecnologias se comunicam. Baseado no estado atual do monorepo e nos requisitos definidos no `README.md`.

---

## 1. Visão geral

O projeto é um **monorepo Bun** para um jogo de cassino **Crash Game** em tempo real. A solução segue **DDD** com dois **bounded contexts** independentes (Game e Wallet), comunicação **assíncrona** via message broker, exposição unificada por **API Gateway** e autenticação delegada a um **IdP** (Keycloak).


| Camada             | Responsabilidade                                      |
| ------------------ | ----------------------------------------------------- |
| **Frontend**       | UI, animações, estado do cliente, OIDC login          |
| **Kong**           | Roteamento HTTP, ponto único de entrada (`:8000`)     |
| **Game Service**   | Rodadas, apostas, crash, provably fair, WebSocket     |
| **Wallet Service** | Saldo, crédito/débito (sem REST para movimentação)    |
| **PostgreSQL**     | Persistência isolada por serviço (`games`, `wallets`) |
| **RabbitMQ**       | Eventos entre Game ↔ Wallet                           |
| **Keycloak**       | OIDC, JWT, usuário de teste                           |


---

## 2. Estrutura do repositório (estado atual)

```
fullstack-challenge/
├── package.json                 # Workspaces Bun + scripts docker:*
├── docker-compose.yml           # Orquestração de toda a stack
├── docker/
│   ├── kong/kong.yml            # Rotas declarativas Kong (DB-less)
│   ├── keycloak/realm-export.json
│   └── postgres/init-databases.sh
├── services/
│   ├── games/                   # @crash/games — porta 4001
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── domain/          # Regras de Round/Bet/provably fair
│   │       ├── application/     # Use cases + scheduler de rodada
│   │       ├── infrastructure/  # Prisma, RabbitMQ, auth, realtime
│   │       └── presentation/    # REST + WebSocket gateway
│   └── wallets/                 # @crash/wallets — porta 4002
│       └── src/                 # Domain + use cases + consumer AMQP + REST
├── packages/
│   └── @crash/contracts/        # Contratos AMQP e eventos WebSocket
└── frontend/                    # Vite + React (porta 3000 em Docker / 5173 local)
```

### O que já está implementado


| Componente                                                           | Status |
| -------------------------------------------------------------------- | ------ |
| Docker Compose (Postgres, RabbitMQ, Keycloak, Kong, games, wallets) | ✅     |
| Kong roteando `/games` → games:4001 e `/wallets` → wallets:4002     | ✅     |
| Bancos `games` e `wallets` criados no init do Postgres              | ✅     |
| Realm Keycloak `crash-game` importado automaticamente                | ✅     |
| Camadas DDD em ambos os serviços (`domain` → `presentation`)         | ✅     |
| Contratos compartilhados (`@crash/contracts`) para AMQP e WS         | ✅     |
| Game com engine de rodada + provably fair + WebSocket               | ✅     |
| Wallet com idempotência de comandos e publicação de eventos          | ✅     |
| Frontend (login OIDC + página de jogo em tempo real)                | ✅     |


### Monorepo (Bun workspaces)

```json
"workspaces": ["services/*", "packages/*", "frontend"]
```

- `**bun run docker:up**` — sobe toda a infra e os containers dos serviços.
- Cada serviço tem `.env.example` com `DATABASE_URL`, `RABBITMQ_URL` e `PORT`.

---

## 3. Diagrama de arquitetura (alvo)

```mermaid
flowchart TB
    subgraph Client["Cliente (Browser)"]
        FE["Frontend<br/>React / Vite / Next / TanStack Start<br/>Tailwind + shadcn/ui"]
    end

    subgraph Auth["Identidade"]
        KC["Keycloak :8080<br/>Realm: crash-game<br/>OIDC + PKCE S256"]
    end

    subgraph Edge["Borda"]
        KONG["Kong API Gateway :8000<br/>DB-less / kong.yml"]
    end

    subgraph App["Aplicação (NestJS + Bun)"]
        GS["Game Service :4001<br/>Round · Bet · Crash · WS"]
        WS["Wallet Service :4002<br/>Wallet · Crédito/Débito"]
    end

    subgraph Data["Dados & Mensageria"]
        PG_G[("PostgreSQL<br/>database: games")]
        PG_W[("PostgreSQL<br/>database: wallets")]
        RMQ["RabbitMQ :5672<br/>Eventos assíncronos"]
    end

    FE -->|"OIDC Authorization Code"| KC
    FE -->|"JWT Bearer"| KONG
    FE -->|"WebSocket (push servidor→cliente)"| GS

    KONG -->|"/games/* REST"| GS
    KONG -->|"/wallets/* REST"| WS

    GS --> PG_G
    WS --> PG_W

    GS <-->|"Publicar / Consumir eventos"| RMQ
    WS <-->|"Publicar / Consumir eventos"| RMQ

    GS -.->|"Validar JWT (resource server)"| KC
    WS -.->|"Validar JWT (resource server)"| KC
```



---

## 4. Comunicação entre tecnologias

### 4.1 Frontend ↔ Keycloak (autenticação)


| Aspecto           | Detalhe                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| **Protocolo**     | OpenID Connect — Authorization Code + PKCE (cliente público)               |
| **Client ID**     | `crash-game-client`                                                        |
| **Discovery**     | `http://localhost:8080/realms/crash-game/.well-known/openid-configuration` |
| **Redirect URIs** | `http://localhost:3000/`*, `http://localhost:5173/*`                       |
| **Usuário teste** | `player` / `player123`                                                     |
| **Fluxo**         | Login redirect → callback → tokens armazenados no frontend                 |


O backend **não implementa login**; valida **JWT** emitido pelo Keycloak nos endpoints protegidos.

### 4.2 Frontend ↔ Kong ↔ Backend (REST)

Todas as APIs HTTP passam pelo Kong em `**http://localhost:8000`**.


| Rota Kong    | Serviço upstream      | Porta container | Exemplo                     |
| ------------ | --------------------- | --------------- | --------------------------- |
| `/games/`*   | `http://games:4001`   | 4001            | `GET /games/rounds/current` |
| `/wallets/*` | `http://wallets:4002` | 4002            | `GET /wallets/me`           |


Configuração atual (`docker/kong/kong.yml`):

- `strip_path: true` — o prefixo `/games` ou `/wallets` é removido antes de encaminhar ao NestJS.
- Modo **declarativo** (`KONG_DATABASE: off`) — sem Postgres do Kong.

**Endpoints planejados (README):**


| Serviço | Método | Path (via Kong)            | Auth |
| ------- | ------ | -------------------------- | ---- |
| Wallet  | POST   | `/wallets`                 | Sim  |
| Wallet  | GET    | `/wallets/me`              | Sim  |
| Game    | GET    | `/games/rounds/current`    | Não  |
| Game    | GET    | `/games/rounds/history`    | Não  |
| Game    | GET    | `/games/rounds/:id/verify` | Não  |
| Game    | GET    | `/games/bets/me`           | Sim  |
| Game    | POST   | `/games/bet`               | Sim  |
| Game    | POST   | `/games/bet/cashout`       | Sim  |


Ações do jogador (**apostar**, **cash out**) são **REST**; o WebSocket é apenas **server → client** (push).

### 4.3 Frontend ↔ Game Service (WebSocket)


| Aspecto            | Detalhe                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Direção**        | Servidor → cliente (eventos em tempo real)                                              |
| **Stack**          | `@nestjs/websockets` + `socket.io` (`IoAdapter`)                                        |
| **Uso**            | Sincronizar multiplicador, fases da rodada, apostas/cashouts de outros jogadores, crash |
| **URL (dev)**      | **Direto** em `http://localhost:4001` (`VITE_GAME_WS_URL`) — ver decisão abaixo       |


**Decisão Kong vs URL direta (local):** REST continua em `http://localhost:8000` (Kong). WebSocket usa **conexão direta** ao Game Service na porta `4001`, configurada via `VITE_GAME_WS_URL`. Motivo: no dev local, proxy WebSocket no Kong exige validar upgrade/path do Socket.IO (`/socket.io/`); REST já está estável em `/games`. Em produção, um único host pode expor WS no mesmo domínio com rota dedicada no gateway.

**Sincronização do multiplicador:** ticks **server-side** a cada `RUNNING_TICK_INTERVAL_MS` (padrão 100ms). O servidor envia `round:tick` com `currentMultiplier`, `elapsedMs` e `runDurationMs`. Clientes podem interpolar entre ticks, mas o servidor é autoritativo. Ao conectar, o cliente recebe `round:state` com snapshot completo.

**Eventos emitidos** (constantes em `@crash/contracts` → `GAME_WS_EVENTS`):

| Evento            | Quando                                              |
| ----------------- | --------------------------------------------------- |
| `round:state`     | Conexão + transições relevantes (snapshot completo) |
| `round:phase`     | Mudança de fase (`BETTING` → `RUNNING` → `SETTLED`) |
| `round:tick`      | Durante `RUNNING` (multiplicador atual)             |
| `round:crashed`   | Fim da rodada + payload `verify` (provably fair)    |
| `bet:placed`      | Aposta confirmada (débito OK)                       |
| `bet:cashed_out`  | Cash out de qualquer jogador                        |

**Scheduler:** `GameRoundService` avança fases por timer (fim da janela de apostas, crash pré-determinado, pausa pós-settle). Não há mensagens do cliente no socket — apostar/sacar permanecem REST.

### 4.4 Game Service ↔ Wallet Service (mensageria)

Comunicação **assíncrona** via **RabbitMQ** (`amqp://admin:admin@rabbitmq:5672`). Crédito e débito **não** são expostos por REST no Wallet.

```mermaid
sequenceDiagram
    participant U as Jogador
    participant FE as Frontend
    participant G as Game Service
    participant RMQ as RabbitMQ
    participant W as Wallet Service
    participant DB_G as DB games
    participant DB_W as DB wallets

    U->>FE: Apostar (REST)
    FE->>G: POST /games/bet + JWT
    G->>DB_G: Registrar Bet (pendente)
    G->>RMQ: Evento: DebitRequested
    RMQ->>W: Consumir DebitRequested
    W->>DB_W: Débito (centavos/BIGINT)
    W->>RMQ: Evento: DebitSucceeded / DebitFailed
    RMQ->>G: Consumir resultado
    alt Sucesso
        G->>DB_G: Confirmar aposta
        G-->>FE: WS: bet_confirmed
    else Falha (saldo insuficiente)
        G->>DB_G: Cancelar/rejeitar
        G-->>FE: Erro
    end

    Note over G,W: Cash out e crash seguem padrão similar<br/>(CreditRequested, liquidação, compensação)
```



**Princípios de design (avaliação):**

- Eventos de domínio bem nomeados e versionáveis.
- Estratégias de **compensação** (saga) se débito/crédito falhar após commit parcial.
- Bônus: **Outbox/Inbox** transacional para entrega confiável.

### 4.5 Serviços ↔ PostgreSQL


| Serviço | Database  | Connection string (Docker)                       |
| ------- | --------- | ------------------------------------------------ |
| Game    | `games`   | `postgresql://admin:admin@postgres:5432/games`   |
| Wallet  | `wallets` | `postgresql://admin:admin@postgres:5432/wallets` |


- **Database per service** — sem schema compartilhado entre bounded contexts.
- Valores monetários: **centavos inteiros**, `NUMERIC` ou Decimal — **nunca `float`**.

### 4.6 Serviços ↔ Keycloak (validação JWT)

Os serviços NestJS atuam como **resource servers**:

1. Frontend envia `Authorization: Bearer <access_token>`.
2. Game/Wallet validam assinatura, issuer, audience e expiração (JWKS do realm).
3. `sub` / `preferred_username` do token identificam o jogador.

---

## 5. Modelo de domínio (bounded contexts)

```mermaid
graph LR
    subgraph BC_Game["Bounded Context: Game"]
        R[Round<br/>Agregado raiz]
        B[Bet]
        CP[Crash Point<br/>Provably Fair]
        R --> B
        R --> CP
    end

    subgraph BC_Wallet["Bounded Context: Wallet"]
        W[Wallet<br/>1 por jogador]
    end

    BC_Game -.->|"Eventos AMQP only"| BC_Wallet
```



### Game Service


| Entidade        | Papel                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| **Round**       | Ciclo: fase de apostas → rodada ativa → crash → liquidação                   |
| **Bet**         | Uma aposta por jogador por rodada; cash out calcula `aposta × multiplicador` |
| **Crash Point** | Valor pré-determinado; verificável (hash chain / HMAC / seeds)               |


### Wallet Service


| Entidade   | Papel                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| **Wallet** | Saldo; operações via consumidor de filas, não REST público para débito/crédito |


### Camadas DDD (estrutura alvo por serviço)

```
src/
├── domain/           # Entidades, VOs, agregados, regras, eventos de domínio
├── application/      # Use cases, handlers, orquestração, sagas
├── infrastructure/   # ORM, RabbitMQ, repositórios, adapters
└── presentation/     # Controllers REST, gateways WebSocket, DTOs
```

As camadas acima já estão implementadas nos dois serviços, com responsabilidades bem separadas.

### Revisão por serviço (Fase 7)

#### Game Service (`services/games`)

| Camada | Implementação atual |
| ------ | ------------------- |
| **Domain** | Regras de aposta, limites e erros de domínio; cálculo de payout e provably fair |
| **Application** | Casos de uso (`place bet`, `cash out`, histórico, verificação) + `GameRoundService` para ciclo da rodada |
| **Infrastructure** | Persistência Prisma, gateway RabbitMQ para Wallet (request/reply por `commandId`), autenticação JWT, adaptador Socket.IO |
| **Presentation** | Endpoints REST em `games.controller.ts` e gateway WS (`game.gateway.ts`) com eventos `round:*` e `bet:*` |

Principais responsabilidades:

- Orquestrar o estado da rodada (`BETTING` → `RUNNING` → `SETTLED`) com scheduler server-side.
- Registrar apostas e cashouts com consistência eventual via integração assíncrona com a Wallet.
- Expor dados de verificação do provably fair em `/games/rounds/:id/verify`.
- Publicar o estado em tempo real para múltiplos clientes conectados.

#### Wallet Service (`services/wallets`)

| Camada | Implementação atual |
| ------ | ------------------- |
| **Domain** | Entidade `Wallet`, VO de dinheiro em centavos e invariantes de saldo |
| **Application** | Casos de uso de criação/consulta e handler de processamento de comandos de carteira |
| **Infrastructure** | Repositórios Prisma, controle de idempotência (`processed commands`), consumer de comandos RabbitMQ e publisher de eventos |
| **Presentation** | Endpoints autenticados de criação e consulta (`POST /wallets`, `GET /wallets/me`) |

Principais responsabilidades:

- Manter saldo por usuário sem uso de ponto flutuante.
- Processar comandos de débito/crédito vindos da fila com segurança de reprocessamento.
- Publicar eventos de sucesso/falha (`WalletDebit*`, `WalletCredit*`) para o Game.
- Fornecer API REST apenas para lifecycle da carteira do jogador (não para movimentação interna).

---

## 6. Topologia Docker (runtime)

```mermaid
graph TB
    subgraph Host["localhost"]
        P5432["5432 Postgres"]
        P5672["5672 RabbitMQ"]
        P15672["15672 RabbitMQ UI"]
        P8080["8080 Keycloak"]
        P8000["8000 Kong Proxy"]
        P8001["8001 Kong Admin"]
        P4001["4001 Game Service"]
        P4002["4002 Wallet Service"]
        P3000["3000 Frontend (futuro)"]
    end

    DC[docker-compose.yml]
    DC --> postgres
    DC --> rabbitmq
    DC --> keycloak
    DC --> kong
    DC --> games
    DC --> wallets

    games --> postgres
    games --> rabbitmq
    wallets --> postgres
    wallets --> rabbitmq
    kong -.->|depends_on healthy| postgres
    kong -.->|depends_on healthy| rabbitmq
```



**Ordem de dependência (healthchecks):**

1. Postgres e RabbitMQ ficam healthy.
2. Kong, games e wallets sobem após dependências.
3. Keycloak importa realm no `start-dev --import-realm`.

---

## 7. Stack tecnológica e papéis


| Tecnologia                | Papel na arquitetura                                         |
| ------------------------- | ------------------------------------------------------------ |
| **Bun**                   | Runtime e package manager do monorepo                        |
| **NestJS + TypeScript**   | Framework dos microserviços, injeção de dependência, módulos |
| **PostgreSQL 18**         | Persistência relacional, dois databases                      |
| **RabbitMQ 4**            | Barramento de eventos Game ↔ Wallet                          |
| **Kong 3.9**              | API Gateway HTTP, roteamento path-based                      |
| **Keycloak 26**           | IdP OIDC, realm pré-configurado                              |
| **Docker Compose**        | Ambiente local reproduzível (`docker:up`)                    |
| **Frontend (a escolher)** | TanStack Query + Zustand/Context; Tailwind v4 + shadcn       |


Alternativas aceitas pelo desafio: SQS/LocalStack, Auth0/Okta, AWS API Gateway — desde que `docker:up` continue autossuficiente.

---

## 8. Fluxo de uma rodada (visão de negócio)

```mermaid
stateDiagram-v2
    [*] --> BettingPhase: Nova rodada
    BettingPhase --> ActiveRound: Timer expira
    ActiveRound --> ActiveRound: Multiplicador sobe (WS)
    ActiveRound --> CashedOut: Jogador cash out (REST)
    ActiveRound --> Crashed: Crash point atingido
    CashedOut --> ActiveRound: Outros jogadores ainda ativos
    Crashed --> Settlement: Liquidação via eventos Wallet
    Settlement --> BettingPhase: Próxima rodada
```



1. **Fase de apostas** — `POST /games/bet` → débito assíncrono na Wallet.
2. **Rodada ativa** — multiplicador enviado por WebSocket; `POST /games/bet/cashout` credita ganho.
3. **Crash** — quem não sacou perde; eventos de crédito/compensação conforme regras.
4. **Provably fair** — `GET /games/rounds/:id/verify` para auditoria pelo jogador.

---

## 9. Portas e URLs de referência


| Serviço            | URL local                                        | Observação                    |
| ------------------ | ------------------------------------------------ | ----------------------------- |
| Kong (API pública) | [http://localhost:8000](http://localhost:8000)   | Entrada REST para o frontend  |
| Kong Admin         | [http://localhost:8001](http://localhost:8001)   | Admin API                     |
| Game (direto)      | [http://localhost:4001](http://localhost:4001)   | Health, WebSocket             |
| Wallet (direto)    | [http://localhost:4002](http://localhost:4002)   | Health                        |
| Keycloak           | [http://localhost:8080](http://localhost:8080)   | Admin: `admin`/`admin`        |
| RabbitMQ UI        | [http://localhost:15672](http://localhost:15672) | `admin`/`admin`               |
| PostgreSQL         | localhost:5432                                   | `admin`/`admin`               |
| Frontend           | [http://localhost:3000](http://localhost:3000)   | Scaffold comentado no compose |


---

## 10. Resumo: quem fala com quem


| Origem         | Destino                | Protocolo            | Propósito                       |
| -------------- | ---------------------- | -------------------- | ------------------------------- |
| Frontend       | Keycloak               | HTTPS OIDC           | Login, tokens                   |
| Frontend       | Kong                   | HTTP REST + JWT      | APIs de jogo e carteira         |
| Frontend       | Game Service           | WebSocket            | Estado em tempo real            |
| Kong           | Game / Wallet          | HTTP (proxy)         | Roteamento `/games`, `/wallets` |
| Game Service   | PostgreSQL (`games`)   | SQL                  | Persistência de rodadas/apostas |
| Wallet Service | PostgreSQL (`wallets`) | SQL                  | Persistência de saldos          |
| Game Service   | RabbitMQ               | AMQP publish/consume | Orquestrar débito/crédito       |
| Wallet Service | RabbitMQ               | AMQP publish/consume | Executar movimentações          |
| Game / Wallet  | Keycloak               | HTTPS JWKS           | Validar JWT                     |
| Game ↔ Wallet  | —                      | **Sem HTTP direto**  | Apenas mensageria               |


---

## 11. Próximos passos de evolução (checklist)

1. Evoluir observabilidade (métricas de rodada, latência AMQP e WS, tracing ponta a ponta).
2. Fortalecer resiliência de mensageria (retry/backoff, DLQ e dashboards de falha).
3. Expandir testes E2E multi-serviço com cenários de competição e carga leve.
4. Refinar estratégia de deploy de WebSocket atrás de gateway único para produção.
5. Documentar versionamento de contratos AMQP/WS para mudanças retrocompatíveis.

---

*Documento atualizado com base na implementação atual do repositório `fullstack-challenge` (Jungle Gaming Crash Game).*