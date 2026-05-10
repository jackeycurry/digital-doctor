import { useRef, useState, useCallback } from 'react'

interface UseAudioCaptureReturn {
  startRecording: () => Promise<void>
  stopRecording: () => void
  isRecording: boolean
  onChunk: (handler: (base64: string) => void) => () => void
}

function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null)
  const handlersRef = useRef<((base64: string) => void)[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const onChunk = useCallback((handler: (base64: string) => void) => {
    handlersRef.current.push(handler)
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler)
    }
  }, [])

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch { /* ignore */ }
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setIsRecording(false)
  }, [])

  const startWithScriptProcessor = useCallback((stream: MediaStream, audioCtx: AudioContext) => {
    // Fallback using deprecated ScriptProcessorNode (widely supported)
    const source = audioCtx.createMediaStreamSource(stream)
    const bufferSize = 4096
    const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      const base64 = pcmToBase64(pcm)
      handlersRef.current.forEach((h) => h(base64))
    }

    source.connect(processor)
    processor.connect(audioCtx.destination)
    setIsRecording(true)
    console.log('[Audio] Using ScriptProcessor fallback')
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx

      // Resume if suspended (autoplay policy)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }

      // Try AudioWorklet first, fall back to ScriptProcessor
      try {
        await audioCtx.audioWorklet.addModule('/audio-processor.js')
        const source = audioCtx.createMediaStreamSource(stream)
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor')
        processorRef.current = workletNode

        workletNode.port.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'audio_data' && event.data.data) {
            const base64 = pcmToBase64(event.data.data as Int16Array)
            handlersRef.current.forEach((h) => h(base64))
          }
        }

        source.connect(workletNode)
        setIsRecording(true)
        console.log('[Audio] Using AudioWorklet')
      } catch (workletErr) {
        console.warn('[Audio] AudioWorklet failed, falling back to ScriptProcessor:', workletErr)
        startWithScriptProcessor(stream, audioCtx)
      }
    } catch (err) {
      console.error('[Audio] Failed to start recording:', err)
      cleanup()
      throw err
    }
  }, [cleanup, startWithScriptProcessor])

  const stopRecording = useCallback(() => {
    cleanup()
  }, [cleanup])

  return { startRecording, stopRecording, isRecording, onChunk }
}
