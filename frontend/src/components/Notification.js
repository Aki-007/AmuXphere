"use client"

import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import "../css/Notification.css"

const Notification = ({ id, message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10)

    // Trigger exit animation before actual removal
    return () => {
      setIsVisible(false)
    }
  }, [])

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle size={18} />
      case "error":
        return <AlertCircle size={18} />
      case "warning":
        return <AlertTriangle size={18} />
      case "info":
      default:
        return <Info size={18} />
    }
  }

  return (
    <div className={`notification ${type} ${isVisible ? "visible" : ""}`}>
      <div className="notification-icon">{getIcon()}</div>
      <div className="notification-content">{message}</div>
      <button className="notification-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}

export default Notification
