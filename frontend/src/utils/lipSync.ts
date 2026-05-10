export interface BlendShapeWeights {
  jawOpen: number
  mouthFunnel: number
  mouthPucker: number
  mouthSmile: number
  mouthStretch: number
  mouthLeft: number
  mouthRight: number
}

const GAIN = 2.5 // Amplification factor
const SMOOTHING = 0.35 // Temporal smoothing

let smoothedJaw = 0
let smoothedFunnel = 0

/**
 * Analyze audio time-domain data and produce blend shape weights.
 * Uses RMS energy for jaw opening and high-frequency components
 * for mouth shape details.
 */
export function analyzeAudioFromAnalyser(analyser: AnalyserNode): BlendShapeWeights {
  const bufferLength = analyser.frequencyBinCount
  const timeData = new Uint8Array(bufferLength)
  const freqData = new Uint8Array(bufferLength)

  analyser.getByteTimeDomainData(timeData)
  analyser.getByteFrequencyData(freqData)

  // Calculate RMS from time-domain data
  let sumSquares = 0
  for (let i = 0; i < timeData.length; i++) {
    const normalized = (timeData[i] - 128) / 128
    sumSquares += normalized * normalized
  }
  const rms = Math.sqrt(sumSquares / timeData.length)

  // Calculate high-freq energy (for mouth shaping)
  let highFreqEnergy = 0
  const highStart = Math.floor(bufferLength * 0.4)
  for (let i = highStart; i < bufferLength; i++) {
    highFreqEnergy += freqData[i] / 255
  }
  const highFreqNorm = highFreqEnergy / (bufferLength - highStart)

  // Scale and clamp
  let jawOpen = Math.min(rms * GAIN, 1.0)
  let mouthFunnel = Math.min(highFreqNorm * 0.8, 1.0)

  // Temporal smoothing
  smoothedJaw = smoothedJaw * (1 - SMOOTHING) + jawOpen * SMOOTHING
  smoothedFunnel = smoothedFunnel * (1 - SMOOTHING) + mouthFunnel * SMOOTHING

  // Add subtle random jitter for naturalness
  const jitter = (Math.random() - 0.5) * 0.03
  const jaw = clamp(smoothedJaw + jitter, 0, 1)

  return {
    jawOpen: jaw,
    mouthFunnel: smoothedFunnel * 0.4,
    mouthPucker: smoothedFunnel * 0.2,
    mouthSmile: 0.15 + jaw * 0.15,
    mouthStretch: jaw * 0.2,
    mouthLeft: jitter * 5,
    mouthRight: -jitter * 5,
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
