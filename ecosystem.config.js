// pm2 进程管理配置（阿里云服务器部署用）
// 安装：npm i -g pm2   →   启动：pm2 start ecosystem.config.js
// 注意：本服务把限流计数、12306 缓存与 AI 任务放在进程内存里，因此只能单实例（instances: 1），
// 不能直接改成 cluster 模式，否则任务轮询会打到没有该任务的实例上。
module.exports = {
  apps: [
    {
      name: 'jiayouhui',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      // 收到 SIGTERM 后给在跑请求收尾的时间（server.js 有优雅关闭），默认 1.6s 太短
      kill_timeout: 12000,
      restart_delay: 2000,
      max_restarts: 10,
      merge_logs: true,
      time: true,
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
