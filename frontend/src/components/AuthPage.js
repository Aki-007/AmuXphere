"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useNotification } from "./NotificationContext"
import "../css/AuthPage.css"
import config from "../config/config"

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true) // Toggle between Login and Signup
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

  const navigate = useNavigate()
  const { success, error } = useNotification()

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const url = isLogin ? `${config.apiUrl}/auth/login` : `${config.apiUrl}/auth/register`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        if (isLogin) {
          // For login, redirect to the dashboard
          success("Login successful! Redirecting to dashboard...")
          setTimeout(() => navigate("/dashboard"), 2000)
        } else {
          // For signup, redirect to the profile setup page
          success("Sign up successful! Redirecting to profile setup...")
          setTimeout(() => navigate("/profile-setup"), 2000)
        }
      } else {
        error(data.error || "Something went wrong")
      }
    } catch (err) {
      console.error("Error during submission:", err)
      error("An error occurred. Please try again.")
    }
  }

  const isDisabled = !formData.email.trim() || !formData.password.trim() || (!isLogin && !formData.name.trim())

  return (
    <div className="auth-container">
      <h1 id="title">AmuSphere</h1>
      <p id="subtitle">{isLogin ? "Sign in to your account" : "Create a new account"}</p>
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <label>Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
          </>
        )}
        <label> Email </label>
        <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />

        <label>Password</label>
        <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />

        <button type="submit" disabled={isDisabled} title={isDisabled ? "Please fill out all fields to proceed" : ""}>
          {isLogin ? "Login" : "Sign Up"}
        </button>
      </form>

      <button className="switch-btn" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
      </button>

      <hr />

      <a href="http://localhost:5000/auth/google" style={{ textDecoration: "none" }}>
        <button className="google-btn">
          <svg className="google-logo" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Sign in with Google
        </button>
      </a>
    </div>
  )
}

export default AuthPage
