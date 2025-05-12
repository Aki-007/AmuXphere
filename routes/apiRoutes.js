const express = require("express")
const passport = require("passport")
const router = express.Router()
const authMiddleware = require("../middlewares/authMiddleware")
const db = require("../config/dbConfig")
const isAuthenticated = require("../middlewares/authMiddleware")
const generateAvatarSprites = require("../spriteGenerator/generateAvatarSprites")
const roomController = require("../controllers/roomController")

router.get("/user", async (req, res) => {
  try {
    const userId = req.user.id

    // Fetch user details
    const userQuery = `SELECT * FROM users WHERE id = $1`
    const userResult = await db`SELECT * FROM users WHERE id = ${userId}`
    const user = userResult[0]

    // Check login method
    const localQuery = `SELECT * FROM local_auth WHERE user_id = $1`
    const localResult = await db`SELECT * FROM local_auth WHERE user_id = ${userId}`

    const loginMethod = localResult.length > 0 ? "local" : "google"

    res.json({ user, loginMethod })
  } catch (err) {
    console.error("Error fetching user:", err)
    res.status(500).json({ error: "Failed to fetch user" })
  }
})

const isAuthenticated_ = (req, res, next) => {
  console.log("Session data:", req.session) // Debug log for session
  console.log("User:", req.user) // Debug log for user

  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ error: "Unauthorized" })
}

/// Profile Setup
router.post("/profile-setup", isAuthenticated, async (req, res) => {
  const { role, avatarUrl } = req.body
  console.log(req.body)
  const userId = req.session.passport.user // Get logged-in user's ID from session

  if (!role || !avatarUrl) {
    return res.status(400).json({ error: "Role and avatarUrl are required." })
  }

  try {
    // Update the user's profile in the database
    const query = `
      UPDATE users
      SET role = $1, avatar_url = $2
      WHERE id = $3 RETURNING *;
    `
    const result = await db`
      UPDATE users
      SET role = ${role}, avatar_url = ${avatarUrl}
      WHERE id = ${userId} RETURNING *
    `

    if (result.length > 0) {
      // Send the response immediately
      res.status(200).json({ message: "Profile updated successfully." })
    } else {
      res.status(400).json({ error: "Failed to update profile." })
    }
  } catch (error) {
    console.error("Error updating profile:", error)
    res.status(500).json({ error: "Internal server error." })
  }
})

router.post("/generate-sprites", isAuthenticated, (req, res) => {
  const { avatarUrl } = req.body
  const userId = req.session.passport.user
  // Respond immediately so the user can proceed
  res.json({ success: true, message: "Sprite generation started." })

  // Run the sprite generation in the background
  setTimeout(() => {
    generateAvatarSprites(userId, avatarUrl)
      .then(() => console.log(`Sprites generated for user ${userId}`))
      .catch((err) => console.error(`Sprite generation failed: ${err.message}`))
  }, 0) // Non-blocking execution
})

// Session Data
router.get("/session-data", isAuthenticated_, (req, res) => {
  console.log("Session data:", req.user)
  res.json(req.session)
})

// Create Room - Only for Teachers
router.post("/create", roomController.createRoom)

// Join Room - Only for Students
router.post("/join", roomController.joinRoom)

module.exports = router
