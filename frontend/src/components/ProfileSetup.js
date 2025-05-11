"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useNotification } from "./NotificationContext"
import AvatarEditor from "./AvatarEditor" // Ready Player Me iframe component
import "../css/ProfileSetup.css" // Separate stylesheet
import config from "../config/config"

function ProfileSetup() {
  const [role, setRole] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRoleSelected, setIsRoleSelected] = useState(false)
  const [isAvatarSelected, setIsAvatarSelected] = useState(false)
  const navigate = useNavigate()
  const { success, error, info } = useNotification()

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!role || !avatarUrl) {
      error("Please select a role and create your avatar.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${config.apiUrl}/api/profile-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role, avatarUrl }),
      })

      const data = await response.json()

      if (response.ok) {
        success("Profile setup successful! Redirecting...")

        await fetch(`${config.apiUrl}/api/generate-sprites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ avatarUrl }),
        })

        setTimeout(() => navigate("/dashboard"), 2000)
      } else {
        error(data.error || "Something went wrong. Please try again.")
      }
    } catch (err) {
      console.error("Error setting up profile:", err)
      error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = () => {
    if (role) {
      setIsRoleSelected(true) // Set the flag to true once "Continue" is clicked
      info("Now create your avatar")
    } else {
      error("Please select a role to continue")
    }
  }

  const handleAvatarContinue = () => {
    if (avatarUrl) {
      handleSubmit() // Proceed with submitting the profile data after the avatar is selected
    } else {
      error("Please create an avatar to continue")
    }
  }

  return (
    <div className="profile-setup-container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Select Your Role</h2>
          <p className="card-description">Choose your role to access the appropriate dashboard</p>
        </div>

        <div className="card-content">
          <div
            className={`role-option ${role === "Teacher" ? "selected" : ""}`}
            onClick={() => handleRoleSelect("Teacher")}
          >
            <input
              type="radio"
              id="teacher"
              name="role"
              value="Teacher"
              checked={role === "Teacher"}
              onChange={() => handleRoleSelect("Teacher")}
            />
            <label htmlFor="teacher" className="role-label">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-clapperboard h-5 w-5"
              >
                <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"></path>
                <path d="m6.2 5.3 3.1 3.9"></path>
                <path d="m12.4 3.4 3.1 4"></path>
                <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>
              </svg>
              <div className="role-details">
                <div className="role-name">Teacher</div>
                <div className="role-description">Create and manage virtual classrooms</div>
              </div>
            </label>
          </div>

          <div
            className={`role-option ${role === "Student" ? "selected" : ""}`}
            onClick={() => handleRoleSelect("Student")}
          >
            <input
              type="radio"
              id="student"
              name="role"
              value="Student"
              checked={role === "Student"}
              onChange={() => handleRoleSelect("Student")}
            />
            <label htmlFor="student" className="role-label">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-graduation-cap h-5 w-5"
              >
                <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path>
                <path d="M22 10v6"></path>
                <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>
              </svg>
              <div className="role-details">
                <div className="role-name">Student</div>
                <div className="role-description">Join and participate in virtual classrooms</div>
              </div>
            </label>
          </div>
        </div>

        {isRoleSelected && !isAvatarSelected && (
          <div className="avatar-section">
            <h2 className="card-title">Create Your Avatar</h2>
            <AvatarEditor
              onAvatarSave={(url) => {
                setAvatarUrl(url)
                success("Avatar selected successfully.")
                setIsAvatarSelected(true) // Mark avatar as selected
              }}
            />
          </div>
        )}

        {/* First continue button */}
        {!isAvatarSelected && (
          <div className="card-footer">
            <button
              type="button"
              onClick={handleContinue} // Handle Continue button press to load AvatarEditor
              className="continue-button"
              disabled={!role || isLoading}
            >
              {isLoading ? "Processing..." : "Continue"}
            </button>
          </div>
        )}

        {/* Second continue button */}
        {isAvatarSelected && (
          <div className="card-footer">
            <button
              type="button"
              onClick={handleAvatarContinue} // Proceed after avatar is selected
              className="continue-button"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Save Profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileSetup
