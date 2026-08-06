$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Start-Process node -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden
Start-Sleep -Seconds 3
Start-Process (Join-Path $root 'tools\cloudflared.exe') -ArgumentList 'tunnel','--url','http://localhost:3000','--no-autoupdate' -WindowStyle Hidden -RedirectStandardError (Join-Path $root 'tools\tunnel.log')