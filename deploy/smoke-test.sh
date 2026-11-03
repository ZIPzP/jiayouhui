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
curl -fsS --get "$BASE_URL/api/rag/search" \
  --data-urlencode "q=杭州 老人 茶园 午休" \
  --data-urlencode "destinationId=hangzhou" >"$TMP_DIR/rag.json"
node -e "const x=require(process.argv[1]); if(!Array.isArray(x.citations)||!x.citations.length)process.exit(1); console.log('citations='+x.citations.length)" "$TMP_DIR/rag.json"

echo "== SSE fallback =="
curl -fsS -N -X POST "$BASE_URL/api/chat/stream" \
  -H "Content-Type: application/json" \
  --data '{"message":"为什么第 2 天这样安排？","history":[],"tripContext":{"destinationId":"hangzhou","destinationName":"杭州","days":3,"elderly":1,"children":1},"lang":"zh"}' \
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
