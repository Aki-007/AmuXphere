const express = require("express")
const router = express.Router()
const roomController = require("../controllers/roomController")
const isAuthenticated = require("../middlewares/authMiddleware")

// Create Room - Only for Teachers
router.post("/create", roomController.createRoom)

// Join Room - Only for Students
router.post("/join", roomController.joinRoom)

router.get("/list", roomController.getUserClassrooms)

router.post("/:id/activate", roomController.activateRoom)

router.post("/:id/deactivate", roomController.deactivateRoom)

router.post("/:id/join-session", roomController.joinClassroomSession)

router.get("/:id/attendance", roomController.exportAttendance)

router.get("/:id", roomController.getRoomDetails)

router.post("/:id/leave-session", roomController.leaveClassroomSession)

router.get("/:id/participants", roomController.fetchParticipants)

module.exports = router
