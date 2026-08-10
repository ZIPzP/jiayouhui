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
const FAIL_LIMIT = 5;

let child = null;
let failCount = 0;
let serverDown = 0;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { fs.appendFileSync(WATCH_LOG, line + '\n'); } catch {}
  console.log(line);
}
function currentUrl() {
  // 正式隧道：固定域名
  return 'https://familytravelhublz.top';
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
  log('重启正式隧道(jiayouhui)…');
  const out = fs.openSync(TUNNEL_LOG, 'a');
  child = spawn(EXE, ['tunnel', '--config', 'C:\\Users\\34968\\.cloudflared\\config.yml', 'run', 'jiayouhui'], { windowsHide: true, stdio: ['ignore', out, out] });
  child.on('exit', (code) => { log('cloudflared 退出 code=' + code); child = null; });
  failCount = 0;
}
async function serverAlive() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch('http://localhost:3000/api/health', { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}
async function tick() {
  // 确保本机网站服务在跑
  if (!(await serverAlive())) {
    serverDown++;
    log('本机网站服务不可达（serverDown=' + serverDown + '），重启服务…');
    if (serverDown >= 2) {
      spawn('node', ['server.js'], { cwd: ROOT, windowsHide: true, stdio: 'ignore' });
      serverDown = 0;
    }
  } else { serverDown = 0; }
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
  startTunnel(); // 启动即拉起正式隧道
  await new Promise((r) => setTimeout(r, 10000));
  await tick();
  setInterval(tick, INTERVAL_MS);
})();