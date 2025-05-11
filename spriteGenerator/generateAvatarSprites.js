// generateAvatarSprites.js
const puppeteer = require("puppeteer")
const fs = require("fs")
const path = require("path")

async function generateAvatarSprites(userId, avatarUrl) {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"], // if needed for your environment
    })
    const page = await browser.newPage()

    // Set the viewport to match your renderer's size (adjust as needed)
    await page.setViewport({ width: 1080, height: 1080 })

    // // Navigate to your sprite generation page (this page hosts your Three.js scene)
    // await page.goto(`http://localhost:3000/spriteGenerator.html?avatarUrl=${encodeURIComponent(avatarUrl)}`, {
    //   waitUntil: 'networkidle0',
    // });

    // For testing locally
    const spriteGeneratorPath = `file://${path.join(__dirname, "spriteGenerator.html")}`
    await page.goto(`${spriteGeneratorPath}?avatarUrl=${encodeURIComponent(avatarUrl)}`, {
      waitUntil: "networkidle0",
    })

    // Define the required views along with camera settings
    const views = [
      { name: "front", cameraSettings: { position: { x: 0, y: 1.5, z: 5 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      { name: "back", cameraSettings: { position: { x: 0, y: 1.5, z: -5 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      { name: "left", cameraSettings: { position: { x: -5, y: 1.5, z: 0 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      { name: "right", cameraSettings: { position: { x: 5, y: 1.5, z: 0 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      // Isometric views (using a three-quarter view angle)
      { name: "iso_front_left", cameraSettings: { position: { x: -3, y: 3, z: 3 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      { name: "iso_front_right", cameraSettings: { position: { x: 3, y: 3, z: 3 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      { name: "iso_back_left", cameraSettings: { position: { x: -3, y: 3, z: -3 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
      { name: "iso_back_right", cameraSettings: { position: { x: 3, y: 3, z: -3 }, lookAt: { x: 0, y: 1.5, z: 0 } } },
    ]

    const spriteImages = {}

    // Ensure a folder exists to store the sprites (adjust path as needed)
    const spritesDir = path.join(__dirname, "..", "avatar_sprites", `${userId}`)
    if (!fs.existsSync(spritesDir)) {
      fs.mkdirSync(spritesDir)
    }

    for (const view of views) {
      // Instruct the page to update the camera settings
      await page.evaluate((settings) => {
        // Assumes a global function "updateCamera" exists in spriteGenerator.html
        window.updateCamera(settings)
      }, view.cameraSettings)

      // Allow time for the scene to update/render
      // await page.waitForTimeout(500);

      await new Promise((resolve) => setTimeout(resolve, 500))

      // Capture a screenshot of the canvas element with id 'threeCanvas'
      const canvasElement = await page.$("#threeCanvas")
      const screenshotBuffer = await canvasElement.screenshot({
        omitBackground: true,
        type: "png",
      })

      // Save the image to disk (or you can upload to cloud storage)
      const filePath = path.join(spritesDir, `${userId}_${view.name}.png`)
      fs.writeFileSync(filePath, screenshotBuffer)

      // For example, store the file path or URL; here, we store the local path
      spriteImages[view.name] = filePath
    }

    await browser.close()
    return spriteImages
  } catch (error) {
    console.error(`Error generating sprites: ${error.message}`)
  }
}

module.exports = generateAvatarSprites
// generateAvatarSprites(process.argv[2], process.argv[3]);    // For testing
