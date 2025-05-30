module.exports = {
    apps: [
        {
            name: 'express-app',          // name of your app
            script: './index.js',         // entry point to your app
            instances: 1,                 // or 'max' for all CPU cores
            autorestart: true,
            watch: false,                 // set to true in dev only
            max_memory_restart: '300M',   // auto-restart if memory > 300MB
            ignore_watch: [
                "node_modules",
                "input.json",
                "*.log",
                "tmp",
                "myApp.*.json",
                "package-lock.json"
            ],
            env: {
                NODE_ENV: 'development',
                PORT: 3000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 80
            }
        }
    ]
}