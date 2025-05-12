const db = require("../config/dbConfig") // Adjust to your db setup
const { nanoid } = require("nanoid") // For generating unique room codes

// ✅ Create Room Controller (for teachers)
const createRoom = async (req, res) => {
  try {
    const { room_name } = req.body
    const user = req.user

    // Check if the user is a teacher
    if (user.role !== "Teacher") {
      return res.status(403).json({ error: "Only teachers can create rooms" })
    }

    // Generate a unique 6-character room code
    const roomCode = nanoid(6)

    // const result = await db.query("INSERT INTO rooms (teacher_id, room_name, code) VALUES ($1, $2, $3) RETURNING *", [
    //   user.id,
    //   room_name,
    //   roomCode,
    // ])
    const result = await db`INSERT INTO rooms (teacher_id, room_name, code) VALUES (${user.id}, ${room_name}, ${roomCode}) RETURNING *`

    res.status(201).json({
      message: "Room created successfully",
      room: result[0],
    })
  } catch (err) {
    console.error("Error creating room:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// ✅ Join Room Controller (for students)
const joinRoom = async (req, res) => {
  try {
    const { room_code } = req.body
    const user = req.user

    // Check if user is a student
    if (user.role !== "Student") {
      return res.status(403).json({ error: "Only students can join rooms" })
    }

    // Check if room exists and is active
    // const roomResult = await db.query("SELECT * FROM rooms WHERE code = $1", [room_code])
    const roomResult = await db`SELECT * FROM rooms WHERE code = ${room_code}`

    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" })
    }

    const room = roomResult[0]

    // Check if the student is already in the room
    // const existing = await db.query("SELECT * FROM participants WHERE room_id = $1 AND student_id = $2", [
    //   room.id,
    //   user.id,
    // ])
    const existing = await db`SELECT * FROM participants WHERE room_id = ${room.id} AND student_id = ${user.id}`

    if (existing.length > 0) {
      return res.status(400).json({ error: "You have already joined this room" })
    }

    // Add participant to the room
    await db`INSERT INTO participants (room_id, student_id) VALUES (${room.id}, ${user.id})`
    
    res.status(200).json({
      message: "Joined room successfully",
      room,
    })
  } catch (err) {
    console.error("Error joining room:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

const getUserClassrooms = async (req, res) => {
  try {
    const user = req.user

    let query, values

    if (user.role === "Teacher") {
      // Fetch classrooms created by the teacher
      query = `
        SELECT r.*, 
          (SELECT COUNT(*) FROM participants p WHERE p.room_id = r.id) AS total_participants
        FROM rooms r
        WHERE r.teacher_id = $1
      `
      values = [user.id]
    } else if (user.role === "Student") {
      // Fetch classrooms the student has joined
      query = `
        SELECT r.*, u.name AS teacher_name, 
          (SELECT COUNT(*) FROM participants p WHERE p.room_id = r.id) AS total_participants
        FROM rooms r
        JOIN users u ON r.teacher_id = u.id
        WHERE r.id IN (SELECT room_id FROM participants WHERE student_id = $1)
        `
      values = [user.id]
    } else {
      return res.status(403).json({ error: "Invalid user role" })
    }

    //const result = await db.query(query, values)

    const result = (user.role === "Teacher") 
      ? await db`SELECT r.*, (SELECT COUNT(*) FROM participants p WHERE p.room_id = r.id) AS total_participants
        FROM rooms r
        WHERE r.teacher_id = ${user.id}
        `
      : await db`SELECT r.*, u.name AS teacher_name, (SELECT COUNT(*) FROM participants p WHERE p.room_id = r.id) AS total_participants
        FROM rooms r
        JOIN users u ON r.teacher_id = u.id
        WHERE r.id IN (SELECT room_id FROM participants WHERE student_id = ${user.id})
        `

    res.status(200).json({ classrooms: result })
  } catch (err) {
    console.error("Error fetching classrooms:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// GET /room/:id
const getRoomDetails = async (req, res) => {
  try {
    const { id } = req.params

    // Fetch room details including teacher info
    // const roomQuery = `
    //   SELECT r.id, r.room_name, r.code, r.is_active, r.created_at, 
    //          u.name AS teacher_name, u.id AS teacher_id 
    //   FROM rooms r
    //   JOIN users u ON r.teacher_id = u.id
    //   WHERE r.id = $1;
    // `

    const result = await db`
      SELECT r.id, r.room_name, r.code, r.is_active, r.created_at, u.name AS teacher_name, u.id AS teacher_id 
      FROM rooms r
      JOIN users u ON r.teacher_id = u.id
      WHERE r.id = ${id}`

    if (result.length === 0) {
      return res.status(404).json({ error: "Room not found" })
    }

    res.status(200).json(result[0])
  } catch (err) {
    console.error("Error fetching room details:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// POST /room/:id/activate
const activateRoom = async (req, res) => {
  try {
    console.log("inside activateRoom")

    const { id } = req.params // Room ID
    const user = req.user
    console.log(req.params, req.user)

    // Ensure only the teacher can activate the room
    const roomResult = await db`SELECT * FROM rooms WHERE id = ${id}`
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" })
    }

    const room = roomResult[0]
    if (room.teacher_id !== user.id) {
      return res.status(403).json({ error: "Only the teacher can activate this room" })
    }

    // Activate the room
    await db`UPDATE rooms SET is_active = TRUE WHERE id = ${id}`

    res.status(200).json({ message: "Classroom activated successfully" })
  } catch (err) {
    console.error("Error activating classroom:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// POST /room/:id/join-session
const joinClassroomSession = async (req, res) => {
  try {
    const { id } = req.params // Room ID
    const user = req.user
    const userId = user.id
    const avatarUrl = user.avatar_url

    // Ensure user is a student
    if (user.role !== "Student") {
      return res.status(403).json({ error: "Only students can join classrooms" })
    }

    // Check if the room is active
    const roomResult = await db`SELECT * FROM rooms WHERE id = ${id}`
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" })
    }

    const room = roomResult[0]
    if (!room.is_active) {
      return res.status(403).json({ error: "Classroom is not active yet" })
    }

    // Add student to the session (tracking presence)
    await db`
      INSERT INTO session_participants (room_id, student_id, avatar_url) VALUES (${id}, ${user.id}, ${user.avatar_url}) ON CONFLICT DO NOTHING`

    res.status(200).json({ message: "Joined classroom successfully" })
    req.app.get("io").to(id).emit("user_joined_session", { roomId: id, userId: user.id, avatarUrl: user.avatar_url })
  } catch (err) {
    console.error("Error joining classroom:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// POST /room/:id/deactivate
const deactivateRoom = async (req, res) => {
  try {
    const { id } = req.params // Room ID
    const user = req.user

    // Ensure only the teacher can deactivate the room
    const roomResult = await db`SELECT * FROM rooms WHERE id = ${id}`
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" })
    }

    const room = roomResult[0]
    if (room.teacher_id !== user.id) {
      return res.status(403).json({ error: "Only the teacher can deactivate this room" })
    }

    // Deactivate the room
    await db`UPDATE rooms SET is_active = false WHERE id = ${id}`

    // Clear the session participants (remove all students from the active session)
    await db`DELETE FROM session_participants WHERE room_id = ${id}`

    res.status(200).json({ message: "Classroom deactivated successfully" })
  } catch (err) {
    console.error("Error deactivating classroom:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// POST /room/:id/leave-session
const leaveClassroomSession = async (req, res) => {
  try {
    const { userId } = req.body
    const { roomId } = req.params
    const user = req.user

    await db`DELETE FROM session_participants WHERE room_id = ${roomId} AND student_id = ${userId}`
    console.log("User left: ", user.name)
    res.json({ message: "User left the room" })
  } catch (error) {
    console.error("Error leaving room:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

// GET /room/:id/attendance
const exportAttendance = async (req, res) => {
  try {
    const { id } = req.params

    // Fetch session participants with timestamps
    const result = await db`
       SELECT u.name, u.email, sp.joined_at
       FROM session_participants sp
       JOIN users u ON sp.student_id = u.id
       WHERE sp.room_id = ${id}`

    if (result.length === 0) {
      return res.status(404).json({ error: "No attendance data found" })
    }

    res.status(200).json({
      message: "Attendance data retrieved successfully",
      data: result,
    })
  } catch (err) {
    console.error("Error fetching attendance:", err)
    res.status(500).json({ error: "Internal server error" })
  }
}

// GET /room/:id/participants
const fetchParticipants = async (req, res) => {
  try {
    const { roomId } = req.params
    const result = await db`SELECT user_id, avatar_url FROM session_participants WHERE room_id = ${roomId}`

    res.json(result)
  } catch (error) {
    console.error("Error fetching participants:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

module.exports = {
  createRoom,
  joinRoom,
  getUserClassrooms,
  activateRoom,
  deactivateRoom,
  joinClassroomSession,
  exportAttendance,
  getRoomDetails,
  leaveClassroomSession,
  fetchParticipants,
}
