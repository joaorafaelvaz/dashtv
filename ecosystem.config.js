module.exports = {
  apps: [
    {
      name: 'dashtv',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/dashtv', // ajustar para o caminho real no servidor Linux
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/dashtv-error.log',
      out_file: '/var/log/pm2/dashtv-out.log',
      merge_logs: true,
    },
  ],
}
