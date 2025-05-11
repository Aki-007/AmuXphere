const mediasoup = require("mediasoup")
const os = require("os")

// Global variables
let worker
let router
const rooms = {}

// Get the local IP address
const getLocalIp = () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if ("IPv4" === iface.family && !iface.internal) {
        return iface.address
      }
    }
  }
  return "127.0.0.1"
}

// Configuration
const config = {
  mediasoup: {
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: "debug",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
      ],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: getLocalIp(),
        },
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },
  },
}

// Initialize mediasoup
const initializeMediasoup = async () => {
  try {
    console.log("🎤 [Mediasoup] Creating worker...")
    worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    })

    console.log("🎤 [Mediasoup] Worker created successfully")

    worker.on("died", () => {
      console.error("🎤 [Mediasoup] Worker died, exiting in 2 seconds...")
      setTimeout(() => process.exit(1), 2000)
    })

    // Create a router
    console.log("🎤 [Mediasoup] Creating router...")
    router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs })
    console.log("🎤 [Mediasoup] Router created successfully")

    return router
  } catch (error) {
    console.error("🎤 [Mediasoup] Error initializing mediasoup:", error)
    throw error
  }
}

// Create a WebRTC transport
const createWebRtcTransport = async (roomId) => {
  try {
    console.log(`🎤 [Mediasoup] Creating WebRTC transport for room ${roomId}...`)
    const transport = await router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
    })

    console.log(`🎤 [Mediasoup] Transport created with ID: ${transport.id}`)

    transport.on("dtlsstatechange", (dtlsState) => {
      console.log(`🎤 [Mediasoup] Transport DTLS state changed to ${dtlsState}`)
      if (dtlsState === "closed") {
        transport.close()
      }
    })

    transport.on("close", () => {
      console.log(`🎤 [Mediasoup] Transport closed: ${transport.id}`)
    })

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    }
  } catch (error) {
    console.error("🎤 [Mediasoup] Error creating WebRTC transport:", error)
    throw error
  }
}

// Setup voice chat socket handlers
const setupVoiceChatHandlers = (socket, io) => {
  console.log(`🎤 [VoiceChat] Setting up handlers for socket ${socket.id}`)

  // Create or join a voice room
  socket.on("voice-join-room", async ({ room_id, user_id }, callback) => {
    try {
      console.log(`🎤 [VoiceChat] User ${user_id} joining voice room ${room_id}`)

      // Create room if it doesn't exist
      if (!rooms[room_id]) {
        console.log(`🎤 [VoiceChat] Creating new room: ${room_id}`)
        rooms[room_id] = {
          id: room_id,
          peers: new Map(),
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        }
      }

      // Add peer to room
      rooms[room_id].peers.set(socket.id, {
        socket,
        userId: user_id,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      })

      // Join socket to room
      socket.join(`voice-${room_id}`)
      socket.voiceRoomId = room_id
      socket.userId = user_id

      // Get router RTP capabilities
      const rtpCapabilities = router.rtpCapabilities
      console.log(`🎤 [VoiceChat] Sending RTP capabilities to user ${user_id}`)

      callback({ rtpCapabilities })
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error joining voice room:`, error)
      callback({ error: error.message })
    }
  })

  // Create WebRTC transport for producing (sending) audio
  socket.on("createProducerTransport", async (data, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      console.log(`🎤 [VoiceChat] Creating producer transport for user ${socket.userId}`)
      const room = rooms[socket.voiceRoomId]
      const { transport, params } = await createWebRtcTransport(socket.voiceRoomId)

      // Store transport
      room.transports.set(transport.id, transport)
      room.peers.get(socket.id).transports.set(transport.id, {
        transport,
        type: "producer",
      })

      console.log(`🎤 [VoiceChat] Producer transport created: ${transport.id}`)
      callback(params)
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error creating producer transport:`, error)
      callback({ error: error.message })
    }
  })

  // Create WebRTC transport for consuming (receiving) audio
  socket.on("createConsumerTransport", async (data, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      console.log(`🎤 [VoiceChat] Creating consumer transport for user ${socket.userId}`)
      const room = rooms[socket.voiceRoomId]
      const { transport, params } = await createWebRtcTransport(socket.voiceRoomId)

      // Store transport
      room.transports.set(transport.id, transport)
      room.peers.get(socket.id).transports.set(transport.id, {
        transport,
        type: "consumer",
      })

      console.log(`🎤 [VoiceChat] Consumer transport created: ${transport.id}`)
      callback(params)
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error creating consumer transport:`, error)
      callback({ error: error.message })
    }
  })

  // Connect producer transport
  socket.on("connectProducerTransport", async ({ transportId, dtlsParameters }, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      console.log(`🎤 [VoiceChat] Connecting producer transport ${transportId} for user ${socket.userId}`)
      const room = rooms[socket.voiceRoomId]
      const peer = room.peers.get(socket.id)
      const transportData = peer.transports.get(transportId)

      if (!transportData || transportData.type !== "producer") {
        throw new Error(`Producer transport not found: ${transportId}`)
      }

      await transportData.transport.connect({ dtlsParameters })
      console.log(`🎤 [VoiceChat] Producer transport connected: ${transportId}`)
      callback({ success: true })
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error connecting producer transport:`, error)
      callback({ error: error.message })
    }
  })

  // Connect consumer transport
  socket.on("connectConsumerTransport", async ({ transportId, dtlsParameters }, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      console.log(`🎤 [VoiceChat] Connecting consumer transport ${transportId} for user ${socket.userId}`)
      const room = rooms[socket.voiceRoomId]
      const peer = room.peers.get(socket.id)
      const transportData = peer.transports.get(transportId)

      if (!transportData || transportData.type !== "consumer") {
        throw new Error(`Consumer transport not found: ${transportId}`)
      }

      await transportData.transport.connect({ dtlsParameters })
      console.log(`🎤 [VoiceChat] Consumer transport connected: ${transportId}`)
      callback({ success: true })
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error connecting consumer transport:`, error)
      callback({ error: error.message })
    }
  })

  // Produce audio
  socket.on("produce", async ({ transportId, kind, rtpParameters }, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      console.log(`🎤 [VoiceChat] User ${socket.userId} producing ${kind}`)
      const room = rooms[socket.voiceRoomId]
      const peer = room.peers.get(socket.id)
      const transportData = peer.transports.get(transportId)

      if (!transportData || transportData.type !== "producer") {
        throw new Error(`Producer transport not found: ${transportId}`)
      }

      const producer = await transportData.transport.produce({
        kind,
        rtpParameters,
        appData: { userId: socket.userId },
      })

      console.log(`🎤 [VoiceChat] Producer created: ${producer.id} for user ${socket.userId}`)

      // Store producer
      room.producers.set(producer.id, producer)
      peer.producers.set(producer.id, producer)

      producer.on("transportclose", () => {
        console.log(`🎤 [VoiceChat] Producer transport closed: ${producer.id}`)
        producer.close()
        room.producers.delete(producer.id)
        peer.producers.delete(producer.id)
      })

      // Notify all peers in the room about the new producer
      socket.to(`voice-${room.id}`).emit("new-producer", {
        producerId: producer.id,
        userId: socket.userId,
      })

      callback({ id: producer.id })
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error producing:`, error)
      callback({ error: error.message })
    }
  })

  // Consume audio from a producer
  socket.on("consume", async ({ transportId, producerId, rtpCapabilities }, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      const room = rooms[socket.voiceRoomId]
      const peer = room.peers.get(socket.id)
      const transportData = peer.transports.get(transportId)
      const producer = room.producers.get(producerId)

      if (!transportData || transportData.type !== "consumer") {
        throw new Error(`Consumer transport not found: ${transportId}`)
      }

      if (!producer) {
        throw new Error(`Producer not found: ${producerId}`)
      }

      // Check if router can consume the producer
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error(`Router cannot consume producer ${producerId}`)
      }

      console.log(`🎤 [VoiceChat] User ${socket.userId} consuming producer ${producerId}`)

      const consumer = await transportData.transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start in paused state
        appData: { userId: socket.userId, producerId },
      })

      // Store consumer
      room.consumers.set(consumer.id, consumer)
      peer.consumers.set(consumer.id, consumer)

      consumer.on("transportclose", () => {
        console.log(`🎤 [VoiceChat] Consumer transport closed: ${consumer.id}`)
        consumer.close()
        room.consumers.delete(consumer.id)
        peer.consumers.delete(consumer.id)
      })

      consumer.on("producerclose", () => {
        console.log(`🎤 [VoiceChat] Producer closed for consumer: ${consumer.id}`)
        consumer.close()
        room.consumers.delete(consumer.id)
        peer.consumers.delete(consumer.id)
        socket.emit("producer-closed", { consumerId: consumer.id, producerId })
      })

      // Return consumer parameters
      const params = {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerUserId: producer.appData.userId,
      }

      console.log(`🎤 [VoiceChat] Consumer created: ${consumer.id} for user ${socket.userId}`)
      callback(params)
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error consuming:`, error)
      callback({ error: error.message })
    }
  })

  // Resume consumer
  socket.on("resume-consumer", async ({ consumerId }, callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      const room = rooms[socket.voiceRoomId]
      const peer = room.peers.get(socket.id)
      const consumer = peer.consumers.get(consumerId)

      if (!consumer) {
        throw new Error(`Consumer not found: ${consumerId}`)
      }

      console.log(`🎤 [VoiceChat] Resuming consumer ${consumerId} for user ${socket.userId}`)
      await consumer.resume()
      console.log(`🎤 [VoiceChat] Consumer resumed: ${consumerId}`)
      callback({ success: true })
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error resuming consumer:`, error)
      callback({ error: error.message })
    }
  })

  // Get existing producers when a user joins
  socket.on("get-producers", (callback) => {
    try {
      if (!socket.voiceRoomId) {
        throw new Error("Not connected to a voice room")
      }

      const room = rooms[socket.voiceRoomId]
      const producerList = []

      room.producers.forEach((producer, producerId) => {
        producerList.push({
          producerId,
          userId: producer.appData.userId,
        })
      })

      console.log(`🎤 [VoiceChat] Sending ${producerList.length} producers to user ${socket.userId}`)
      callback(producerList)
    } catch (error) {
      console.error(`🎤 [VoiceChat] Error getting producers:`, error)
      callback({ error: error.message })
    }
  })

  // Handle mute/unmute
  socket.on("toggle-audio", ({ muted }) => {
    if (!socket.voiceRoomId) return

    console.log(`🎤 [VoiceChat] User ${socket.userId} ${muted ? "muted" : "unmuted"} their microphone`)

    // Broadcast to all users in the room that this user has muted/unmuted
    socket.to(`voice-${socket.voiceRoomId}`).emit("user-audio-toggle", {
      userId: socket.userId,
      muted,
    })
  })

  // Test audio transmission
  socket.on("test-audio", ({ success }) => {
    console.log(`🎤 [VoiceChat] Audio test ${success ? "succeeded" : "failed"} for user ${socket.userId}`)
    socket.emit("audio-test-result", { success })
  })

  // Handle disconnect
  socket.on("disconnect", () => {
    if (!socket.voiceRoomId) return

    console.log(`🎤 [VoiceChat] User ${socket.userId} disconnected from voice room ${socket.voiceRoomId}`)
    const room = rooms[socket.voiceRoomId]

    if (room && room.peers.has(socket.id)) {
      const peer = room.peers.get(socket.id)

      // Close all transports
      peer.transports.forEach((transportData) => {
        transportData.transport.close()
      })

      // Notify other users that this user has left
      socket.to(`voice-${socket.voiceRoomId}`).emit("voice-user-disconnected", { userId: socket.userId })

      // Remove peer from room
      room.peers.delete(socket.id)

      // If room is empty, delete it
      if (room.peers.size === 0) {
        console.log(`🎤 [VoiceChat] Room ${socket.voiceRoomId} is empty, deleting it`)
        delete rooms[socket.voiceRoomId]
      }
    }
  })
}

module.exports = {
  initializeMediasoup,
  setupVoiceChatHandlers,
}
