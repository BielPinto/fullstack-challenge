#!/bin/sh
# Ensures local .env files exist for optional out-of-Docker dev (compose uses inline env).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for svc in games wallets; do
  env_file="$ROOT/services/$svc/.env"
  example="$ROOT/services/$svc/.env.example"
  if [ ! -f "$env_file" ] && [ -f "$example" ]; then
    cp "$example" "$env_file"
    echo "Created services/$svc/.env from .env.example"
  fi
done
