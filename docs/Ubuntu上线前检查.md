# 家游汇 Ubuntu 上线前检查

> 适用版本：2026-11-04 AI 升级版  
> 目标：在 Ubuntu 服务器完成部署后，验证 RAG、Function Calling、SSE、多模态、主业务链路与回滚。

## 一、上传前

本地确认：

```bash
npm test
npm run check
```

当前基线为 42 项测试全部通过、60 个 JavaScript 文件语法通过。

不要上传：

- `config.local.json`
- `.env`
- `tmp/`
- `logs/`
- `.git` 中的敏感凭据

## 二、Ubuntu 初始部署

```bash
cd /opt
sudo git clone https://github.com/ZIPzP/jiayouhui.git jiayouhui
cd /opt/jiayouhui
sudo git checkout main
```

如果直接上传压缩包，解压后仍应保证服务根目录包含 `server.js`、`lib/`、`public/`、`data/` 和 `config.json`。

安装或确认运行环境：

```bash
node --version
pm2 --version
nginx -v
```

Node.js 必须为 18 或更高版本。

## 三、私密配置

创建 `/opt/jiayouhui/config.local.json`，权限设为 600：

```json
{
  "ai": {
    "apiKey": "填写真实 DeepSeek Key",
    "inviteCode": "填写评审邀请码",
    "tokenTtlDays": 365,
    "tokenVersion": 1,
    "allowPrivateBaseUrl": false
  },
  "map": {
    "provider": "amap",
    "amapJsKey": "填写高德 Web JS Key",
    "amapSecurityCode": "填写高德安全密钥"
  }
}
```

```bash
sudo chmod 600 /opt/jiayouhui/config.local.json
sudo chown "$USER":"$USER" /opt/jiayouhui/config.local.json
```

确认 `config.json` 默认模型为 `deepseek-flash`。如需覆盖：

```bash
export AI_MODEL=deepseek-flash
export AI_VISION_MODEL=deepseek-flash
```

高德控制台需要把 `familytravelhublz.top` 和实际测试域名加入白名单。

## 四、启动与 Nginx

```bash
cd /opt/jiayouhui
pm2 start ecosystem.config.js
pm2 save
```

部署 `deploy/nginx.conf` 后检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

`/api/chat/stream` 必须关闭代理缓冲。`deploy/nginx.conf` 已配置：

```nginx
location = /api/chat/stream {
    proxy_pass http://127.0.0.1:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

## 五、基础接口

```bash
curl -fsS https://familytravelhublz.top/api/health
curl -fsS https://familytravelhublz.top/api/destinations
```

调用 `/api/chat/stream` 后，完成事件应包含非空 `citations`；页面“依据”中的来源 URL 应可打开。

匿名请求健康检查不应包含 `hasServerKey`。

## 六、真实 DeepSeek Key 验证

1. 在浏览器「设置 → AI 设置」输入评审邀请码，或填写自己的 Key。
2. 生成“上海 → 杭州”3 天家庭行程，要求老人少走路、孩子午休、不吃辣。
3. 打开右侧「依据」：
   - 至少有 1 条杭州本地知识来源；
   - 如果模型调用工具，显示 Agent 工具轨迹；
   - 如果模型未调用铁路工具，轨迹应明确显示系统兜底。
4. 在 AI 管家切换「解释规划」，询问“为什么第 2 天这样安排？”：
   - 先看到检索/推理/生成阶段；
   - 回答逐字出现；
   - 完成后显示引用来源；
   - 断开页面后服务端仍存活。
5. 上传一张脱敏杭州攻略截图：
   - 只预填表单，不自动生成；
   - 日期、人数、忌口经人工核对；
   - 图片不进入磁盘持久目录。

## 七、部署后完整回归

- [ ] 首页、目的地、行程、地图、清单、发现、关于均可打开
- [ ] 12306 车次与天气正常
- [ ] RAG 依据和来源链接正常
- [ ] 模型工具轨迹可审计
- [ ] SSE 回答不被 Nginx 缓冲
- [ ] 截图预填无 Key 与有 Key 边界都正确
- [ ] 中英文切换正常
- [ ] 手机 390px 无横向溢出
- [ ] 长辈模式字号和朗读正常
- [ ] 匿名访问不暴露服务端 Key
- [ ] `/api/chat/stream` 断开后 Node 进程仍存活
- [ ] PM2 重启后已完成任务仍可取回

## 八、回滚

```bash
cd /opt/jiayouhui
git log --oneline -5
git reset --hard <上一个稳定提交>
pm2 restart jiayouhui
curl -fsS https://familytravelhublz.top/api/health
```

生产回滚前先记录发布日期、提交号和失败现象，不要删除日志或覆盖旧配置。
