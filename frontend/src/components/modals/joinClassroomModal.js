"use client"

import { useState } from "react"
import "./ClassroomModal.css" // Reusing the same CSS

const JoinClassroomModal = ({ isOpen, onClose, onJoin }) => {
  const [roomCode, setRoomCode] = useState("")

  const handleJoin = () => {
    if (!roomCode.trim()) return
    onJoin(roomCode)
    setRoomCode("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">Join Classroom</h2>
        <p className="modal-description">Enter the room code to join an existing classroom.</p>
        <div className="modal-input-group">
          <label className="modal-label">Room Code</label>
          <input
            type="text"
            className="modal-input"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
        </div>
        <button className="modal-create-button" onClick={handleJoin}>
          Join Classroom
        </button>
      </div>
    </div>
  )
}

export default JoinClassroomModal
