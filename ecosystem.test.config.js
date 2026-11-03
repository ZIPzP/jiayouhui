// pm2 进程管理配置：测试环境（dev-test-opt 分支，端口 3001）
// 与生产实例并存于同一台服务器，互不干扰：不同目录 /opt/jiayouhui-test、不同端口、不同日志。
// 启动：pm2 start ecosystem.test.config.js
module.exports = {
  apps: [
    {
      name: 'jiayouhui-test',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      kill_timeout: 12000,
      merge_logs: true,
      time: true,
      error_file: './logs/test-error.log',
      out_file: './logs/test-out.log',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
