"use client"

import { useState } from "react"
import "./ClassroomModal.css"

const CreateClassroomModal = ({ isOpen, onClose, onCreate }) => {
  const [classroomName, setClassroomName] = useState("")

  const handleCreate = () => {
    if (!classroomName.trim()) return
    onCreate(classroomName)
    setClassroomName("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">Create New Classroom</h2>
        <p className="modal-description">Enter a name for your new virtual classroom.</p>
        <div className="modal-input-group">
          <label className="modal-label">Classroom Name</label>
          <input
            type="text"
            className="modal-input"
            placeholder="e.g., Physics 101"
            value={classroomName}
            onChange={(e) => setClassroomName(e.target.value)}
          />
        </div>
        <button className="modal-create-button" onClick={handleCreate}>
          Create Classroom
        </button>
      </div>
    </div>
  )
}

export default CreateClassroomModal
