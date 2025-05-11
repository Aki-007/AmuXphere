const express = require("express")
const session = require("express-session")
const helmet = require("helmet")
const cors = require("cors")
const passport = require("./config/passportConfig")
const authRoutes = require("./routes/authRoutes")
const apiRoutes = require("./routes/apiRoutes")
const roomRoutes = require("./routes/rooms")
const { localIP } = require("./config/server")
const http = require("http")
const { setupWebSocket } = require("./socketServer")
const { initializeMediasoup } = require("./voiceChat")
const config = require("./config/config")

const app = express()
const server = http.createServer(app)
const io = setupWebSocket(server)

const PORT = config.server.port

app.set("io", io)

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(
  session({
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  }),
)
app.use(passport.initialize())
app.use(passport.session())
app.use(helmet())
app.use(
  cors({
    origin: [config.server.clientUrl],
    credentials: true,
  }),
)
app.use("/src", express.static("src"))
// Routes
app.use("/auth", authRoutes)
app.use("/api", apiRoutes)
app.use("/room", roomRoutes)

app.get("/api/user", (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({ user: req.user })
  } else {
    return res.json({ user: null })
  }
})

// Initialize mediasoup
initializeMediasoup()
  .then(() => console.log("🎤 Mediasoup initialized successfully"))
  .catch((err) => console.error("🎤 Failed to initialize mediasoup:", err))

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on localhost:${PORT}`)
})
