#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TMP_DIR="${TMPDIR:-/tmp}/jiayouhui-smoke-$$"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "== health =="
curl -fsS "$BASE_URL/api/health"
echo

echo "== RAG =="
RAG_QUERY='%E6%9D%AD%E5%B7%9E%20%E8%80%81%E4%BA%BA%20%E8%8C%B6%E5%9B%AD%20%E5%8D%88%E4%BC%91'
curl -fsS "$BASE_URL/api/rag/search?q=$RAG_QUERY&destinationId=hangzhou" >"$TMP_DIR/rag.json"
grep -q '"citations":\[{' "$TMP_DIR/rag.json"
echo "RAG citations verified"

echo "== SSE fallback =="
curl -fsS -N -X POST "$BASE_URL/api/chat/stream" \
  -H "Content-Type: application/json" \
  --data '{"message":"Why is day 2 arranged this way?","history":[],"tripContext":{"destinationId":"hangzhou","days":3,"elderly":1,"children":1},"lang":"zh"}' \
  >"$TMP_DIR/stream.txt"
grep -q "event: stage" "$TMP_DIR/stream.txt"
grep -q "event: delta" "$TMP_DIR/stream.txt"
grep -q "event: done" "$TMP_DIR/stream.txt"
echo "SSE events verified"

echo "== static pages =="
for path in / /destinations.html /plan.html /packing.html /draw.html /about.html; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"
  test "$code" = "200"
  echo "$path $code"
done

echo "Smoke test passed: $BASE_URL"
