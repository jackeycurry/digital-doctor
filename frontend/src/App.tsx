import { useState, useCallback, useEffect, useRef } from 'react'
import DigitalHuman from './components/DigitalHuman'
import FloatingCallButtons from './components/FloatingCallButtons'
import StatusIndicator from './components/StatusIndicator'
import ChatInterface from './components/ChatInterface'
import VideoCall from './components/VideoCall'
import VideoCallPage from './pages/VideoCallPage'
import LogPanel, { useLogger } from './components/LogPanel'
import { useWebSocket } from './hooks/useWebSocket'
import { useAudioCapture } from './hooks/useAudioCapture'
import { useStreamingAudio } from './hooks/useStreamingAudio'
import { useStt } from './hooks/useStt'
import { useLipSync } from './components/LipSyncController'
import type { ServerMessage, ChatMessage } from './types'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'


export default function App() {
  const [route, setRoute] = useState<'login' | 'register' | 'main'>(() => {
    const saved = sessionStorage.getItem('dd_auth')
    if (saved) return 'main'
    const params = new URLSearchParams(window.location.search)
    if (params.has('registered')) return 'login'
    return 'login'
  })

  const { sendMessage, onMessage, state, connected } = useWebSocket()
  const { startRecording, stopRecording, isRecording, onChunk } = useAudioCapture()
  const { enqueueChunk, finishStream, stopPlayback, getAnalyserNode } = useStreamingAudio()
  const { blendShapes, setAnalyser } = useLipSync()
  const { logs, addLog, clearLogs } = useLogger()
  const stt = useStt((text: string) => {
    addLog('info', `语音识别: "${text}"`)
    sendTextRef.current(text)
  })

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [partialText, setPartialText] = useState('')
  const [inCall, setInCall] = useState(false)
  const [callRecording, setCallRecording] = useState(true) // mic on/off state
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [showVideoCallPage, setShowVideoCallPage] = useState(false)
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const perMsgAudioRef = useRef<HTMLAudioElement | null>(null) // Per-message speak button audio
  const perMsgAudioIdxRef = useRef<number | null>(null) // Which message idx perMsgAudio belongs to
  const pendingSpeakIdxRef = useRef<number | null>(null) // Track which message idx is pending TTS fetch
  const llmTextAccumRef = useRef('')
  const sendTextRef = useRef<(text: string) => void>(() => {})

  // Auto TTS — defined early so other callbacks can reference them
  const handleStopSpeakingRef = useRef<() => void>(() => {})
  const handleAssistantMessageRef = useRef<(text: string) => void>(() => {})
  const responseStartTimeRef = useRef(0)
  const lastAudioTimeRef = useRef(0) // Track last response_audio_delta arrival time
  const responseDoneRef = useRef(false) // Guard: prevent processing response_done multiple times

  // Auto-commit accumulated text if no audio arrives for 5 seconds
  // This handles the case where response_done gets lost due to WebSocket disconnect
  useEffect(() => {
    const interval = setInterval(() => {
      const lastAudio = lastAudioTimeRef.current
      if (lastAudio > 0 && llmTextAccumRef.current && Date.now() - lastAudio > 5000) {
        // No audio for 5 seconds — AI has finished, commit the text
        const text = llmTextAccumRef.current
        if (text) {
          setMessages((prev) => [...prev, { role: 'assistant', text }])
          addLog('recv', `AI回复完成 (${text.length}字) [超时提交]`)
          llmTextAccumRef.current = ''
          setPartialText('')
          lastAudioTimeRef.current = 0
          finishStream()
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [addLog, finishStream])

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('dd_messages')
      if (saved) {
        const msgs = JSON.parse(saved)
        setMessages(msgs)
      }
      const savedPartial = sessionStorage.getItem('dd_partial')
      if (savedPartial) setPartialText(savedPartial)
    } catch (e) {
      console.error('[App] Failed to restore state:', e)
    }
  }, [])

  // Wire up lip-sync analyser
  useEffect(() => {
    const id = setInterval(() => {
      const node = getAnalyserNode()
      if (node) setAnalyser(node)
    }, 500)
    return () => clearInterval(id)
  }, [getAnalyserNode, setAnalyser])

  // Log connection changes
  const prevConnectedRef = useRef(connected)
  useEffect(() => {
    if (prevConnectedRef.current !== connected) {
      addLog(connected ? 'info' : 'warn', connected ? 'WebSocket 已连接' : 'WebSocket 断开')
      prevConnectedRef.current = connected
    }
  }, [connected, addLog])

  // Listen for server messages
  useEffect(() => {
    const unsub = onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'status':
          addLog('recv', `状态变更 → ${msg.state}`)
          if (msg.state === 'listening') {
            stopPlayback()
            const elapsed = Date.now() - responseStartTimeRef.current
            // 800ms cooldown: ignore VAD triggers right after response starts (echo guard)
            if (llmTextAccumRef.current && elapsed > 800) {
              const interrupted = llmTextAccumRef.current + ' [已打断]'
              setMessages((prev) => [...prev, { role: 'assistant', text: interrupted }])
              llmTextAccumRef.current = ''
              setPartialText('')
            }
          }
          break

        case 'user_transcript':
          addLog('recv', `用户语音: "${msg.text}"`)
          setMessages((prev) => [...prev, { role: 'user', text: msg.text }])
          break

        case 'response_text_delta':
          if (!llmTextAccumRef.current) {
            // New response starting — reset guards
            responseStartTimeRef.current = Date.now()
            responseDoneRef.current = false
            addLog('recv', `AI开始回复...`)
          }
          llmTextAccumRef.current += msg.text
          setPartialText(llmTextAccumRef.current)
          break

        case 'response_done':
          console.log('[App] response_done received, llmTextAccum length:', llmTextAccumRef.current.length, 'alreadyDone:', responseDoneRef.current)
          if (responseDoneRef.current) {
            console.log('[App] response_done already processed, skipping duplicate')
            break
          }
          responseDoneRef.current = true
          lastAudioTimeRef.current = 0 // Cancel auto-commit timer
          const finalText = llmTextAccumRef.current
          if (finalText) {
            console.log('[App] Adding final message to chat, text length:', finalText.length)
            setMessages((prev) => {
              console.log('[App] setMessages called, prev count:', prev.length, 'adding text length:', finalText.length)
              return [...prev, { role: 'assistant', text: finalText }]
            })
            addLog('recv', `AI回复完成 (${finalText.length}字)`)
          } else {
            console.log('[App] response_done but llmTextAccumRef is EMPTY — text already committed or lost!')
          }
          llmTextAccumRef.current = ''
          setPartialText('')
          finishStream()
          break

        case 'response_audio_delta':
          lastAudioTimeRef.current = Date.now() // Record audio arrival for auto-commit timer
          enqueueChunk(msg.data)
          break

        case 'error':
          addLog('error', `错误: ${msg.message}`)
          break

        default:
          break
      }
    })
    return unsub
  }, [onMessage, enqueueChunk, finishStream, stopPlayback, addLog])

  // Send audio chunks to backend while in call
  useEffect(() => {
    const unsub = onChunk((base64) => {
      if (inCall) {
        sendMessage({ type: 'audio_chunk', data: base64 })
      }
    })
    return unsub
  }, [onChunk, sendMessage, inCall])

  // ============================================================
  // Text chat
  // ============================================================
  const sendTextMessage = useCallback(async (text: string) => {
    addLog('send', `发送文字: "${text.slice(0, 40)}..."`)
    setMessages((prev) => [...prev, { role: 'user', text }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.text })),
            { role: 'user', content: text },
          ],
        }),
      })

      if (!response.ok) {
        addLog('error', `Chat API error: ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullText += parsed.text
                setPartialText(fullText)
              }
            } catch { /* skip */ }
          }
        }
      }

      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', text: fullText }])
        addLog('recv', `AI回复完成 (${fullText.length}字)`)
        setPartialText('')
      }
    } catch (err) {
      addLog('error', `文字发送失败: ${String(err)}`)
    }
  }, [messages, addLog])

  // Keep ref in sync for speech-to-text callback
  sendTextRef.current = sendTextMessage

  // ============================================================
  // Voice call
  // ============================================================
  // Unified Call (voice + video)
  // ============================================================
  const handleStartCall = useCallback(async (type: 'voice' | 'video') => {
    if (inCall || isRecording) return
    addLog('info', type === 'video' ? '开始视频通话...' : '开始语音通话...')
    responseDoneRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      setVideoStream(stream)
      setInCall(true)
      setCallRecording(true)
      if (type === 'video') setShowVideoCallPage(true)
      await startRecording()
      sendMessage({ type: type === 'video' ? 'start_video_call' : 'start_conversation' })
      addLog('info', type === 'video' ? '摄像头+麦克风已启动' : '麦克风已启动')
    } catch (err) {
      addLog('error', `通话错误: ${String(err)}`)
      alert('无法访问摄像头或麦克风，请检查浏览器权限设置。')
    }
  }, [inCall, isRecording, startRecording, sendMessage, addLog])

  const handleStopCall = useCallback(() => {
    if (!inCall) return
    addLog('info', '挂断通话')
    setInCall(false)
    setCallRecording(true)
    setShowVideoCallPage(false)
    handleStopSpeakingRef.current()
    if (isRecording) stopRecording()
    stopPlayback()
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop())
      setVideoStream(null)
    }
    sendMessage({ type: 'stop_conversation' })
    addLog('send', '发送 stop_conversation')
    setTimeout(() => {
      if (llmTextAccumRef.current) {
        setMessages((prev) => [...prev, { role: 'assistant', text: llmTextAccumRef.current }])
        llmTextAccumRef.current = ''
        setPartialText('')
      }
    }, 2000)
  }, [inCall, isRecording, stopRecording, stopPlayback, videoStream, sendMessage, addLog])

  // Toggle microphone (mute/unmute)
  const handleToggleMic = useCallback(async () => {
    if (!videoStream) return
    const newEnabled = !callRecording
    videoStream.getAudioTracks().forEach((t) => { t.enabled = newEnabled })
    if (newEnabled) {
      // Unmute: resume audio recording
      await startRecording()
    } else {
      // Mute: stop audio recording
      stopRecording()
    }
    setCallRecording(newEnabled)
  }, [videoStream, callRecording, startRecording, stopRecording])

  // Send video frames
  const handleVideoFrame = useCallback((base64Jpeg: string) => {
    sendMessage({ type: 'video_frame', data: base64Jpeg })
  }, [sendMessage])

  // ============================================================
  // Auto TTS — when AI response arrives, auto-speak it
  // ============================================================
  const handleStopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (perMsgAudioRef.current) {
      perMsgAudioRef.current.pause()
      perMsgAudioRef.current = null
      perMsgAudioIdxRef.current = null
    }
    speechSynthesis.cancel()
    pendingSpeakIdxRef.current = null // Clear any pending TTS
    setSpeakingMsgIdx(null)
  }, [])

  // Called when user clicks the per-message speak button
  const handlePerMsgSpeak = useCallback((text: string, idx: number) => {
    // Check if THIS message's perMsgAudio is currently playing
    const thisMsgPlaying = perMsgAudioRef.current !== null && perMsgAudioIdxRef.current === idx

    // Guard: if TTS fetch is still pending for this message, treat as stop
    if (pendingSpeakIdxRef.current === idx) {
      handleStopSpeakingRef.current()
      return
    }

    if (thisMsgPlaying) {
      // Currently playing this message → stop it
      handleStopSpeakingRef.current()
      return
    }

    // Not playing this message → start playing
    // Stop any currently playing audio first
    handleStopSpeakingRef.current()

    // Mark as pending immediately to guard against double-click during TTS fetch
    pendingSpeakIdxRef.current = idx

    // Set speaking state
    setSpeakingMsgIdx(idx)

    // Play audio
    const play = async () => {
      try {
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        // Check if this request was cancelled by user clicking stop during fetch
        if (pendingSpeakIdxRef.current !== idx) {
          console.log('[App] TTS response arrived but user cancelled, discarding')
          return
        }
        if (resp.ok) {
          const blob = await resp.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          perMsgAudioRef.current = audio
          perMsgAudioIdxRef.current = idx
          // Clear pending flag now that audio is ready
          pendingSpeakIdxRef.current = null
          audio.onended = () => {
            URL.revokeObjectURL(url)
            if (perMsgAudioRef.current === audio) {
              perMsgAudioRef.current = null
              perMsgAudioIdxRef.current = null
              setSpeakingMsgIdx(null)
            }
          }
          audio.onerror = () => {
            URL.revokeObjectURL(url)
            if (perMsgAudioRef.current === audio) {
              perMsgAudioRef.current = null
              perMsgAudioIdxRef.current = null
              setSpeakingMsgIdx(null)
            }
          }
          await audio.play()
        } else {
          pendingSpeakIdxRef.current = null
          setSpeakingMsgIdx(null)
        }
      } catch {
        // Silently fail
        pendingSpeakIdxRef.current = null
        setSpeakingMsgIdx(null)
      }
    }
    play()
  }, [])

  // Called when a new assistant message is added to chat (no longer auto-play)
  const handleAssistantMessage = useCallback((text: string) => {
    // No-op: user clicks speak button to play
  }, [])

  // Keep refs in sync
  handleStopSpeakingRef.current = handleStopSpeaking
  handleAssistantMessageRef.current = handleAssistantMessage

  // ============================================================
  // Render
  // ============================================================
  if (route !== 'main') {
    if (route === 'login') {
      return (
        <LoginPage
          onLogin={(phone, token) => {
            sessionStorage.setItem('dd_auth', JSON.stringify({ phone, token }))
            setRoute('main')
          }}
          onGoRegister={() => setRoute('register')}
        />
      )
    }
    // route === 'register'
    return (
      <RegisterPage
        onSuccess={() => {
          window.location.search = '?registered=true'
          setRoute('login')
        }}
        onBack={() => setRoute('login')}
      />
    )
  }

  // route === 'main': render existing app UI
  return showVideoCallPage ? (
    <VideoCallPage
      videoStream={videoStream}
      messages={messages}
      partialText={partialText}
      onBack={() => {
        handleStopCall()
        setShowVideoCallPage(false)
      }}
      onFrame={handleVideoFrame}
      onToggleMic={handleToggleMic}
      onToggleCamera={() => {
        if (videoStream) {
          const next = !videoStream.getVideoTracks()[0]?.enabled
          videoStream.getVideoTracks().forEach((t) => { t.enabled = next })
        }
      }}
      isMicOn={callRecording}
      blendShapes={blendShapes}
      onServerMessage={(msg: ServerMessage) => {}}
      onSendText={sendTextMessage}
      onStopSpeaking={handleStopSpeaking}
      onPerMsgSpeak={handlePerMsgSpeak}
      speakingMsgIdx={speakingMsgIdx}
    />
  ) : (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">小云医生 · AI健康助手</h1>
        <StatusIndicator state={state} connected={connected} />
      </header>

      <main className="app-main">
        {/* Primary: Text Chat */}
        <div className="chat-panel">
          <ChatInterface
            messages={messages}
            partialText={partialText}
            onSendText={sendTextMessage}
            onVoiceInput={() => {
              if (stt.isRecording) {
                stt.stop()
              } else {
                handleStopSpeakingRef.current()
                stt.start()
              }
            }}
            isRecordingVoice={stt.isRecording}
            onStopSpeaking={handleStopSpeakingRef.current}
            onPerMsgSpeak={handlePerMsgSpeak}
            speakingMsgIdx={speakingMsgIdx}
          />
        </div>

        {/* Desktop: 3D Doctor side panel */}
        <div className="doctor-compact">
          <DigitalHuman blendShapes={blendShapes} compact />
        </div>

        {/* Call control bar (shown during voice/video call) */}
        {inCall && (
          <VideoCall
            stream={videoStream}
            onClose={handleStopCall}
            onFrame={handleVideoFrame}
            isRecording={callRecording}
            onToggleMic={handleToggleMic}
          />
        )}
      </main>

      {/* Floating call buttons */}
      <FloatingCallButtons
        state={state}
        connected={connected}
        inCall={inCall}
        onStartCall={() => handleStartCall('video')}
      />

{/* Log panel temporarily hidden */}
      {/* <LogPanel logs={logs} /> */}
    </div>
  )
}
