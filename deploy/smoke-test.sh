#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TMP_DIR="${TMPDIR:-/tmp}/jiayouhui-smoke-$$"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "== health =="
curl -fsS "$BASE_URL/api/health"
echo

echo "== SSE fallback =="
curl -fsS -N -X POST "$BASE_URL/api/chat/stream" \
  -H "Content-Type: application/json" \
  --data '{"message":"Why is day 2 arranged this way?","history":[],"tripContext":{"destinationId":"hangzhou","days":3,"elderly":1,"children":1},"lang":"zh"}' \
  >"$TMP_DIR/stream.txt"
grep -q "event: stage" "$TMP_DIR/stream.txt"
grep -q "event: delta" "$TMP_DIR/stream.txt"
grep -q "event: done" "$TMP_DIR/stream.txt"
grep -q '"citations":' "$TMP_DIR/stream.txt"
echo "SSE events and RAG citations verified"

echo "== static pages =="
for path in / /destinations.html /plan.html /packing.html /draw.html /about.html /profile.html; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"
  test "$code" = "200"
  echo "$path $code"
done

echo "== retired endpoints =="
for path in /profile-test.html /plan-map-lab.html /route-lab.html; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"
  test "$code" = "404"
  echo "$path $code"
done
code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data '{"message":"legacy"}' "$BASE_URL/api/chat")"
test "$code" = "404"
echo "/api/chat $code"
code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/rag/search?q=legacy")"
test "$code" = "404"
echo "/api/rag/search $code"

echo "Smoke test passed: $BASE_URL"
