'use strict';
/**
 * 隧道看护：定时检查公网地址，不通则自动重启 cloudflared（保证网站对外持续可用）
 * 用法：node tools/tunnel-watchdog.js   （建议随开机自启常驻后台）
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'tools', 'cloudflared.exe');
const TUNNEL_LOG = path.join(ROOT, 'tools', 'tunnel.log');
const WATCH_LOG = path.join(ROOT, 'tools', 'tunnel-watchdog.log');
const INTERVAL_MS = 60000;
const FAIL_LIMIT = 2;

let child = null;
let failCount = 0;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { fs.appendFileSync(WATCH_LOG, line + '\n'); } catch {}
  console.log(line);
}
function currentUrl() {
  try {
    const t = fs.readFileSync(TUNNEL_LOG, 'utf8');
    const matches = t.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
    return matches && matches.length ? matches[matches.length - 1] : null;
  } catch { return null; }
}
async function urlOk(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(url, { signal: ctl.signal, method: 'HEAD' });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}
function killAllCloudflared() {
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force'], { stdio: 'ignore' });
  } catch {}
}
function startTunnel() {
  if (child && child.exitCode === null) { try { child.kill(); } catch {} }
  killAllCloudflared();
  log('重启隧道…');
  const out = fs.openSync(TUNNEL_LOG, 'a');
  child = spawn(EXE, ['tunnel', '--url', 'http://localhost:3000', '--no-autoupdate'], { windowsHide: true, stdio: ['ignore', out, out] });
  child.on('exit', (code) => { log('cloudflared 退出 code=' + code); child = null; });
  failCount = 0;
}
async function tick() {
  const url = currentUrl();
  if (!url) { failCount++; log('暂无隧道地址（failCount=' + failCount + '）'); }
  else {
    const ok = await urlOk(url);
    if (!ok) { failCount++; log('公网地址不可达（failCount=' + failCount + '）：' + url); }
    else { failCount = 0; }
  }
  if (failCount >= FAIL_LIMIT) {
    startTunnel();
  }
}
(async () => {
  log('隧道看护已启动，每 ' + (INTERVAL_MS / 1000) + ' 秒检查一次');
  await new Promise((r) => setTimeout(r, 6000));
  await tick();
  setInterval(tick, INTERVAL_MS);
})();