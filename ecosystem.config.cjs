module.exports = {
  apps: [
    {
      name: 'ikigai-sensei',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=ikigai-sensei-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        JWT_SECRET: 'ikigai-dev-secret-key-2026',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
