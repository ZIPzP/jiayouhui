#!/usr/bin/env bash
# ============================================================
# 家游汇 · 本地一键启动（macOS / Linux）
# 用法：./启动.sh   或   bash 启动.sh
# 零依赖：只需要 Node.js 18+，不需要 npm install
# ============================================================
set -euo pipefail

PORT="${PORT:-3000}"

echo "============================================================"
echo "  家游汇 Family Trip Hub · 本地启动"
echo "============================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 Node.js，请先安装 Node.js 18+：https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
echo "[1/3] Node.js 版本：$(node -v)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[错误] 需要 Node.js 18 或更高版本，当前为 $(node -v)"
  exit 1
fi

if [ -f config.local.json ]; then
  echo "[2/3] 已找到 config.local.json"
elif [ -f config.local.example.json ]; then
  cp config.local.example.json config.local.json
  echo "[2/3] 未发现 config.local.json，已从模板复制（AI/地图 Key 可留空）"
else
  echo "[2/3] 无配置文件，使用内置默认配置"
fi

if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "[警告] 端口 $PORT 已被占用，可换端口后重试：PORT=3100 bash 启动.sh"
  exit 1
fi

echo "[3/3] 正在启动服务：http://localhost:$PORT"
echo "      按 Ctrl+C 停止"
echo
(
  sleep 2
  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"
  fi
) >/dev/null 2>&1 &
exec node server.js
