"use client"

// src/components/PopupMessage.js
import { useEffect } from "react"

function PopupMessage({ message, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000) // Close the popup after 3 seconds

      return () => clearTimeout(timer) // Clean up the timer on unmount
    }
  }, [message, onClose])

  if (!message) return null // Don't render anything if no message

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "green",
        color: "white",
        padding: "20px",
        borderRadius: "10px",
        zIndex: 1000,
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      }}
    >
      <p>{message}</p>
      <button
        onClick={onClose}
        style={{
          backgroundColor: "white",
          color: "green",
          padding: "10px",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        OK
      </button>
    </div>
  )
}

export default PopupMessage
