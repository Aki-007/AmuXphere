"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF, OrbitControls, Environment } from "@react-three/drei"
import React, { Suspense, useRef, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import io from "socket.io-client"
import * as THREE from "three"
import VoiceChat from "./VoiceChat"
import config from "../config/config"

// Keyboard Movement Controls
const useKeyboardControls = () => {
  const keys = useRef({})

  useEffect(() => {
    const handleKeyDown = (event) => (keys.current[event.code] = true)
    const handleKeyUp = (event) => (keys.current[event.code] = false)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  return keys
}

const Avatar = ({ avatarUrl, avatarRef, socket, user_id, room_id, isLocal }) => {
  const { scene } = useGLTF(avatarUrl)
  const keys = useKeyboardControls()
  const [isReady, setIsReady] = useState(false)
  const [targetPosition, setTargetPosition] = useState(null)

  useEffect(() => {
    if (scene && avatarRef && avatarRef.current) {
      setIsReady(true) // mark as ready when model is loaded and ref is assigned
    }
  }, [scene, avatarRef])

  useEffect(() => {
    if (!socket || isLocal) return

    const handleUpdate = (users) => {
      const user = users.find((u) => u.user_id === user_id)
      if (user && user.position) {
        setTargetPosition(user.position)
      }
    }

    socket.on("update_positions", handleUpdate)

    return () => socket.off("update_positions", handleUpdate)
  }, [socket, user_id, isLocal])

  useFrame(() => {
    if (!isReady || !avatarRef.current) return

    if (isLocal) {
      // Local avatar movement
      const speed = 0.05
      const moveVector = { x: 0, z: 0 }

      if (keys.current["KeyW"] || keys.current["ArrowUp"]) moveVector.z -= speed
      if (keys.current["KeyS"] || keys.current["ArrowDown"]) moveVector.z += speed
      if (keys.current["KeyA"] || keys.current["ArrowLeft"]) moveVector.x -= speed
      if (keys.current["KeyD"] || keys.current["ArrowRight"]) moveVector.x += speed

      avatarRef.current.position.x -= moveVector.x
      avatarRef.current.position.z -= moveVector.z

      // Emit position to server
      if (socket && user_id) {
        socket.emit("position_update", {
          user_id,
          room_id,
          position: {
            x: avatarRef.current.position.x,
            y: avatarRef.current.position.y,
            z: avatarRef.current.position.z,
          },
        })
      }
    } else {
      // Remote avatar interpolation
      if (!targetPosition) return

      avatarRef.current.position.lerp(
        new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
        0.1, // tweak for smoothness (0.05 = slow; 0.2 = snappy)
      )
    }
  })

  return <primitive ref={avatarRef} object={scene} scale={1} position={[-4, 0, -7]} />
}

const CameraController = ({ avatarRef }) => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (avatarRef && avatarRef.current) setIsReady(true)
  }, [avatarRef])

  useFrame(({ camera }) => {
    if (isReady && avatarRef.current) {
      const offset = { x: 0, y: 2, z: 2 } // Camera offset behind avatar
      camera.position.set(
        avatarRef.current.position.x + offset.x,
        avatarRef.current.position.y + offset.y,
        avatarRef.current.position.z - offset.z,
      )

      camera.lookAt(avatarRef.current.position) // Keep camera looking at the avatar
      camera.lookAt(avatarRef.current.position.x, avatarRef.current.position.y, avatarRef.current.position.z + 4)
    }
  })

  return null // No need to return anything
}

const ClassroomModel = ({ avatarUrl }) => {
  const { scene } = useGLTF('https://3ndc7naemj4cqmf5.public.blob.vercel-storage.com/model-MGAjD72wM4CSPU7nfUcJn8IvmO9GEo.glb')
  const avatarRef = useRef()
  const navigate = useNavigate()
  const { id: room_id } = useParams()
  const [user_id, setUserId] = useState(null)
  const [role, setRole] = useState(null)
  const [isSceneReady, setIsSceneReady] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/user`, { credentials: "include" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load avatar")
        console.log(data.user)
        setUserId(data.user.id)
        setRole(data.user.role)
      } catch (error) {
        console.error("Error loading avatar:", error)
      }
    }

    fetchUser()
  }, [])

  useEffect(() => {
    if (scene) {
      setIsSceneReady(true)
    }
  }, [scene])

  const [socket, setSocket] = useState(null) // Store socket instance

  useEffect(() => {
    if (!user_id || !room_id) return
    // Create WebSocket connection only when the classroom is loaded
    const newSocket = io(config.apiUrl) // Update with backend URL
    setSocket(newSocket)

    newSocket.emit("user_joined_session", { room_id, user_id, avatarUrl, role })

    return () => {
      newSocket.emit("leave_session", { room_id, user_id }) // Notify before disconnecting
      newSocket.disconnect() // Disconnect when leaving classroom
    }
  }, [room_id, user_id, avatarUrl, role])

  const [activeParticipants, setActiveParticipants] = useState([])

  const avatarRefs = useRef({}) // Store refs in an object

  useEffect(() => {
    if (!socket) {
      console.log("No socket found")
      return
    }

    socket.on("update_participants", (participants) => {
      setActiveParticipants(participants)

      participants.forEach((participant) => {
        const id = participant.user_id || participant.user_id

        if (!avatarRefs.current[id]) {
          avatarRefs.current[id] = React.createRef()
        }
      })
    })

    return () => socket.off("update_participants")
  }, [socket, isSceneReady])

  useEffect(() => {
    if (!socket) {
      console.log("No socket found")
      return
    }

    socket.on("update_positions", (usersPositions) => {
      setActiveParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          usersPositions[participant.user_id]
            ? { ...participant, position: usersPositions[participant.user_id] }
            : participant,
        ),
      )
    })

    return () => socket.off("update_positions")
  }, [socket])

  useEffect(() => {
    activeParticipants.forEach((participant) => {
      const ref = avatarRefs.current[participant.user_id]
      if (ref && ref.current && participant.position) {
        ref.current.position.set(participant.position.x, participant.position.y, participant.position.z)
      }
    })
  }, [activeParticipants])

  useEffect(() => {
    if (!socket) {
      console.log("No socket found")
      return
    }

    socket.on("teacher_left", () => {
      console.log("Teacher left! You'll be redirected in 5 minutes...")

      setTimeout(
        () => {
          window.location.href = "/dashboard" // or use react-router
        },
        5 * 60 * 1000,
      ) // 5 minutes
    })
  }, [socket])

  const leaveClassroom = async () => {
    try {
      if (socket) {
        socket.emit("leave_session", { room_id, user_id }) // Notify server
        socket.disconnect() // Disconnect WebSocket
      }

      const endpoint =
        role === "Teacher"
          ? `${config.apiUrl}/room/${room_id}/deactivate`
          : `${config.apiUrl}/room/${room_id}/leave-session`

      await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id }),
      })

      navigate("/dashboard") // Redirect after leaving
    } catch (error) {
      console.error("Error leaving session:", error)
    }
  }

  return (
    <>
      {/* Leave Button */}
      <button
        onClick={leaveClassroom}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          padding: "10px 15px",
          fontSize: "16px",
          backgroundColor: "#ff4d4d",
          color: "white",
          border: "none",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        Leave Classroom
      </button>

      {/* Voice Chat Component */}
      {socket && user_id && room_id && <VoiceChat socket={socket} roomId={room_id} userId={user_id} />}

      <Canvas id="canvas" style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh" }}>
        <ambientLight intensity={1} />

        {/* Classroom Model */}
        <primitive object={scene} scale={1} position={[0, 0, 0]} />

        {/* Avatar */}
        <Avatar
          avatarUrl={avatarUrl}
          avatarRef={avatarRef}
          socket={socket}
          user_id={user_id}
          room_id={room_id}
          isLocal={true}
        />

        {activeParticipants.map(
          (participant) =>
            participant.user_id !== user_id && (
              <Suspense fallback={null} key={participant.user_id}>
                <Avatar
                  key={participant.user_id}
                  avatarUrl={participant.avatarUrl}
                  avatarRef={avatarRefs.current[participant.user_id]}
                  user_id={participant.user_id}
                  room_id={room_id}
                  isLocal={false}
                />
              </Suspense>
            ),
        )}

        {/* Camera Controller (Now follows the avatar) */}
        <CameraController avatarRef={avatarRef} />

        <OrbitControls enableRotate />

        {/* Environment */}
        <Environment preset="sunset" />
      </Canvas>
    </>
  )
}

export default ClassroomModel
