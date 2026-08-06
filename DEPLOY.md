# 🚀 部署指南：GitHub 推送 + 阿里云域名上线

本项目是 Node.js 应用（零依赖），需要**一台能运行 Node 的服务器**来承载 AI 调用（域名本身只是网址，不能运行代码）。

## 一、推送到 GitHub

1. 在 GitHub 新建一个仓库（如 `jiayouhui`，Public 或 Private 均可）
2. 在本项目目录执行（把 `<你的用户名>` 替换掉）：

```bash
git init
git add -A
git commit -m "init: 家游汇 家庭旅游推荐与攻略"
git branch -M main
git remote add origin https://github.com/<你的用户名>/jiayouhui.git
git push -u origin main
```

> 推送时按提示登录 GitHub（可用 Personal Access Token 作为密码）。**不要**把 `config.local.json` 提交上去（已在 .gitignore 排除，里面是你的 DeepSeek Key 和访问口令）。

## 二、准备阿里云服务器

1. 购买一台**轻量应用服务器 / ECS**（2核2G 即可，系统选 Ubuntu 22.04 或 CentOS）
2. 阿里云控制台 **安全组/防火墙** 放行：`80`、`443`（`3000` 可只对内网，或先临时放行测试）
3. 在服务器安装 Node.js（推荐用 nvm）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
node -v   # 确认有 node
```

## 三、把代码放到服务器并启动

```bash
# 1) 克隆代码（需要你 GitHub 仓库的访问权限）
cd /opt
git clone https://github.com/<你的用户名>/jiayouhui.git
cd jiayouhui

# 2) 在服务器上写入敏感配置（这一步很关键！）
node tools/set-key.js sk-你的DeepSeekKey        # 服务端内置 DeepSeek Key
node tools/set-passcode.js 你的访问口令          # 启用访问口令（可选但推荐）

# 3) 安装 pm2 并启动
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # 开机自启（按提示执行生成的命令）
```

> `config.local.json` 只在服务器本地生成，不会进 git，别人克隆你的仓库也拿不到 Key/口令。

## 四、域名解析 + Nginx + HTTPS

1. **阿里云域名解析**（云解析 DNS）添加两条 **A 记录**：
   - `@` → 服务器公网 IP
   - `www` → 服务器公网 IP
   （等几分钟生效：`ping 你的域名` 能通即成功）

2. **安装 Nginx 并配置反向代理**：

```bash
apt install -y nginx        # Ubuntu
cp deploy/nginx.conf /etc/nginx/conf.d/jiayouhui.conf
# 编辑该文件，把 server_name 改成你的域名
nginx -t && systemctl reload nginx
```

3. **开启 HTTPS（免费证书）**，二选一：
   - 阿里云控制台 → 数字证书管理服务 → 免费证书（DV）→ 申请后下载 Nginx 版，上传到服务器配置
   - 或用 certbot 自动签发：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名 -d www.你的域名
```

完成后访问 `https://你的域名` 即可。

## 五、后续更新（手动或自动）

- **手动**：服务器上 `cd /opt/jiayouhui && git pull && pm2 restart jiayouhui`
- **自动**：已提供 `.github/workflows/deploy.yml`，在 GitHub 仓库 Settings → Secrets 填好 `SSH_HOST / SSH_USER / SSH_KEY`，以后 `git push` 到 main 就自动部署

## 六、安全建议

- 访问口令：部署到公网后**务必**启用（`node tools/set-passcode.js 你的口令`），避免他人消耗你的 DeepSeek 配额
- DeepSeek Key 只写在服务器 `config.local.json`，不要提交、不要发给别人
- 阿里云安全组只开 80/443；服务器本地 3000 端口不必对外开放