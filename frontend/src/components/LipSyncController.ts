import { useEffect, useRef, useState } from 'react'
import { analyzeAudioFromAnalyser, type BlendShapeWeights } from '../utils/lipSync'

const IDLE_BLEND_SHAPES: BlendShapeWeights = {
  jawOpen: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
  mouthSmile: 0.08,
  mouthStretch: 0,
  mouthLeft: 0,
  mouthRight: 0,
}

interface UseLipSyncReturn {
  blendShapes: BlendShapeWeights
  setAnalyser: (analyser: AnalyserNode | null) => void
}

/**
 * Hook that continuously reads from an AnalyserNode and outputs
 * blend shape weights for lip-sync animation.
 *
 * When no analyser is set (silence), it outputs idle blend shapes.
 */
export function useLipSync(): UseLipSyncReturn {
  const analyserRef = useRef<AnalyserNode | null>(null)
  const [blendShapes, setBlendShapes] = useState<BlendShapeWeights>(IDLE_BLEND_SHAPES)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function tick() {
      const analyser = analyserRef.current
      if (analyser) {
        const shapes = analyzeAudioFromAnalyser(analyser)
        setBlendShapes(shapes)
      } else {
        setBlendShapes(IDLE_BLEND_SHAPES)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const setAnalyser = (analyser: AnalyserNode | null) => {
    analyserRef.current = analyser
  }

  return { blendShapes, setAnalyser }
}
