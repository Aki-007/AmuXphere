const { Server } = require("socket.io")
const db = require("./config/dbConfig")
const { setupVoiceChatHandlers } = require("./voiceChat")
const config = require("./config/config")

const activeUsers = {} // Active users stored in-memory
let io

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized")
  return io
}

const setupWebSocket = (server) => {
  io = new Server(server, {
    cors: { origin: [config.server.clientUrl], credentials: true },
  })

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    function broadcastParticipants(room_id) {
      const participants = Object.entries(activeUsers)
        .filter(([_, u]) => u.room_id === room_id)
        .map(([id, u]) => ({
          user_id: id,
          avatarUrl: u.avatarUrl,
          position: u.position,
        }))

      io.to(room_id).emit("update_participants", participants)
    }

    socket.on("user_joined_session", async ({ room_id, user_id, avatarUrl, role }) => {
      socket.join(room_id)

      activeUsers[user_id] = {
        user_id,
        room_id,
        socketId: socket.id,
        avatarUrl,
        role,
        position: { x: 0, y: 0, z: 0 },
      }

      broadcastParticipants(room_id)
    })

    socket.on("position_update", ({ user_id, room_id, position }) => {
      if (activeUsers[user_id]) {
        activeUsers[user_id].position = position

        broadcastParticipants(room_id)
      }
    })

    socket.on("leave_session", async ({ user_id, room_id }) => {
      const { role } = activeUsers[user_id]
      if (activeUsers[user_id]) {
        delete activeUsers[user_id] // Remove the user from in-memory store
        console.log(`User ${user_id} left room ${room_id}`)

        if (role === "Teacher") {
          try {
            // Emit event so clients can start redirection countdown
            io.to(room_id).emit("teacher_left")

            // Clean up DB session participants
            await db`DELETE FROM session_participants WHERE room_id = ${room_id}`
            // Also clean up in-memory
            setTimeout(
              () => {
                Object.keys(activeUsers).forEach((id) => {
                  if (activeUsers[id].room_id === room_id) {
                    delete activeUsers[id]
                  }
                })
              },
              5 * 60 * 1000,
            )
          } catch (err) {
            console.error("Error removing session participants:", err)
          }
        } else broadcastParticipants(room_id)
      }
    })

    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id)

      const user_id = Object.keys(activeUsers).find((id) => activeUsers[id].socketId === socket.id)
      if (!user_id) return

      const { room_id, role } = activeUsers[user_id]
      delete activeUsers[user_id]
      socket.broadcast.to(room_id).emit("voice-user-disconnected", { user_id })

      // If teacher left, notify all students and clear DB participants
      if (role === "Teacher") {
        try {
          // Emit event so clients can start redirection countdown
          io.to(room_id).emit("teacher_left")

          // Clean up DB session participants
          await db`DELETE FROM session_participants WHERE room_id = ${room_id}`
        } catch (err) {
          console.error("Error removing session participants:", err)
        }
      } else {
        broadcastParticipants(room_id)
      }
    })

    // Setup voice chat handlers
    setupVoiceChatHandlers(socket, io)
  })

  return io
}

module.exports = {
  setupWebSocket,
  getIO,
}
