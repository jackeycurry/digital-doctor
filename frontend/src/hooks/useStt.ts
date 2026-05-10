import { useRef, useState, useCallback } from 'react'

interface UseSttReturn {
  isRecording: boolean
  start: () => Promise<void>
  stop: () => void
}

function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function useStt(onText: (text: string) => void): UseSttReturn {
  const [isRecording, setIsRecording] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const chunksRef = useRef<Int16Array[]>([])
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const isRecordingRef = useRef(false)
  isRecordingRef.current = isRecording

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx
      if (audioCtx.state === 'suspended') await audioCtx.resume()

      const source = audioCtx.createMediaStreamSource(stream)
      const bufferSize = 4096
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      chunksRef.current = []
      isRecordingRef.current = true
      setIsRecording(true)
      console.log('[STT] ScriptProcessor recording started, silence threshold: 0.001')

      processor.onaudioprocess = (event) => {
        if (!isRecordingRef.current) return
        const input = event.inputBuffer.getChannelData(0)
        const pcm = new Int16Array(input.length)
        let sum = 0
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          sum += Math.abs(input[i])
        }
        // Only record if audio level > threshold (very permissive)
        if (sum / input.length > 0.001) {
          chunksRef.current.push(pcm)
        }
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)
      console.log('[STT] ScriptProcessor recording started')
    } catch (err) {
      console.error('[STT] Failed to start recording:', err)
      alert('无法访问麦克风，请检查浏览器权限设置。')
    }
  }, [])

  const stop = useCallback(async () => {
    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch { /* ignore */ }
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      await audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setIsRecording(false)

    // Concatenate all PCM chunks
    const totalSamples = chunksRef.current.reduce((sum, c) => sum + c.length, 0)
    const allPcm = new Int16Array(totalSamples)
    let offset = 0
    for (const chunk of chunksRef.current) {
      allPcm.set(chunk, offset)
      offset += chunk.length
    }
    chunksRef.current = []

    console.log('[STT] Recording stopped, total samples:', totalSamples, 'duration:', (totalSamples / 16000).toFixed(2), 'sec')

    if (totalSamples < 1600) { // less than 100ms of audio
      console.warn('[STT] Audio too short, ignoring')
      return
    }

    const base64 = pcmToBase64(allPcm)
    console.log('[STT] PCM base64 length:', base64.length)

    try {
      const resp = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      })
      const data = await resp.json()
      console.log('[STT] Response:', data.text ? `text="${data.text}"` : JSON.stringify(data))
      if (data.text && data.text.trim()) {
        onTextRef.current(data.text.trim())
      } else if (data.error) {
        console.error('[STT] Server error:', data.error)
        alert('语音识别失败: ' + data.error)
      } else if (data.text !== undefined && !data.text.trim()) {
        console.warn('[STT] Empty transcription')
        alert('没有检测到语音，请靠近麦克风并大声一些说话。')
      }
    } catch (err) {
      console.error('[STT] Request failed:', err)
    }
  }, [])

  return { isRecording, start, stop }
}
