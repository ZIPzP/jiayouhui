@echo off
cd /d "%~dp0"
echo ============================================
echo   家游汇 一键启动（网站 + 公网隧道）
echo ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\start-hidden.ps1"
echo 启动中，请稍候...
timeout /t 6 >nul
powershell -NoProfile -Command "$u = (Select-String -Path 'tools\tunnel.log' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -Last 1).Matches.Value; if ($u) { $u | clip; Write-Host ('公网地址(已复制到剪贴板): ' + $u) } else { Write-Host '公网地址还没生成，稍后双击 查看公网地址.bat' }"
echo.
echo 本机地址: http://localhost:3000
echo 提示: 隧道窗口已隐藏后台运行，不要重复双击本脚本。
pause