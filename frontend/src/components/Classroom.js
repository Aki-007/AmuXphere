"use client"

import { useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import ClassroomModel from "../components/ClassroomModel"
import "../css/Classroom.css"
import config from "../config/config"

const Classroom = () => {
  const { id } = useParams()
  const [room, setRoom] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/room/${id}`, {
          credentials: "include",
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to load room")

        console.log(data)
        setRoom(data)
      } catch (error) {
        console.error("Error loading classroom:", error)
      }
    }

    const fetchAvatar = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/user`, { credentials: "include" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load avatar")
        console.log(data.user.avatar_url)
        setAvatarUrl(data.user.avatar_url)
      } catch (error) {
        console.error("Error loading avatar:", error)
      }
    }

    fetchRoomData()
    fetchAvatar()
  }, [id])

  return <div>{room ? <ClassroomModel avatarUrl={avatarUrl} /> : <p>Loading classroom...</p>}</div>
}

export default Classroom
