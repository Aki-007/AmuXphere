const express = require("express")
const bcrypt = require("bcrypt")
const passport = require("passport")
const router = express.Router()
const isAuthenticated = require("../middlewares/authMiddleware")
const db = require("../config/dbConfig")
const config = require("../config/config")

// Google OAuth Routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }))

router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
  const isProfileComplete = req.user.isProfileComplete

  if (isProfileComplete) {
    res.redirect(`${config.server.clientUrl}/dashboard`) // Redirect to the dashboard if the profile is complete
  } else {
    res.redirect(`${config.server.clientUrl}/profile-setup`) // Redirect to profile setup if the profile is incomplete
  }
})

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body

  try {
    // Check if email already exists in the users table
    //const emailCheckQuery = `SELECT id FROM users WHERE email = $1`
    const emailCheckResult = await db`SELECT id FROM users WHERE email = ${email}`

    if (emailCheckResult.length > 0) {
      return res.status(400).json({ error: "Email is already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert into users table
    const userQuery = `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`
    const userResult = await db`INSERT INTO users (name, email) VALUES (${name}, ${email}) RETURNING id`

    const userId = userResult[0].id

    // Insert into local_auth table
    const localAuthQuery = `INSERT INTO local_auth (user_id, password) VALUES ($1, $2)`
    await db`INSERT INTO local_auth (user_id, password) VALUES (${userId}, ${hashedPassword})`

    const fetchQuery = `SELECT * FROM users WHERE id = $1`
    const fetchResult = await db`SELECT * FROM users WHERE id = ${userId}`

    const user = fetchResult[0]

    req.logIn(user, (err) => {
      if (err) {
        console.error("Error logging in after signup:", err)
        return res.status(500).json({ error: "Error logging in after signup." })
      }

      res.status(200).json({ message: "User registered successfully", user })
    })
  } catch (err) {
    console.error("Error during registration:", err)
    res.status(500).json({ error: "Registration failed" })
  }
})

// Login a user
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err)
    if (!user) return res.status(401).json({ error: info.message })

    req.logIn(user, (err) => {
      if (err) return next(err)
      res.json({ user })
    })
  })(req, res, next)
})

// Logout Route
router.get("/logout", (req, res, next) => {
  console.log("Logging out user:", req.user)
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err)
      return next(err)
    }
    req.session.destroy(() => {
      console.log("Session destroyed")
      res.clearCookie("connect.sid")
      res.redirect(config.server.clientUrl)
    })
  })
})

module.exports = router
