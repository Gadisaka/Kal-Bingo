// PM2 Ecosystem Configuration
// This ensures environment variables are loaded BEFORE the app starts

const dotenv = require("dotenv");
const path = require("path");

// Load .env file
const envPath = path.resolve(__dirname, ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn("⚠️ Could not load .env file:", result.error.message);
}

module.exports = {
  apps: [
    {
      name: "sheqay-backend",
      script: "index.js",
      cwd: __dirname,

      // Pass environment variables from .env
      env: {
        NODE_ENV: "production",
        ...result.parsed, // All variables from .env file
      },

      // Watch for changes (disable in production)
      watch: false,

      // Restart settings
      max_restarts: 10,
      restart_delay: 1000,

      // Logging
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // Cluster mode (optional - use 1 for single instance)
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
