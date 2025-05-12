const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const LocalStrategy = require("passport-local").Strategy
const pool = require("./dbConfig") // PostgreSQL connection
const db = require("./dbConfig")
const bcrypt = require("bcrypt")

const config = require("./config")

passport.use(
  new GoogleStrategy(
    {
      clientID: config.auth.googleClientId,
      clientSecret: config.auth.googleClientSecret,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value

        // Check if user exists in users table
        //const userQuery = `SELECT id, role, avatar_url FROM users WHERE email = $1`
        const userResult = await db`SELECT id, role, avatar_url FROM users WHERE email = ${email}`

        let userId
        let isProfileComplete = false

        if (userResult.length === 0) {
          // User doesn't exist, create a new one
          //const insertUserQuery = `INSERT INTO users (name, email) VALUES (${profile.displayName}, ${email}) RETURNING id`
          //const insertUserResult = await db.query(insertUserQuery, [profile.displayName, email])
          insertUserResult = await db`INSERT INTO users (name, email) VALUES (${profile.displayName}, ${email}) RETURNING id`
          userId = insertUserResult.id

          // Add to google_auth table
          //const googleAuthQuery = `INSERT INTO google_auth (user_id, google_id) VALUES (${userId}, ${profile.id})`
          await db`INSERT INTO google_auth (user_id, google_id) VALUES (${userId}, ${profile.id})`
        } else {
          userId = userResult[0].id
          isProfileComplete = !!userResult[0].role && !!userResult[0].avatar_url
        }

        return done(null, { id: userId, isProfileComplete })
      } catch (err) {
        console.error("Error during Google login:", err)
        return done(err)
      }
    },
  ),
)

passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      // Join users and local_auth tables to fetch the user and password

      //const result = await db.query(query, [email])
      const result = await db`
        SELECT users.id, users.name, users.email, users.role, users.avatar_url, local_auth.password
        FROM users
        INNER JOIN local_auth ON users.id = local_auth.user_id
        WHERE users.email = ${email}
      `
      //console.log(result)
      if (result.length === 0) {
        return done(null, false, { message: "Email not registered" })
      }

      let isProfileComplete
      const user = result[0]

      const isValidPassword = await bcrypt.compare(password, user.password)

      if (!isValidPassword) {
        return done(null, false, { message: "Invalid password" })
      }

      isProfileComplete = !!user.role && !!user.avatar_url

      return done(null, { id: user.id, isProfileComplete }) // Pass the user object to the session
    } catch (error) {
      console.error("Error authenticating user:", error)
      return done(error)
    }
  }),
)

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => {
  try {
    //const userQuery = "SELECT * FROM users WHERE id = $1"
    const result = await db`SELECT * FROM users WHERE id = ${id}`
    if (result.length === 0) {
      return done(null, false)
    }

    const user = result[0]
    user.isProfileComplete = !!user.role && !!user.avatar_url

    done(null, user)
  } catch (err) {
    done(err, null)
  }
})

module.exports = passport
