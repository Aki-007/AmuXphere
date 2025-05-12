require("dotenv").config()

// Configuration object for the application
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  },

  // Database configuration
  database: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    name: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    url: process.env.DB_URL,
  },

  // Authentication configuration
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    sessionSecret: process.env.SESSION_SECRET || "your-session-secret",
  },
}

module.exports = config
