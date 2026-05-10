import { useRef, useEffect, useState, useCallback } from 'react'

interface VideoCallProps {
  stream: MediaStream | null
  onClose: () => void
  onFrame: (base64Jpeg: string) => void
  isRecording: boolean       // microphone active
  onToggleMic: () => void  // toggle microphone
}

export default function VideoCall({
  stream,
  onClose,
  onFrame,
  isRecording,
  onToggleMic,
}: VideoCallProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const [cameraOn, setCameraOn] = useState(true)

  // Wire stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  // Capture frames and send to backend
  useEffect(() => {
    if (!stream || !cameraOn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Ensure video is playing
    if (video.paused) {
      video.play().catch(() => {})
    }

    intervalRef.current = setInterval(() => {
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [stream, cameraOn, onFrame])

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev
      if (stream) {
        stream.getVideoTracks().forEach((t) => { t.enabled = next })
      }
      return next
    })
  }, [stream])

  return (
    <div className="call-bar">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video preview area */}
      <div className="call-preview">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`call-video${cameraOn ? '' : ' hidden'}`}
            />
            {!cameraOn && (
              <div className="call-no-video">摄像头已关闭</div>
            )}
          </>
        ) : (
          <div className="call-no-video">正在启动摄像头...</div>
        )}
      </div>

      {/* Control bar */}
      <div className="call-controls">
        {/* Mic toggle */}
        <button
          className={`call-btn ${!isRecording ? 'off' : ''}`}
          onClick={onToggleMic}
          aria-label={isRecording ? '关闭麦克风' : '打开麦克风'}
          title={isRecording ? '关闭麦克风' : '打开麦克风'}
        >
          {isRecording ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>

        {/* Camera toggle */}
        <button
          className={`call-btn ${!cameraOn ? 'off' : ''}`}
          onClick={toggleCamera}
          aria-label={cameraOn ? '关闭摄像头' : '打开摄像头'}
          title={cameraOn ? '关闭摄像头' : '打开摄像头'}
        >
          {cameraOn ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          )}
        </button>

        {/* Hangup */}
        <button
          className="call-btn call-hangup"
          onClick={onClose}
          aria-label="挂断"
          title="挂断"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
