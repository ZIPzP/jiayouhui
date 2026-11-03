# 测试环境部署说明（dev-test-opt → 端口 3001）

> 目的：上线前在**真实服务器**上验证本轮改动，不影响线上 production（80/443 → 3000）。
> 测试环境与生产环境共用同一台机器，但目录、端口、pm2 进程、日志完全独立。

## 一、服务器一次性初始化

在服务器执行（只需做一次）：

```bash
# 1) 单独克隆一份到测试目录
sudo git clone https://github.com/ZIPzP/jiayouhui.git /opt/jiayouhui-test
cd /opt/jiayouhui-test
sudo git checkout dev-test-opt || sudo git checkout -b dev-test-opt origin/dev-test-opt
sudo mkdir -p logs

# 2) 复制生产配置（不复制也行，但地图 Key 需要；不要把 config.local.json 提交到仓库）
sudo cp /opt/jiayouhui/config.local.json /opt/jiayouhui-test/config.local.json 2>/dev/null || true
sudo chmod 600 /opt/jiayouhui-test/config.local.json 2>/dev/null || true

# 3) 启动测试实例（pm2 名：jiayouhui-test，端口 3001）
sudo pm2 start ecosystem.test.config.js
sudo pm2 save

# 4) 本机验证
curl -s http://127.0.0.1:3001/api/health
```

## 二、对外访问入口（二选一）

### 方案 A：直接开端口（最快）

```bash
sudo cp /opt/jiayouhui-test/deploy/nginx-test.conf /etc/nginx/conf.d/jiayouhui-test.conf
sudo nginx -t && sudo systemctl reload nginx
```

然后到**阿里云控制台 → 安全组**放行 TCP 8080，访问：

```text
http://120.55.44.25:8080
```

验证完成后要关闭入口，删掉配置文件并 reload 即可：

```bash
sudo rm /etc/nginx/conf.d/jiayouhui-test.conf && sudo nginx -t && sudo systemctl reload nginx
```

### 方案 B：用子域名（更接近线上）

DNS 加一条 A 记录（如 `test.familytravelhublz.top` → 120.55.44.25），
把 `deploy/nginx-test.conf` 的 `server_name _;` 改成该域名、`listen 8080;` 改成 `listen 80;`，
并在阿里云安全组放行 80（若生产已放行则无需再改）。

## 三、后续自动部署

推送 `dev-test-opt` 分支即触发 `.github/workflows/deploy-test.yml`：

```bash
git push origin dev-test-opt
```

流程：语法检查 → 单元测试 → 本机冒烟 → SSH 到服务器 `git reset --hard origin/dev-test-opt` → 重启 `jiayouhui-test` → 校验 `3001/api/health`。

## 四、验证通过后并入生产

```bash
# 本地
git checkout main
git merge --no-ff dev-test-opt
git push origin main          # 触发 deploy.yml → 生产 3000
```

合并前建议在测试环境把这几条走一遍：

- [ ] 首页 / 目的地 / 行程规划 / 出行清单 / 发现 / 关于 六个页面打开正常
- [ ] 生成一次行程（含 12306 车次与票价）
- [ ] 生成一次出行清单
- [ ] 打开地图工作台，路线与标记正常
- [ ] 行程右侧「依据」显示 RAG 来源，链接可打开
- [ ] AI 管家「解释规划」逐字输出并显示阶段状态
- [ ] 上传攻略截图可预填表单；无 Key 时提示清楚且图片不发送
- [ ] 使用真实 DeepSeek Key 检查工具轨迹、thinking 与视觉识别
- [ ] 开启长辈模式，首页标题可见、字号变大
- [ ] 切英文，主要文案为英文
- [ ] `/api/health` 返回 `{"ok":true}`，且匿名访问不含 `hasServerKey`
- [ ] 畸形请求 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/%00` 返回 400，且进程存活
