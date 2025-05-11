const { Pool } = require("pg")
const config = require("./config")

const pool = new Pool({
  user: config.database.user,
  host: config.database.host,
  database: config.database.name,
  password: config.database.password,
  port: config.database.port,
})

pool.on("connect", () => {
  console.log("Connected to the PostgreSQl database")
})

module.exports = pool
