"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, MicOff, Volume2, VolumeX, Radio, Volume1 } from "lucide-react"
import "../css/VoiceChat.css"

const VoiceChat = ({ socket, roomId, userId }) => {
  const [isMuted, setIsMuted] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState([])
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [testingAudio, setTestingAudio] = useState(false)
  const [speakerVolume, setSpeakerVolume] = useState(1)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [showControls, setShowControls] = useState(true)

  // WebRTC and mediasoup state
  const deviceRef = useRef(null)
  const producerTransportRef = useRef(null)
  const consumerTransportRef = useRef(null)
  const producerRef = useRef(null)
  const consumersRef = useRef({})
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioAnalyserRef = useRef(null)
  const audioDataRef = useRef(new Uint8Array(128))
  const animationFrameRef = useRef(null)
  const audioElementsRef = useRef({})

  // Add log entry
  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prevLogs) => [...prevLogs, { timestamp, message, type }])
    console.log(`[VoiceChat] ${message}`)
  }

  // Initialize voice chat
  useEffect(() => {
    if (!socket || !roomId || !userId) return

    addLog("Initializing voice chat...")

    // Import mediasoup client dynamically
    import("mediasoup-client")
      .then(({ Device }) => {
        addLog("Mediasoup client loaded")

        // Join the voice room
        addLog(`Joining voice room ${roomId}...`)
        socket.emit("voice-join-room", { room_id: roomId, user_id: userId }, async ({ rtpCapabilities, error }) => {
          if (error) {
            addLog(`Error joining voice room: ${error}`, "error")
            setError("Failed to join voice chat")
            return
          }

          addLog("Successfully joined voice room")
          addLog("Received RTP capabilities from server")

          try {
            // Create mediasoup device
            addLog("Creating mediasoup device...")
            const device = new Device()
            await device.load({ routerRtpCapabilities: rtpCapabilities })
            deviceRef.current = device
            addLog("Mediasoup device created successfully")

            // Create producer transport (for sending audio)
            createProducerTransport()

            // Create consumer transport (for receiving audio)
            createConsumerTransport()

            // Get existing producers
            addLog("Fetching existing producers...")
            socket.emit("get-producers", (producers) => {
              addLog(`Received ${producers.length} existing producers`)
              producers.forEach((producer) => {
                if (producer.userId !== userId) {
                  addLog(`Consuming producer ${producer.producerId} from user ${producer.userId}`)
                  consumeProducer(producer.producerId, producer.userId)
                }
              })
            })

            setIsConnected(true)
          } catch (err) {
            addLog(`Error setting up mediasoup device: ${err.message}`, "error")
            setError("Failed to initialize voice chat")
          }
        })

        // Listen for new producers
        socket.on("new-producer", ({ producerId, userId: producerUserId }) => {
          addLog(`New producer detected: ${producerId} from user ${producerUserId}`)
          if (producerUserId !== userId) {
            consumeProducer(producerId, producerUserId)
          }
        })

        // Listen for user audio toggle events
        socket.on("user-audio-toggle", ({ userId: toggleUserId, muted }) => {
          addLog(`User ${toggleUserId} ${muted ? "muted" : "unmuted"} their microphone`)
          setActiveUsers((prev) => prev.map((user) => (user.id === toggleUserId ? { ...user, muted } : user)))
        })

        // Listen for user disconnections
        socket.on("voice-user-disconnected", ({ userId: disconnectedUserId }) => {
          addLog(`User ${disconnectedUserId} disconnected from voice chat`)

          // Remove user from active users
          setActiveUsers((prev) => prev.filter((user) => user.id !== disconnectedUserId))

          // Close consumer if exists
          if (consumersRef.current[disconnectedUserId]) {
            consumersRef.current[disconnectedUserId].close()
            delete consumersRef.current[disconnectedUserId]
            addLog(`Closed consumer for user ${disconnectedUserId}`)
          }

          // Remove audio element
          if (audioElementsRef.current[disconnectedUserId]) {
            audioElementsRef.current[disconnectedUserId].pause()
            audioElementsRef.current[disconnectedUserId].srcObject = null
            delete audioElementsRef.current[disconnectedUserId]
          }
        })

        // Listen for producer closed events
        socket.on("producer-closed", ({ consumerId, producerId }) => {
          addLog(`Producer ${producerId} closed, closing consumer ${consumerId}`)
          if (consumersRef.current[consumerId]) {
            consumersRef.current[consumerId].close()
            delete consumersRef.current[consumerId]
          }
        })

        // Listen for audio test results
        socket.on("audio-test-result", ({ success }) => {
          addLog(`Audio test ${success ? "succeeded" : "failed"}`)
          setTestingAudio(false)
        })
      })
      .catch((err) => {
        addLog(`Error importing mediasoup-client: ${err.message}`, "error")
        setError("Failed to load voice chat module")
      })

    // Cleanup on unmount
    return () => {
      cleanupVoiceChat()
    }
  }, [socket, roomId, userId])

  // Create producer transport
  const createProducerTransport = () => {
    addLog("Creating producer transport...")
    socket.emit("createProducerTransport", {}, ({ id, iceParameters, iceCandidates, dtlsParameters, error }) => {
      if (error) {
        addLog(`Error creating producer transport: ${error}`, "error")
        return
      }

      addLog(`Producer transport created with ID: ${id}`)

      try {
        const transport = deviceRef.current.createSendTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
        })

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          addLog("Producer transport connect event")
          socket.emit("connectProducerTransport", { transportId: transport.id, dtlsParameters }, ({ error }) => {
            if (error) {
              addLog(`Error connecting producer transport: ${error}`, "error")
              errback(error)
              return
            }
            addLog("Producer transport connected successfully")
            callback()
          })
        })

        transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
          addLog(`Producer transport produce event, kind: ${kind}`)
          socket.emit("produce", { transportId: transport.id, kind, rtpParameters }, ({ id, error }) => {
            if (error) {
              addLog(`Error producing: ${error}`, "error")
              errback(error)
              return
            }
            addLog(`Producer created with ID: ${id}`)
            callback({ id })
          })
        })

        producerTransportRef.current = transport
        addLog("Producer transport setup complete")
      } catch (err) {
        addLog(`Error setting up producer transport: ${err.message}`, "error")
      }
    })
  }

  // Create consumer transport
  const createConsumerTransport = () => {
    addLog("Creating consumer transport...")
    socket.emit("createConsumerTransport", {}, ({ id, iceParameters, iceCandidates, dtlsParameters, error }) => {
      if (error) {
        addLog(`Error creating consumer transport: ${error}`, "error")
        return
      }

      addLog(`Consumer transport created with ID: ${id}`)

      try {
        const transport = deviceRef.current.createRecvTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
        })

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          addLog("Consumer transport connect event")
          socket.emit("connectConsumerTransport", { transportId: transport.id, dtlsParameters }, ({ error }) => {
            if (error) {
              addLog(`Error connecting consumer transport: ${error}`, "error")
              errback(error)
              return
            }
            addLog("Consumer transport connected successfully")
            callback()
          })
        })

        consumerTransportRef.current = transport
        addLog("Consumer transport setup complete")
      } catch (err) {
        addLog(`Error setting up consumer transport: ${err.message}`, "error")
      }
    })
  }

  // Consume a producer's audio
  const consumeProducer = (producerId, producerUserId) => {
    if (!consumerTransportRef.current) {
      addLog("Cannot consume producer: consumer transport not ready", "error")
      return
    }

    addLog(`Consuming producer ${producerId} from user ${producerUserId}...`)
    socket.emit(
      "consume",
      {
        transportId: consumerTransportRef.current.id,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      },
      async ({ id, kind, rtpParameters, producerUserId, error }) => {
        if (error) {
          addLog(`Error consuming producer: ${error}`, "error")
          return
        }

        addLog(`Creating consumer for producer ${producerId}...`)

        try {
          // Create consumer
          const consumer = await consumerTransportRef.current.consume({
            id,
            producerId,
            kind,
            rtpParameters,
          })

          // Store consumer
          consumersRef.current[producerUserId] = consumer
          addLog(`Consumer created with ID: ${consumer.id}`)

          // Resume consumer
          socket.emit("resume-consumer", { consumerId: consumer.id }, ({ error }) => {
            if (error) {
              addLog(`Error resuming consumer: ${error}`, "error")
              return
            }
            addLog(`Consumer ${consumer.id} resumed successfully`)
          })

          // Add remote track to audio element
          const remoteStream = new MediaStream([consumer.track])
          const audioElement = new Audio()
          audioElement.srcObject = remoteStream
          audioElement.volume = speakerVolume

          // Store audio element for volume control
          audioElementsRef.current[producerUserId] = audioElement

          audioElement.oncanplay = () => {
            addLog(`Audio from user ${producerUserId} ready to play`)
          }

          audioElement.onplay = () => {
            addLog(`Started playing audio from user ${producerUserId}`)
          }

          audioElement.onerror = (err) => {
            addLog(`Error playing audio from user ${producerUserId}: ${err.message}`, "error")
          }

          audioElement.play().catch((error) => {
            addLog(`Error playing audio: ${error.message}`, "error")
          })

          // Add user to active users list
          setActiveUsers((prev) => {
            if (!prev.find((user) => user.id === producerUserId)) {
              return [...prev, { id: producerUserId, muted: false }]
            }
            return prev
          })

          // Test audio reception
          testAudioReception(remoteStream, producerUserId)
        } catch (err) {
          addLog(`Error in consume process: ${err.message}`, "error")
        }
      },
    )
  }

  // Test audio reception
  const testAudioReception = (stream, producerUserId) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      const analyser = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray)

        // Check if there's any audio signal
        const sum = dataArray.reduce((acc, val) => acc + val, 0)
        const average = sum / bufferLength

        if (average > 5) {
          // Threshold for detecting audio
          addLog(`Detected audio from user ${producerUserId}, level: ${average.toFixed(2)}`)
          socket.emit("test-audio", { success: true })
          return true
        }
        return false
      }

      // Check for audio for a few seconds
      let attempts = 0
      const audioCheckInterval = setInterval(() => {
        if (checkAudio() || attempts > 10) {
          clearInterval(audioCheckInterval)
          if (attempts > 10) {
            addLog(`No audio detected from user ${producerUserId} after multiple attempts`, "warning")
          }
        }
        attempts++
      }, 500)
    } catch (err) {
      addLog(`Error testing audio reception: ${err.message}`, "error")
    }
  }

  // Toggle mute/unmute
  const toggleMute = async () => {
    try {
      if (isMuted) {
        // Unmute: Start producing audio
        addLog("Unmuting microphone...")

        if (!producerRef.current) {
          // Get user media
          addLog("Requesting microphone access...")
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          streamRef.current = stream
          addLog("Microphone access granted")

          // Create audio analyzer for testing
          setupAudioAnalyzer(stream)

          // Create producer
          addLog("Creating audio producer...")
          const track = stream.getAudioTracks()[0]
          producerRef.current = await producerTransportRef.current.produce({ track })
          addLog(`Producer created with ID: ${producerRef.current.id}`)
        } else {
          // Resume existing producer
          addLog("Resuming existing producer...")
          await producerRef.current.resume()
          addLog("Producer resumed")
        }
      } else {
        // Mute: Pause producer
        addLog("Muting microphone...")
        if (producerRef.current) {
          await producerRef.current.pause()
          addLog("Producer paused")
        }
      }

      // Update mute state
      setIsMuted(!isMuted)

      // Notify other users
      socket.emit("toggle-audio", { muted: !isMuted })
      addLog(`Notified others that microphone is now ${!isMuted ? "muted" : "unmuted"}`)
    } catch (error) {
      addLog(`Error toggling mute: ${error.message}`, "error")
      setError("Failed to toggle microphone")
    }
  }

  // Setup audio analyzer
  const setupAudioAnalyzer = (stream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      const analyser = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256

      audioAnalyserRef.current = analyser
      audioDataRef.current = new Uint8Array(analyser.frequencyBinCount)

      // Start audio level visualization
      visualizeAudio()
    } catch (err) {
      addLog(`Error setting up audio analyzer: ${err.message}`, "error")
    }
  }

  // Visualize audio levels
  const visualizeAudio = () => {
    if (!audioAnalyserRef.current) return

    audioAnalyserRef.current.getByteFrequencyData(audioDataRef.current)

    // Calculate audio level
    const sum = audioDataRef.current.reduce((acc, val) => acc + val, 0)
    const average = sum / audioDataRef.current.length

    // Update audio level state (0-100 range)
    setAudioLevel(Math.min(100, average * 2))

    // If speaking, log it occasionally (not every frame)
    if (average > 10 && Math.random() < 0.05) {
      addLog(`Speaking detected, audio level: ${average.toFixed(2)}`)
    }

    animationFrameRef.current = requestAnimationFrame(visualizeAudio)
  }

  // Test audio connection
  const testAudioConnection = () => {
    setTestingAudio(true)
    addLog("Testing audio connection...")

    // Send test audio
    if (!isMuted && producerRef.current) {
      addLog("Sending test audio signal...")
      // The actual test is just checking if audio is flowing
      socket.emit("test-audio", { success: true })
    } else {
      addLog("Cannot test audio while muted", "warning")
      setTestingAudio(false)
    }
  }

  // Update volume for all audio elements
  useEffect(() => {
    Object.values(audioElementsRef.current).forEach((audioEl) => {
      if (audioEl) {
        audioEl.volume = speakerVolume
      }
    })
  }, [speakerVolume])

  // Toggle voice chat controls visibility
  const toggleControls = () => {
    setShowControls(!showControls)
  }

  // Cleanup function
  const cleanupVoiceChat = () => {
    addLog("Cleaning up voice chat...")

    // Stop audio visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        addLog("Microphone track stopped")
      })
    }

    // Close producer
    if (producerRef.current) {
      producerRef.current.close()
      addLog("Producer closed")
    }

    // Close all consumers
    Object.entries(consumersRef.current).forEach(([userId, consumer]) => {
      consumer.close()
      addLog(`Consumer for user ${userId} closed`)
    })

    // Close producer transport
    if (producerTransportRef.current) {
      producerTransportRef.current.close()
      addLog("Producer transport closed")
    }

    // Close consumer transport
    if (consumerTransportRef.current) {
      consumerTransportRef.current.close()
      addLog("Consumer transport closed")
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((err) => {
        addLog(`Error closing audio context: ${err.message}`, "error")
      })
    }

    addLog("Voice chat cleanup complete")
  }

  // Get volume icon based on current volume level
  const getVolumeIcon = () => {
    if (speakerVolume === 0) return <VolumeX size={20} />
    if (speakerVolume < 0.5) return <Volume1 size={20} />
    return <Volume2 size={20} />
  }

  return (
    <div className={`voice-chat-container ${showControls ? "expanded" : "collapsed"}`}>
      <div className="voice-chat-header" onClick={toggleControls}>
        <span>Voice Chat</span>
        <div className="voice-chat-toggle">{showControls ? "▼" : "▲"}</div>
      </div>

      {showControls && (
        <>
          <div className="voice-chat-controls">
            <div className="control-group">
              <button
                className={`voice-chat-button ${isMuted ? "muted" : "unmuted"}`}
                onClick={toggleMute}
                disabled={!isConnected}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {!isMuted && (
                <div className="audio-level-indicator">
                  <div className="audio-level-bar" style={{ width: `${audioLevel}%` }}></div>
                </div>
              )}
            </div>

            <div className="control-group">
              <button
                className="voice-chat-button volume-button"
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                title="Adjust speaker volume"
              >
                {getVolumeIcon()}
              </button>

              {showVolumeSlider && (
                <div className="volume-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={speakerVolume}
                    onChange={(e) => setSpeakerVolume(Number.parseFloat(e.target.value))}
                    className="volume-slider"
                  />
                </div>
              )}
            </div>

            <button
              className="voice-chat-button test-button"
              onClick={testAudioConnection}
              disabled={!isConnected || isMuted || testingAudio}
              title="Test audio connection"
            >
              <Radio size={18} />
            </button>

            <button
              className="voice-chat-button logs-button"
              onClick={() => setShowLogs(!showLogs)}
              title={showLogs ? "Hide logs" : "Show logs"}
            >
              {showLogs ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          {error && <div className="voice-chat-error">{error}</div>}

          {activeUsers.length > 0 && (
            <div className="voice-chat-users">
              <div className="voice-chat-users-title">Active speakers:</div>
              <div className="voice-chat-users-list">
                {activeUsers.map((user) => (
                  <div key={user.id} className="voice-chat-user">
                    <div className={`voice-indicator ${user.muted ? "muted" : "speaking"}`}></div>
                    <span>User {user.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showLogs && (
            <div className="voice-chat-logs">
              <div className="voice-chat-logs-title">Connection Logs:</div>
              <div className="voice-chat-logs-content">
                {logs.map((log, index) => (
                  <div key={index} className={`log-entry log-${log.type}`}>
                    <span className="log-time">{log.timestamp}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default VoiceChat
