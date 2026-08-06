// pm2 进程管理配置（阿里云服务器部署用）
// 安装：npm i -g pm2   →   启动：pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'jiayouhui',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};