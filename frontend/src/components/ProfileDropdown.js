"use client"

import { useState, useRef, useEffect } from "react"
import "../css/ProfileDropdown.css"

const ProfileMenu = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="profile-menu-container" ref={menuRef}>
      <button className="profile-icon" onClick={() => setIsOpen(!isOpen)}>
        <img src="images/hamburger-menu.png" alt="User Avatar" />
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <ul>
            <li>Profile</li>
            <li>Settings</li>
            <li onClick={onLogout}>
              <span className="icon">↩</span> Log out
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
