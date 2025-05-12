"use client"

import { useEffect, useState } from "react"
import "../css/Dashboard.css" // CSS file we'll create
import { useNavigate } from "react-router-dom"
import { useNotification } from "./NotificationContext"
import CreateClassroomModal from "./modals/CreateClassroomModal"
import JoinClassroomModal from "./modals/joinClassroomModal"
import ProfileDropdown from "./ProfileDropdown"
import config from "../config/config"

const Dashboard = () => {
  const [user, setUser] = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState(null)
  const navigate = useNavigate()
  const { success, error, info } = useNotification()

  // Fetch classrooms on component mount
  useEffect(() => {
    // Fetch user info from the backend
    fetch(`${config.apiUrl}/api/user`, {
      credentials: "include", // Ensures cookies (session) are sent
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch user data")
        }
        return response.json()
      })
      .then((data) => {
        if (data.user) {
          if (data.user.role && data.user.avatar_url) {
            setUser(data.user)
            fetchClassrooms()
          } else {
            navigate("/profile-setup")
          }
        } else {
          navigate("/")
        }
      })
      .catch((err) => {
        console.error("Error fetching user data:", err)
        error("Unable to fetch user information")
      })
  }, [navigate, error])

  const fetchClassrooms = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/room/list`, {
        credentials: "include",
      })
      const data = await response.json()
      setClassrooms(data.classrooms)
    } catch (err) {
      console.error("Error fetching classrooms:", err)
      error("Failed to load classrooms")
    }
  }

  const handleCreateClassroom = async (classroomName) => {
    try {
      const response = await fetch(`${config.apiUrl}/room/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Ensures authentication cookies are sent
        body: JSON.stringify({ room_name: classroomName }), // Correct key name
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create classroom")

      success(`Classroom "${classroomName}" created successfully!`)
      setIsModalOpen(false)
      fetchClassrooms() // Refresh list after creation
    } catch (err) {
      console.error("Error creating classroom:", err)
      error(err.message || "Failed to create classroom")
    }
  }

  const handleJoinClassroom = async (roomCode) => {
    try {
      const response = await fetch(`${config.apiUrl}/room/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ room_code: roomCode }), // Correct key name
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to join classroom")

      success(`Joined classroom successfully!`)
      setIsModalOpen(false)
      fetchClassrooms() // Refresh list after joining
    } catch (err) {
      console.error("Error joining classroom:", err)
      error(err.message || "Failed to join classroom")
    }
  }

  const handleEnterClassroom = async (roomId, roomName) => {
    try {
      info(`Preparing to enter ${roomName}...`)

      const endpoint =
        user.role === "Teacher"
          ? `${config.apiUrl}/room/${roomId}/activate`
          : `${config.apiUrl}/room/${roomId}/join-session`

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include", // Ensures session authentication
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to enter classroom")
      }

      success(`Entering ${roomName}...`)

      // Navigate to the classroom scene after a successful response
      setTimeout(() => navigate(`/classroom/${roomId}`), 1000)
    } catch (err) {
      console.error("Error entering classroom:", err)
      error(err.message || "Failed to enter classroom")
    }
  }

  const handleOpenModal = () => {
    if (!user) return
    if (user.role === "Teacher") {
      setModalType("create")
    } else if (user.role === "Student") {
      setModalType("join")
    }
    setIsModalOpen(true)
  }

  const handleLogout = () => {
    info("Logging out...")
    window.location.href = `${config.apiUrl}/auth/logout`
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="logo">AmuXphere</h1>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ProfileDropdown user={user} onLogout={handleLogout} />
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <h2>My Classrooms</h2>
          <button className="create-button" onClick={handleOpenModal}>
            {user?.role === "Teacher" ? "+ Create Classroom" : "+ Join Classroom"}
          </button>
        </div>

        {modalType === "create" && (
          <CreateClassroomModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onCreate={handleCreateClassroom} // Added onCreate
          />
        )}
        {modalType === "join" && (
          <JoinClassroomModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onJoin={handleJoinClassroom} // Added onJoin
          />
        )}

        <div className="classrooms-grid">
          {classrooms.length === 0 ? (
            <p>No classrooms found.</p>
          ) : (
            classrooms.map((room) => (
              <div key={room.id} className="classroom-card">
                <h3>{room.room_name}</h3>
                {user.role === "Teacher" && (
                  <p className="created-date">Created {new Date(room.created_at).toLocaleDateString()}</p>
                )}
                {user.role === "Student" && <p className="created-date">Teacher: {room.teacher_name}</p>}

                <div className="room-info">
                  <div>
                    <span className="label">Room Code:</span>
                    <strong>{room.code}</strong>
                  </div>
                  <div>
                    <span className="label">Participants:</span>
                    <strong>{room.total_participants}</strong>
                  </div>
                </div>

                <button className="enter-button" onClick={() => handleEnterClassroom(room.id, room.room_name)}>
                  Enter Classroom
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
