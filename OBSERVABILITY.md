# Observabilidade — Crash Game

Stack opcional de **métricas Prometheus** + **Grafana** para o serviço `games`. Métricas expostas em formato Prometheus em `GET /metrics` (porta direta do serviço, não via Kong).

## Subir com Docker Compose

```bash
bun run docker:up
```

| Serviço     | URL                         |
| ----------- | --------------------------- |
| Prometheus  | http://localhost:9090       |
| Grafana     | http://localhost:3001       |
| Métricas raw| http://localhost:4001/metrics |

Grafana: usuário `admin`, senha `admin` (dev).

## Métricas expostas

| Métrica | Tipo | Descrição |
| ------- | ---- | --------- |
| `crash_game_bets_placed_total` | Counter | Apostas confirmadas (débito OK) |
| `crash_game_bets_cashed_out_total` | Counter | Cash outs (manual + auto) |
| `crash_game_auto_cashouts_total` | Counter | Cash outs disparados por auto-cashout |
| `crash_game_bets_lost_total` | Counter | Apostas perdidas no crash |
| `crash_game_bet_volume_cents_total` | Counter | Volume apostado (centavos) |
| `crash_game_payout_volume_cents_total` | Counter | Volume pago em cashouts |
| `crash_game_rtp_ratio` | Gauge | RTP ≈ payout / stake |
| `crash_game_rounds_settled_total` | Counter | Rodadas finalizadas |
| `crash_game_ws_broadcast_duration_seconds` | Histogram | Latência de broadcast WS por evento |

Métricas padrão do Node (`process_*`, etc.) vêm de `collectDefaultMetrics`.

## Arquitetura

```mermaid
flowchart LR
  Games[games:4001 /metrics]
  Prom[Prometheus :9090]
  Graf[Grafana :3001]
  Games -->|scrape 15s| Prom
  Prom --> Graf
```

Dashboard provisionado: **Crash Game** (pasta Grafana).

## OpenTelemetry

O escopo atual usa **prom-client** diretamente (menor superfície). Evolução natural: exportador OTLP → collector → Prometheus/Grafana, sem mudar os nomes das métricas de negócio.
