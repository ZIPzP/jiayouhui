$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Start-Process node -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden
Start-Sleep -Seconds 3
# 隧道由看护程序管理（自动检测并重启）
Start-Process node -ArgumentList 'tools\tunnel-watchdog.js' -WorkingDirectory $root -WindowStyle Hidden