import { useRef, useMemo, Suspense, useState, useEffect, Component } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { BlendShapeWeights } from '../utils/lipSync'

/* ============================================================
   GLB Model Loader
   Place a humanoid .glb model at /public/models/doctor.glb
   Free model sources:
   - VRoid Studio: https://vroid.com/en/studio (free desktop app)
   - Sketchfab: search "doctor" → filter Free Download → GLB format
   - Ready Player Me: https://readyplayer.me (may need VPN in China)
   ============================================================ */

// React error boundary for GLTF loading failures
class GLBErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err: any) {
    console.warn('[DigitalHuman] GLB model not found, using procedural fallback:', err.message)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function GLBDoctorInner({ blendShapes }: { blendShapes: BlendShapeWeights }) {
  const groupRef = useRef<THREE.Group>(null)
  const morphMapRef = useRef<Map<string, Map<string, number>>>(new Map())

  const { scene } = useGLTF('/models/doctor.glb?v=3') as any

  const { modelScene, modelHeight, modelMin } = useMemo(() => {
    if (!scene) return { modelScene: null, modelHeight: 0, modelMin: 0 }

    const cloned = scene.clone(true)

    // Compute bounding box — include SkinnedMesh (common for characters)
    const box = new THREE.Box3()
    cloned.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.geometry.computeBoundingBox()
        const childBox = new THREE.Box3().copy(child.geometry.boundingBox!)
        childBox.applyMatrix4(child.matrixWorld)
        box.expandByObject(child)
      }
    })

    const height = box.max.y - box.min.y
    const minY = box.min.y

    // Find morph targets for lip sync
    cloned.traverse((child: any) => {
      if ((child.isSkinnedMesh || child.isMesh) && child.morphTargetDictionary) {
        const dict = child.morphTargetDictionary
        const map = new Map<string, number>()
        const jawKeys = ['jawOpen', 'mouthOpen', 'viseme_aa', 'viseme_Oh', 'mouthAh']
        for (const k of jawKeys) {
          if (dict[k] !== undefined) map.set('jawOpen', dict[k])
        }
        if (dict['mouthSmile'] !== undefined) map.set('mouthSmile', dict['mouthSmile'])
        if (dict['mouthFunnel'] !== undefined) map.set('mouthFunnel', dict['mouthFunnel'])
        if (map.size > 0) morphMapRef.current.set(child.uuid, map)
      }
    })

    console.log(
      `[GLB] Model loaded: height=${height.toFixed(2)}, minY=${minY.toFixed(2)}, ` +
      `morphMeshes=${morphMapRef.current.size}`
    )

    return { modelScene: cloned, modelHeight: height, modelMin: minY }
  }, [scene])

  // Animation: blend shapes + breathing only
  useFrame(() => {
    if (!modelScene) return

    // Drive blend shapes (facial expressions + lip sync)
    modelScene.traverse((child: any) => {
      const map = morphMapRef.current.get(child.uuid)
      if (map && child.morphTargetInfluences) {
        const ji = map.get('jawOpen')
        const ms = map.get('mouthSmile')
        const mf = map.get('mouthFunnel')
        if (ji !== undefined) child.morphTargetInfluences[ji] = blendShapes.jawOpen * 0.8
        if (ms !== undefined) child.morphTargetInfluences[ms] = blendShapes.mouthSmile
        if (mf !== undefined) child.morphTargetInfluences[mf] = blendShapes.mouthFunnel
      }
    })

    // Breathing — additive on top of the initial posY
    if (!groupRef.current) return
    groupRef.current.position.y = posY + Math.sin(Date.now() * 0.001 * 0.55) * 0.04
  })

  if (!modelScene) return null

  // Scale and position. Skinned-mesh bbox is unreliable so we use a
  // small target height and deep Y offset. Camera at [0, 1.0, 3.8].
  const targetHeight = 1.5
  const scale = modelHeight > 0 ? targetHeight / modelHeight : 0.8
  const posY = -0.5

  return (
    <group ref={groupRef} position={[0, posY, 0]} scale={scale}>
      <primitive object={modelScene} />
    </group>
  )
}

function GLBDoctor({ blendShapes }: { blendShapes: BlendShapeWeights }) {
  return (
    <GLBErrorBoundary fallback={<ProceduralDoctor blendShapes={blendShapes} />}>
      <Suspense fallback={<ProceduralDoctor blendShapes={blendShapes} />}>
        <GLBDoctorInner blendShapes={blendShapes} />
      </Suspense>
    </GLBErrorBoundary>
  )
}

/* ============================================================
   Improved Procedural Doctor (Fallback)
   ============================================================ */
function ProceduralDoctor({ blendShapes }: { blendShapes: BlendShapeWeights }) {
  const bodyRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const jawRef = useRef<THREE.Mesh>(null)
  const baseYRef = useRef(-0.5)

  useFrame((_s, _delta) => {
    if (!bodyRef.current) return
    // Breathing — additive on top of base position
    bodyRef.current.position.y = baseYRef.current + Math.sin(Date.now() * 0.001 * 0.55) * 0.04
  })

  const skin = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f5d5c3', roughness: 0.55, metalness: 0.01,
  }), [])
  const skinDark = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#e8bfa8', roughness: 0.5, metalness: 0.02,
  }), [])
  const lips = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d49080', roughness: 0.35, metalness: 0.01,
  }), [])
  const hair = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1c1814', roughness: 0.55, metalness: 0.12,
  }), [])
  const eyeW = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fefefe', roughness: 0.06, metalness: 0.01,
  }), [])
  const iris = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#332218', roughness: 0.05, metalness: 0.08,
  }), [])
  const pupil = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#030303', roughness: 0.01, metalness: 0,
  }), [])
  const coat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f6f7f9', roughness: 0.45, metalness: 0.06,
  }), [])
  const pants = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a2e38', roughness: 0.55, metalness: 0.04,
  }), [])
  const shoesMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a1a', roughness: 0.35, metalness: 0.1,
  }), [])

  return (
    <group ref={bodyRef} position={[0, -0.5, 0]} scale={0.6}>
      {/* ===== HEAD ===== */}
      <group ref={headRef}>
        {/* Main skull */}
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.2, 64, 64, 0, Math.PI * 2, 0, 1.3]} />
          <primitive object={skin} />
        </mesh>
        {/* Chin/jaw area */}
        <mesh position={[0, 1.44, 0.06]}>
          <sphereGeometry args={[0.14, 48, 48, 0, Math.PI * 2, 0.7, 0.6]} />
          <primitive object={skin} />
        </mesh>
        {/* Nose bridge */}
        <mesh position={[0, 1.6, 0.2]} rotation={[0.1, 0, 0]}>
          <capsuleGeometry args={[0.015, 0.05, 8, 16]} />
          <primitive object={skinDark} />
        </mesh>
        {/* Nose tip */}
        <mesh position={[0, 1.57, 0.21]}>
          <sphereGeometry args={[0.018, 16, 16]} />
          <primitive object={skinDark} />
        </mesh>
        {/* Cheeks */}
        {[-0.14, 0.14].map((x, i) => (
          <mesh key={`chk-${i}`} position={[x, 1.55, 0.09]}>
            <sphereGeometry args={[0.06, 24, 24]} />
            <primitive object={skin} />
          </mesh>
        ))}
        {/* Eyes */}
        {[-0.06, 0.06].map((x, i) => (
          <group key={`eye-${i}`}>
            <mesh position={[x, 1.68, 0.18]}>
              <sphereGeometry args={[0.038, 32, 32]} />
              <primitive object={eyeW} />
            </mesh>
            <mesh position={[x, 1.678, 0.212]}>
              <sphereGeometry args={[0.022, 24, 24]} />
              <primitive object={iris} />
            </mesh>
            <mesh position={[x, 1.676, 0.224]}>
              <sphereGeometry args={[0.011, 12, 12]} />
              <primitive object={pupil} />
            </mesh>
            {/* Eyelid detail */}
            <mesh position={[x, 1.71, 0.17]}>
              <boxGeometry args={[0.04, 0.006, 0.015]} />
              <primitive object={skinDark} />
            </mesh>
          </group>
        ))}
        {/* Eyebrows */}
        {[-0.06, 0.06].map((x, i) => (
          <mesh key={`brow-${i}`} position={[x, 1.722, 0.17]} rotation={[0.1, 0, i === 0 ? 0.05 : -0.05]}>
            <boxGeometry args={[0.055, 0.007, 0.01]} />
            <meshStandardMaterial color="#1a0e06" roughness={0.7} />
          </mesh>
        ))}
        {/* Upper lip */}
        <mesh position={[0, 1.515, 0.2]}>
          <capsuleGeometry args={[0.035, 0.018, 16, 16]} />
          <primitive object={lips} />
        </mesh>
        {/* Lower lip — jaw-driven */}
        <mesh ref={jawRef} position={[0, 1.5, 0.195]}>
          <capsuleGeometry args={[0.028, 0.014, 16, 16]} />
          <primitive object={lips} />
        </mesh>
        {/* Ears */}
        {[-0.19, 0.19].map((x, i) => (
          <mesh key={`ear-${i}`} position={[x, 1.6, 0]} rotation={[0, i === 0 ? 0.3 : -0.3, i === 0 ? 0.05 : -0.05]}>
            <capsuleGeometry args={[0.018, 0.07, 8, 12]} />
            <primitive object={skin} />
          </mesh>
        ))}
      </group>

      {/* ===== HAIR ===== */}
      <group>
        {/* Main hair volume */}
        <mesh position={[0, 1.78, -0.03]} castShadow>
          <sphereGeometry args={[0.22, 48, 48, 0, Math.PI * 2, 0, 1.0]} />
          <primitive object={hair} />
        </mesh>
        {/* Hair bun / back */}
        <mesh position={[0, 1.82, -0.16]}>
          <sphereGeometry args={[0.09, 32, 32]} />
          <primitive object={hair} />
        </mesh>
        {/* Side hair strands */}
        {[-0.17, 0.17].map((x, i) => (
          <mesh
            key={`hstr-${i}`}
            position={[x, 1.64, -0.06]}
            rotation={[0.15, 0, i === 0 ? -0.12 : 0.12]}
          >
            <capsuleGeometry args={[0.035, 0.18, 8, 12]} />
            <primitive object={hair} />
          </mesh>
        ))}
        {/* Front bangs */}
        <mesh position={[0, 1.81, 0.13]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.28, 0.02, 0.09]} />
          <primitive object={hair} />
        </mesh>
      </group>

      {/* ===== NECK ===== */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.042, 0.055, 0.09, 16]} />
        <primitive object={skin} />
      </mesh>

      {/* ===== COAT / UPPER BODY ===== */}
      <group>
        {/* Torso */}
        <mesh position={[0, 0.92, 0.04]} castShadow>
          <capsuleGeometry args={[0.18, 0.65, 16, 32]} />
          <primitive object={coat} />
        </mesh>
        {/* Chest area */}
        <mesh position={[0, 1.14, 0.16]}>
          <sphereGeometry args={[0.16, 32, 32, 0, Math.PI * 2, 0, 0.65]} />
          <primitive object={coat} />
        </mesh>
        {/* Shoulders */}
        {[-0.21, 0.21].map((x, i) => (
          <mesh key={`shld-${i}`} position={[x, 1.25, 0]} rotation={[0, 0, i === 0 ? -0.35 : 0.35]}>
            <capsuleGeometry args={[0.07, 0.2, 8, 12]} />
            <primitive object={coat} />
          </mesh>
        ))}
        {/* Collar */}
        {[-0.05, 0.05].map((x, i) => (
          <mesh
            key={`col-${i}`}
            position={[x, 1.35, 0.15]}
            rotation={[0.1, i === 0 ? 0.2 : -0.2, i === 0 ? 0.2 : -0.2]}
          >
            <boxGeometry args={[0.07, 0.1, 0.018]} />
            <primitive object={coat} />
          </mesh>
        ))}
        {/* Name badge */}
        <mesh position={[0.09, 1.17, 0.22]}>
          <boxGeometry args={[0.06, 0.022, 0.004]} />
          <meshStandardMaterial color="#e8784a" roughness={0.12} metalness={0.35} />
        </mesh>
        {/* Buttons */}
        {[1.18, 1.08, 0.98].map((y, i) => (
          <mesh key={`btn-${i}`} position={[0, y, 0.22]}>
            <cylinderGeometry args={[0.008, 0.008, 0.002, 8]} />
            <meshStandardMaterial color="#c0c0c8" roughness={0.15} metalness={0.6} />
          </mesh>
        ))}
        {/* Pocket */}
        <mesh position={[-0.11, 1.08, 0.2]} rotation={[0, -0.04, 0]}>
          <planeGeometry args={[0.06, 0.04]} />
          <meshStandardMaterial color="#e8eaef" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ===== ARMS ===== */}
      {[
        { x: -0.24, armRot: 0.2, handY: 0.72 },
        { x: 0.24, armRot: -0.2, handY: 0.72 },
      ].map((arm, i) => (
        <group key={`arm-${i}`}>
          <mesh position={[arm.x, 1.04, 0]} rotation={[0.06, 0, arm.armRot]}>
            <capsuleGeometry args={[0.04, 0.54, 8, 16]} />
            <primitive object={coat} />
          </mesh>
          {/* Hand */}
          <mesh position={[arm.x + (i === 0 ? -0.02 : 0.02), arm.handY, 0.05]}>
            <sphereGeometry args={[0.032, 16, 16]} />
            <primitive object={skin} />
          </mesh>
        </group>
      ))}

      {/* ===== STETHOSCOPE ===== */}
      <group>
        <mesh position={[-0.06, 1.24, 0.18]} rotation={[0, 0, 0.4]}>
          <torusGeometry args={[0.06, 0.007, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#404040" roughness={0.2} metalness={0.55} />
        </mesh>
        <mesh position={[-0.12, 1.15, 0.2]}>
          <cylinderGeometry args={[0.02, 0.016, 0.024, 16]} />
          <meshStandardMaterial color="#484848" roughness={0.15} metalness={0.75} />
        </mesh>
        {/* Tube */}
        <mesh position={[-0.08, 1.05, 0.17]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.005, 0.4, 4, 12]} />
          <meshStandardMaterial color="#333" roughness={0.3} metalness={0.4} />
        </mesh>
      </group>

      {/* ===== BELT ===== */}
      <mesh position={[0, 0.58, 0.1]}>
        <torusGeometry args={[0.17, 0.016, 8, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.35} metalness={0.35} />
      </mesh>

      {/* ===== LEGS ===== */}
      {[-0.07, 0.07].map((x, i) => (
        <mesh
          key={`leg-${i}`}
          position={[x, 0.35, 0.04]}
          rotation={[0, 0, i === 0 ? -0.03 : 0.03]}
        >
          <capsuleGeometry args={[0.07, 0.46, 8, 16]} />
          <primitive object={pants} />
        </mesh>
      ))}

      {/* ===== SHOES ===== */}
      {[-0.07, 0.07].map((x, i) => (
        <group key={`shoe-${i}`}>
          <mesh position={[x, 0.08, 0.06]}>
            <boxGeometry args={[0.06, 0.05, 0.12]} />
            <primitive object={shoesMat} />
          </mesh>
          <mesh position={[x, 0.11, 0.14]}>
            <boxGeometry args={[0.05, 0.03, 0.03]} />
            <meshStandardMaterial color="#111" roughness={0.25} metalness={0.05} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ============================================================
   Main DigitalHuman Component
   ============================================================ */
interface DigitalHumanProps {
  blendShapes: BlendShapeWeights
  compact?: boolean
}

export default function DigitalHuman({ blendShapes, compact = false }: DigitalHumanProps) {
  const bgColor = '#f5f2ef'

  return (
    <div className="digital-human-container" style={compact ? { width: '100%', height: '100%' } : undefined}>
      <Canvas
        camera={{ position: [0, 0.3, 3.8], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        shadows="soft"
      >
        <color attach="background" args={[bgColor]} />
        <directionalLight
          position={[3, 3.5, 2.5]} intensity={5.5} castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-near={0.3} shadow-camera-far={15}
          shadow-camera-left={-4} shadow-camera-right={4}
          shadow-camera-top={4} shadow-camera-bottom={-4}
          shadow-bias={-0.0003}
        />
        <directionalLight position={[-2.5, 2.5, -1]} intensity={2.0} color="#fff5e8" />
        <directionalLight position={[0, 2, -3]} intensity={2.5} color="#ffffff" />
        <pointLight position={[0.5, 0.8, 1.5]} intensity={1.8} color="#fff3e8" />
        <ambientLight intensity={1.0} />

        {/* Try GLB model first, fallback to procedural */}
        <GLBDoctor blendShapes={blendShapes} />

        <ContactShadows position={[0, -0.9, 0]} opacity={0.35} scale={5} blur={3} far={3} />
      </Canvas>
      {!compact && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(139,111,90,0.45)', fontSize: 11,
          fontFamily: '"Noto Sans SC", sans-serif', letterSpacing: 2,
          pointerEvents: 'none', userSelect: 'none',
        }}>
          小云医生 | Dr. Xiaoyun
        </div>
      )}
    </div>
  )
}
