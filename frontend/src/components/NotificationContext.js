"use client"

import { createContext, useContext, useState, useCallback } from "react"
import Notification from "./Notification"

// Create context
const NotificationContext = createContext()

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider")
  }
  return context
}

// Provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])

  // Add a notification
  const showNotification = useCallback((message, type = "success", duration = 3000) => {
    const id = Date.now()
    setNotifications((prev) => [...prev, { id, message, type, duration }])

    // Auto-remove notification after duration
    setTimeout(() => {
      removeNotification(id)
    }, duration)

    return id
  }, [])

  // Remove a notification by ID
  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  // Shorthand methods for different notification types
  const success = useCallback(
    (message, duration) => {
      return showNotification(message, "success", duration)
    },
    [showNotification],
  )

  const error = useCallback(
    (message, duration) => {
      return showNotification(message, "error", duration)
    },
    [showNotification],
  )

  const info = useCallback(
    (message, duration) => {
      return showNotification(message, "info", duration)
    },
    [showNotification],
  )

  const warning = useCallback(
    (message, duration) => {
      return showNotification(message, "warning", duration)
    },
    [showNotification],
  )

  const value = {
    notifications,
    showNotification,
    removeNotification,
    success,
    error,
    info,
    warning,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notifications-container">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            id={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
