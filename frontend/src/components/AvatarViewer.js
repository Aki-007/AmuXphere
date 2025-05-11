"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

function AvatarViewer({ avatarUrl }) {
  const mountRef = useRef(null)

  useEffect(() => {
    if (!avatarUrl || !mountRef.current) {
      console.error("Avatar URL is null or viewerRef is not available")
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer()

    renderer.setSize(window.innerWidth, window.innerHeight)
    mountRef.current.appendChild(renderer.domElement)

    const loader = new GLTFLoader()
    loader.load(
      avatarUrl, // URL of the 3D avatar model
      (gltf) => {
        scene.add(gltf.scene)
      },
      undefined,
      (error) => {
        console.error("Error loading avatar:", error)
      },
    )

    const light = new THREE.PointLight(0xffffff, 1)
    light.position.set(10, 10, 10)
    scene.add(light)

    camera.position.z = 5

    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      mountRef.current.removeChild(renderer.domElement)
    }
  }, [avatarUrl])

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
}

export default AvatarViewer
