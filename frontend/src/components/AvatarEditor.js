"use client"

import { useEffect, useRef } from "react"
// import "../css/AvatarEditor.css"

function AvatarEditor({ onAvatarSave }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const handleMessage = (event) => {
      const json = parse(event)

      // Ensure the message is from Ready Player Me
      if (json?.source !== "readyplayerme") {
        return
      }

      // Subscribe to all Ready Player Me events
      if (json.eventName === "v1.frame.ready") {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            target: "readyplayerme",
            type: "subscribe",
            eventName: "v1.**",
          }),
          "*",
        )
      }

      // Avatar URL retrieved
      if (json.eventName === "v1.avatar.exported") {
        console.log("Avatar URL:", json.data.url)
        onAvatarSave(json.data.url) // Pass the avatar URL to parent component
        iframeRef.current.style.display = "none" // Hide the iframe
      }

      // User ID retrieved
      if (json.eventName === "v1.user.set") {
        console.log(`User with ID ${json.data.id} set.`)
      }
    }

    // Add event listener for messages
    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [onAvatarSave])

  const parse = (event) => {
    try {
      return JSON.parse(event.data)
    } catch (error) {
      return null
    }
  }

  const handleOpenIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.style.display = "block" // Show the iframe
    }
  }

  return (
    <div>
      <button className="readyplayerme-button" onClick={handleOpenIframe}>
        Open Avatar Editor
      </button>
      <iframe
        className="readyplayerme"
        title="avatar-creator"
        ref={iframeRef}
        src="https://demo.readyplayer.me/avatar?frameApi"
        style={{
          display: "none", // Initially hidden
          width: "100%",
          height: "100%",
          border: "none",
        }}
        allow="camera *; microphone *; clipboard-write"
      ></iframe>
    </div>
  )
}

export default AvatarEditor
