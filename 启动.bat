@echo off
REM ============================================================
REM  Family Trip Hub - local launcher (Windows)
REM  Family Trip Hub / jia-you-hui - one-click local start
REM  No npm install needed, only Node.js 18+.
REM
REM  NOTE: this file intentionally contains ASCII only. cmd parses
REM  batch files with the active code page, so UTF-8 Chinese text
REM  breaks command parsing. Chinese docs: see README.md and
REM  docs/ (judge quick-start guide).
REM ============================================================
setlocal
title Family Trip Hub - local server

echo ============================================================
echo   Family Trip Hub - local launcher
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo         Install Node.js 18+ first: https://nodejs.org/
  echo         Then double-click this file again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODEVER=%%v"
echo [1/3] Node.js version: %NODEVER%

if "%PORT%"=="" set "PORT=3000"

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] Port %PORT% is already in use.
  echo        It may be this app already running - open http://localhost:%PORT%
  echo        Or use another port:  set PORT=3100  then run this file again.
  echo.
  pause
  exit /b 1
)

if exist config.local.json (
  echo [2/3] config.local.json found
) else if exist config.local.example.json (
  echo [2/3] config.local.json missing - copied from the example template
  copy /y config.local.example.json config.local.json >nul
) else (
  echo [2/3] No config file - running with built-in defaults
)

echo [3/3] Starting server, the browser will open in a few seconds...
echo.
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:%PORT%"
node server.js

echo.
echo Server stopped. If there was an error above, please take a screenshot.
pause
