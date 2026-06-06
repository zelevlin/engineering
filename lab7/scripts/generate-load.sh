#!/usr/bin/env sh
set -eu

URL="${1:-http://engineering.lab7.zelenkov-labs.ru/cpu?ms=500}"
CONCURRENCY="${CONCURRENCY:-8}"

echo "Generating CPU load against ${URL}"
echo "Concurrency: ${CONCURRENCY}"

while true; do
  i=0
  while [ "$i" -lt "$CONCURRENCY" ]; do
    wget -q -O - "$URL" >/dev/null 2>&1 &
    i=$((i + 1))
  done
  wait
done
