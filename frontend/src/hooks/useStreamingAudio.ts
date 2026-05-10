import { useRef, useCallback, useState } from 'react'

interface UseStreamingAudioReturn {
  enqueueChunk: (base64Pcm24: string) => void
  finishStream: () => Promise<void>
  stopPlayback: () => void
  isPlaying: boolean
  getAnalyserNode: () => AnalyserNode | null
}

export function useStreamingAudio(): UseStreamingAudioReturn {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const queueRef = useRef<AudioBuffer[]>([])
  const playingRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const onDoneRef = useRef<(() => void) | null>(null)
  const nextStartTimeRef = useRef(0)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 })
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      analyserRef.current.connect(audioCtxRef.current.destination)
    }
    return audioCtxRef.current
  }

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      playingRef.current = false
      setIsPlaying(false)
      currentSourceRef.current = null
      onDoneRef.current?.()
      onDoneRef.current = null
      nextStartTimeRef.current = 0
      return
    }

    const ctx = getAudioContext()
    const now = ctx.currentTime
    const startTime = Math.max(now, nextStartTimeRef.current)

    const buffer = queueRef.current.shift()!
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(analyserRef.current!)
    source.connect(ctx.destination)
    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current = null
      }
      playNext()
    }
    source.start(startTime)
    currentSourceRef.current = source
    nextStartTimeRef.current = startTime + buffer.duration
  }, [])

  const enqueueChunk = useCallback(async (base64Pcm24: string) => {
    const ctx = getAudioContext()

    try {
      const binaryStr = atob(base64Pcm24)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      const int16 = new Int16Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      )

      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
      audioBuffer.getChannelData(0).set(float32)

      queueRef.current.push(audioBuffer)

      if (!playingRef.current) {
        playingRef.current = true
        setIsPlaying(true)
        playNext()
      }
    } catch (err) {
      console.warn('[Audio] Failed to decode PCM24 chunk:', err)
    }
  }, [playNext])

  const finishStream = useCallback(async (): Promise<void> => {
    return new Promise((resolve) => {
      if (playingRef.current) {
        onDoneRef.current = resolve
      } else {
        resolve()
      }
    })
  }, [])

  const stopPlayback = useCallback(() => {
    // Clear pending audio queue
    queueRef.current = []
    // Stop current audio source immediately
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null
        currentSourceRef.current.stop()
      } catch { /* already stopped */ }
      currentSourceRef.current = null
    }
    playingRef.current = false
    setIsPlaying(false)
    nextStartTimeRef.current = 0
    // Resolve any pending finish promise
    if (onDoneRef.current) {
      const done = onDoneRef.current
      onDoneRef.current = null
      done()
    }
  }, [])

  const getAnalyserNode = useCallback((): AnalyserNode | null => {
    return analyserRef.current
  }, [])

  return { enqueueChunk, finishStream, stopPlayback, isPlaying, getAnalyserNode }
}
