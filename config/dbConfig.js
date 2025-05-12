// import postgres from 'postgres'
const postgres = require('postgres')
const { Pool } = require("pg")
const config = require("./config")

// const pool = new Pool({
//   user: config.database.user,
//   host: config.database.host,
//   database: config.database.name,
//   password: config.database.password,
//   port: config.database.port,
// })

// pool.on("connect", () => {
//   console.log("Connected to the PostgreSQl database")
// })

// module.exports = pool


const connectionString = config.database.url
const sql = postgres(connectionString, {
    ssl: {
        rejectUnauthorized: false
    }
})

// Export sql directly so you can use it in queries
module.exports = sql