const os = require("os")

// Function to get the local IPv4 address dynamically
const getLocalIP = () => {
  const interfaces = os.networkInterfaces()
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address // Return the first non-internal IPv4 address
      }
    }
  }
  return "localhost" // Fallback if no external IP is found
}

// Export the detected IP
const localIP = getLocalIP()
console.log(`Detected Local IP: ${localIP}`)

module.exports = { localIP }
