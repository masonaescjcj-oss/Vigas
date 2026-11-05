#!/usr/bin/env bash
# Starts or stops a throwaway local Postgres for development, without Docker.
# Data lives in ./.pgdata. Uses port 5433 so it never clashes with a system Postgres.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ -z "${PGBIN}" ] && command -v pg_ctl >/dev/null; then PGBIN="$(dirname "$(command -v pg_ctl)")"; fi
DATA="$PWD/.pgdata"
PORT="${PGPORT_LOCAL:-5433}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then RUN_AS="runuser -u postgres --"; chown -R postgres "$DATA" 2>/dev/null || true; fi

case "${1:-up}" in
  up)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$DATA"
      [ -n "$RUN_AS" ] && chown -R postgres "$DATA"
      $RUN_AS "$PGBIN/initdb" -D "$DATA" -U vigas --auth=trust >/dev/null
    fi
    $RUN_AS "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/server.log" -w start >/dev/null || true
    for db in vigas vigas_test; do
      psql -h localhost -p "$PORT" -U vigas -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
        || psql -h localhost -p "$PORT" -U vigas -d postgres -c "CREATE DATABASE $db" >/dev/null
    done
    psql -h localhost -p "$PORT" -U vigas -d postgres -c "ALTER USER vigas PASSWORD 'vigas'" >/dev/null
    echo "Postgres ready on port $PORT (databases: vigas, vigas_test)"
    ;;
  down)
    $RUN_AS "$PGBIN/pg_ctl" -D "$DATA" -m fast stop || true
    ;;
  *) echo "usage: $0 up|down"; exit 1 ;;
esac
