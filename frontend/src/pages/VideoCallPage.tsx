import { useState, useEffect, useRef } from 'react'
import DigitalHuman from '../components/DigitalHuman'
import ChatInterface from '../components/ChatInterface'
import type { ServerMessage, ChatMessage } from '../types'

interface VideoCallPageProps {
  videoStream: MediaStream | null
  messages: ChatMessage[]
  partialText: string
  onBack: () => void
  onFrame: (base64Jpeg: string) => void
  onToggleMic: () => void
  onToggleCamera: () => void
  isMicOn: boolean
  blendShapes: Record<string, number>
  onServerMessage: (msg: ServerMessage) => void
  onSendText: (text: string) => void
  onStopSpeaking: () => void
  onPerMsgSpeak: (text: string, idx: number) => void
  speakingMsgIdx: number | null
}

export default function VideoCallPage({
  videoStream,
  messages,
  partialText,
  onBack,
  onFrame,
  onToggleMic,
  onToggleCamera,
  isMicOn,
  blendShapes,
  onServerMessage,
  onSendText,
  onStopSpeaking,
  onPerMsgSpeak,
  speakingMsgIdx,
}: VideoCallPageProps) {
  const [callDuration, setCallDuration] = useState(0)
  const [chatMode, setChatMode] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pipVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameIntervalRef = useRef<ReturnType<typeof setInterval>>()

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((d) => d + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Bind video stream to video elements
  useEffect(() => {
    if (!videoStream) return

    if (cameraOn && !chatMode && videoRef.current) {
      videoRef.current.srcObject = videoStream
    } else if (cameraOn && chatMode && pipVideoRef.current) {
      pipVideoRef.current.srcObject = videoStream
    } else {
      // Clear both to avoid stale frames
      if (videoRef.current) videoRef.current.srcObject = null
      if (pipVideoRef.current) pipVideoRef.current.srcObject = null
    }
  }, [videoStream, cameraOn, chatMode])

  // Sync camera tracks with cameraOn state
  useEffect(() => {
    if (!videoStream) return
    videoStream.getVideoTracks().forEach((track) => { track.enabled = cameraOn })
  }, [cameraOn, videoStream])

  // Capture video frames and send to backend
  useEffect(() => {
    if (!cameraOn || !videoRef.current || !canvasRef.current) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = undefined
      }
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    frameIntervalRef.current = setInterval(() => {
      if (video.readyState < 2) return

      const maxWidth = 640
      const scale = Math.min(maxWidth / video.videoWidth, 1)
      canvas.width = video.videoWidth * scale
      canvas.height = video.videoHeight * scale

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const jpeg = canvas.toDataURL('image/jpeg', 0.5)
      const base64 = jpeg.slice(jpeg.indexOf(',') + 1)
      onFrame(base64)
    }, 1000)

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = undefined
      }
    }
  }, [cameraOn, videoStream, onFrame])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleToggleCamera = () => {
    setCameraOn((on) => !on)
    onToggleCamera()
  }

  const handleToggleChatMode = () => {
    setChatMode((mode) => !mode)
  }

  return (
    <div className="vcp-container">
      {/* Header */}
      <div className="vcp-header">
        <span className="vcp-timer">{formatDuration(callDuration)}</span>
        <button className="vcp-toggle-chat-btn" onClick={handleToggleChatMode}>
          字{chatMode && <span className="vcp-check">✓</span>}
        </button>
      </div>

      {/* Main Area */}
      <div className="vcp-main">
        {!chatMode && !cameraOn && (
          <div className="vcp-digital-human-center">
            <DigitalHuman blendShapes={blendShapes} />
          </div>
        )}

        {!chatMode && cameraOn && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="vcp-fullscreen-video"
          />
        )}

        {chatMode && (
          <div className="vcp-chat-content">
            <ChatInterface
              messages={messages}
              partialText={partialText}
              onSendText={onSendText}
              onVoiceInput={() => {}}
              isRecordingVoice={false}
              onStopSpeaking={onStopSpeaking}
              onPerMsgSpeak={onPerMsgSpeak}
              speakingMsgIdx={speakingMsgIdx}
            />
          </div>
        )}

        {/* PiP - camera small window when chatMode and cameraOn */}
        {cameraOn && chatMode && (
          <div className="vcp-pip">
            <video ref={pipVideoRef} autoPlay playsInline muted />
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="vcp-controls">
        {/* Microphone */}
        <button
          className={`vcp-icon-btn ${isMicOn ? 'active' : 'off'}`}
          onClick={onToggleMic}
          aria-label={isMicOn ? '关闭麦克风' : '打开麦克风'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isMicOn ? (
              // Microphone on
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </>
            ) : (
              // Microphone off (with slash)
              <>
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </>
            )}
          </svg>
        </button>

        {/* Camera */}
        <button
          className={`vcp-icon-btn ${cameraOn ? 'active' : 'off'}`}
          onClick={handleToggleCamera}
          aria-label={cameraOn ? '关闭摄像头' : '打开摄像头'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {cameraOn ? (
              // Camera on
              <>
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </>
            ) : (
              // Camera off (with slash)
              <>
                <line x1="1" y1="1" x2="23" y2="23"/>
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </>
            )}
          </svg>
        </button>

        {/* Hangup */}
        <button className="vcp-icon-btn vcp-hangup-btn" onClick={onBack} aria-label="挂断">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}