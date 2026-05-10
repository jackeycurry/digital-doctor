import { WebSocket } from 'ws'
import { RealtimeSession, type RealtimeCallbacks } from './services/realtime.js'
import type { ClientMessage, ServerMessage } from './types.js'

class ConversationHandler {
  private ws: WebSocket
  private session: RealtimeSession | null = null
  private videoActive = false
  private pingInterval: ReturnType<typeof setInterval> | null = null

  constructor(ws: WebSocket) {
    this.ws = ws
    // Send ping every 15s to keep connection alive (mobile OS kills idle WS)
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
        console.log('[WS] ping sent')
      }
    }, 15000)
  }

  sendMessage(msg: ServerMessage): void {
    this.send(msg)
  }

  start(video = false): void {
    const callbacks: RealtimeCallbacks = {
      onVadSpeechStart: () => {
        console.log('[WS] VAD speech started → state=listening')
        this.send({ type: 'status', state: 'listening' })
      },

      onVadSpeechStop: () => {
        console.log('[WS] VAD speech stopped → state=thinking')
        this.send({ type: 'status', state: 'thinking' })
      },

      onUserTranscript: (text: string) => {
        console.log('[WS] User said:', text)
        this.send({ type: 'user_transcript', text })
      },

      onResponseTextDelta: (text: string) => {
        console.log('[WS] onResponseTextDelta, text length:', text.length, 'preview:', text.slice(0, 20))
        this.send({ type: 'response_text_delta', text })
      },

      onResponseAudioDelta: (base64Pcm24: string) => {
        this.send({ type: 'response_audio_delta', data: base64Pcm24 })
      },

      onResponseDone: () => {
        console.log('[WS] Response done → state=idle')
        this.send({ type: 'response_done' })
        this.send({ type: 'status', state: 'idle' })
      },

      onError: (message: string) => {
        console.error('[WS] Realtime error:', message)
        this.send({ type: 'error', message })
        this.send({ type: 'status', state: 'idle' })
      },

      onClose: () => {
        console.log('[WS] Realtime session closed')
        this.send({ type: 'status', state: 'idle' })
        this.videoActive = false
        this.session = null
      },
    }

    this.session = new RealtimeSession(callbacks)
    this.session.connect(video).catch((err) => {
      console.error('[WS] Failed to connect to DashScope Realtime:', err)
      this.send({ type: 'error', message: '连接AI医生失败，请稍后重试' })
      this.send({ type: 'status', state: 'disconnected' })
    })
  }

  handleMessage(raw: unknown): void {
    try {
      const msg = JSON.parse(raw as string) as ClientMessage
      switch (msg.type) {
        case 'start_conversation':
          console.log('[WS] Starting voice conversation')
          if (!this.session) this.start(false)
          break

        case 'stop_conversation':
          console.log('[WS] Stopping voice conversation')
          if (this.session) {
            this.session.close()
            this.session = null
          }
          this.videoActive = false
          this.send({ type: 'status', state: 'idle' })
          break

        case 'audio_chunk':
          if (this.session) {
            this.session.sendAudio(msg.data)
          }
          break

        case 'text_input':
          console.log('[WS] Text input:', msg.text.slice(0, 80))
          if (!this.session) {
            this.start(false)
          }
          // Small delay to ensure session is configured before sending text
          if (this.session) {
            this.session.sendText(msg.text)
          }
          break

        case 'start_video_call':
          console.log('[WS] Starting video call')
          // Close existing session if any, then start with video
          if (this.session) {
            this.session.close()
            this.session = null
          }
          this.videoActive = true
          this.start(true)
          break

        case 'stop_video_call':
          console.log('[WS] Stopping video call')
          if (this.session) {
            this.session.clearVideo()
          }
          this.videoActive = false
          break

        case 'video_frame':
          if (this.session && this.videoActive) {
            this.session.sendVideoFrame(msg.data)
          }
          break

        default:
          console.warn('[WS] Unknown message:', (msg as any).type)
      }
    } catch {
      // Binary or invalid message
    }
  }

  cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    if (this.session) {
      this.session.close()
      this.session = null
    }
  }

  private send(msg: ServerMessage): void {
    const state = this.ws.readyState
    if (state === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      console.log(`[WS] send() DROPPED: type=${msg.type} state=${state}`)
    }
  }
}

export function handleConnection(ws: WebSocket): void {
  console.log('[WS] Client connected')
  const handler = new ConversationHandler(ws)

  handler.sendMessage({ type: 'status', state: 'idle' })

  ws.on('message', (raw) => {
    handler.handleMessage(raw.toString())
  })

  ws.on('close', () => {
    console.log('[WS] Client disconnected')
    handler.cleanup()
  })

  ws.on('error', (err) => {
    console.error('[WS] Error:', err)
    handler.cleanup()
  })

  ws.on('pong', () => {
    console.log('[WS] pong received')
  })

  ws.on('ping', () => {
    console.log('[WS] ping received from client')
  })
}
