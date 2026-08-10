#!/bin/bash
# ============================================================
# 家游汇 · 阿里云服务器一键部署脚本（Ubuntu 22.04 / Debian 12）
# 用法（在服务器终端粘贴执行）：
#   wget -O setup.sh https://raw.githubusercontent.com/ZIPzP/jiayouhui/main/deploy/server-setup.sh
#   bash setup.sh
# 脚本会依次：装 Node -> 装 pm2 -> 克隆代码 -> 填 Key/口令 -> 启动 -> 配 Nginx/HTTPS
# ============================================================
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo bash setup.sh"; exit 1
fi

echo "================ 1/6 安装 Node.js 20 ================"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "node: $(node -v)"

echo "================ 2/6 安装 pm2 ================"
npm i -g pm2

echo "================ 3/6 克隆代码 ================"
REPO="https://github.com/ZIPzP/jiayouhui.git"
read -p "GitHub 仓库地址（回车使用默认 $REPO）: " REPO_INPUT
if [ -n "$REPO_INPUT" ]; then REPO="$REPO_INPUT"; fi
mkdir -p /opt
cd /opt
if [ -d /opt/jiayouhui ]; then
  echo "目录已存在，执行 git pull 更新..."
  cd /opt/jiayouhui && git pull || true
else
  git clone "$REPO" jiayouhui
  cd /opt/jiayouhui
fi

echo "================ 4/6 配置 DeepSeek Key（输入不显示，粘贴后回车） ================"
read -s -p "DeepSeek API Key: " KEY; echo ""
node tools/set-key.js "$KEY"

echo "================ 5/6 设置访问口令（输入不显示） ================"
read -s -p "访问口令（请牢记）: " PASS; echo ""
node tools/set-passcode.js "$PASS"

echo "================ 6/6 启动程序 ================"
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1
pm2 status

echo ""
echo "✅ 程序已启动（端口 3000）。下面配置域名访问..."

read -p "你的域名（如 www.example.com）: " DOMAIN

echo "================ 安装 Nginx 反向代理 ================"
apt-get install -y nginx
sed "s/你的域名.com/$DOMAIN/g" /opt/jiayouhui/deploy/nginx.conf > /etc/nginx/conf.d/jiayouhui.conf
nginx -t && systemctl reload nginx
echo "✅ Nginx 已配置：http://$DOMAIN  ->  127.0.0.1:3000"
echo "⚠️  请确认阿里云控制台：域名解析已添加 A 记录（@ 和 www 都指向本机公网 IP），安全组/防火墙放行 80/443"

echo ""
read -p "是否申请 Let's Encrypt 免费 HTTPS 证书？(y/n): " SSL
if [ "$SSL" = "y" ] || [ "$SSL" = "Y" ]; then
  read -p "证书通知邮箱: " EMAIL
  apt-get install -y certbot python3-certbot-nginx || true
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --redirect --non-interactive || echo "⚠️ HTTPS 申请失败：请确认域名解析已生效（等几分钟再重试，或改用阿里云控制台免费证书）"
fi

echo ""
echo "🎉 全部完成！打开 https://$DOMAIN 输入访问口令即可使用"
echo "后续更新：cd /opt/jiayouhui && git pull && pm2 restart jiayouhui"