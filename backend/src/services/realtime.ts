import { WebSocket } from 'ws'
import { config } from '../config.js'

const SYSTEM_PROMPT = `你是小云医生，一位经验丰富、态度温和的年轻女医生，由河南人工智能大健康研究院研发的AI智能体。你的职责是：
1. 耐心倾听患者的症状描述，像朋友一样关心对方的身体状况
2. 根据症状提供初步的健康建议和注意事项，用通俗易懂的语言解释
3. 每次回复结束时，主动提出1-2个引导性问题，帮助患者更详细地描述症状
4. 在需要时建议患者就医或做进一步检查
5. 当患者开启视频时，观察视频中的物体或人物，并给出相关健康建议

重要规则：
- 始终以中文回复
- 回复简洁生动（80-150字），像亲切的邻家医生
- 不要给出明确的诊断或药方（务必提醒患者就医确诊）
- 遇到胸痛、呼吸困难、严重出血等紧急症状时，立即建议拨打120
- 适当使用关怀语气，如"别担心"、"我理解你的感受"、"慢慢说"
- 回复结尾可以问：如"还有其他不舒服的地方吗？"、"这种情况持续多久了？"等`

export interface RealtimeCallbacks {
  onVadSpeechStart: () => void
  onVadSpeechStop: () => void
  onUserTranscript: (text: string) => void
  onResponseTextDelta: (text: string) => void
  onResponseAudioDelta: (base64Pcm24: string) => void
  onResponseDone: () => void
  onError: (message: string) => void
  onClose: () => void
}

export class RealtimeSession {
  private ws: WebSocket | null = null
  private callbacks: RealtimeCallbacks
  private connected = false
  private eventCounter = 0
  private audioChunkCount = 0
  private videoEnabled = false
  private textReceivedThisTurn = false

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks
  }

  async connect(video = false): Promise<void> {
    this.videoEnabled = video
    const url = `${config.dashscope.realtimeEndpoint}?model=${config.dashscope.realtimeModel}`
    console.log('[Realtime] Connecting to:', url, video ? '(video mode)' : '')

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${config.dashscope.apiKey}`,
        },
      })

      ws.onopen = () => {
        console.log('[Realtime] Connected to DashScope')
        this.connected = true
        this.configureSession()
        resolve()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data.toString())
          this.handleMessage(msg)
        } catch {
          // Binary message, ignore
        }
      }

      ws.onerror = (err) => {
        console.error('[Realtime] WebSocket error:', err)
        this.connected = false
        if (ws.readyState === WebSocket.OPEN) {
          reject(err)
        }
      }

      ws.onclose = (event) => {
        console.log(`[Realtime] Disconnected: code=${event.code}`)
        this.connected = false
        this.callbacks.onClose()
      }

      this.ws = ws
    })
  }

  private configureSession(): void {
    this.send({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: config.dashscope.realtimeVoice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm24',
        instructions: SYSTEM_PROMPT,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.3,
          silence_duration_ms: 400,
        },
      },
    })
  }

  sendAudio(base64Pcm16: string): void {
    if (!this.connected) return
    this.audioChunkCount++
    if (this.audioChunkCount % 20 === 1) {
      console.log(`[Realtime] Sent ${this.audioChunkCount} audio chunks (~${(this.audioChunkCount * 0.1).toFixed(1)}s)`)
    }
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Pcm16,
    })
  }

  sendText(text: string): void {
    if (!this.connected) return
    console.log('[Realtime] Sending text:', text.slice(0, 80))
    // Send user text as a conversation item and trigger response
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    })
    this.send({ type: 'response.create' })
  }

  sendVideoFrame(base64Jpeg: string): void {
    if (!this.connected || !this.videoEnabled) return
    this.send({
      type: 'input_image_buffer.append',
      image: base64Jpeg,
    })
  }

  clearVideo(): void {
    if (!this.connected) return
    // Per docs, clearing audio buffer also clears image buffer
    this.send({ type: 'input_audio_buffer.clear' })
  }

  cancelResponse(): void {
    if (!this.connected) return
    // Reset so that if response.done arrives despite cancel, we extract its full text
    this.textReceivedThisTurn = false
    this.send({ type: 'response.cancel' })
  }

  clearAudio(): void {
    if (!this.connected) return
    this.send({ type: 'input_audio_buffer.clear' })
  }

  close(): void {
    this.connected = false
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }

  private send(data: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    data.event_id = `evt_${++this.eventCounter}_${Date.now()}`
    this.ws.send(JSON.stringify(data))
  }

  private handleMessage(msg: any): void {
    const type = msg.type || 'unknown'
    if (type !== 'response.audio.delta' && type !== 'input_audio_buffer.append') {
      console.log(`[Realtime] ← ${type}`, type === 'error' ? JSON.stringify(msg) : '')
    }

    switch (msg.type) {
      case 'session.created':
        console.log('[Realtime] Session created:', msg.session?.id)
        break

      case 'session.updated':
        console.log('[Realtime] Session configured')
        break

      case 'input_audio_buffer.speech_started':
        console.log('[Realtime] VAD speech started')
        this.audioChunkCount = 0
        this.textReceivedThisTurn = false
        this.callbacks.onVadSpeechStart()
        break

      case 'input_audio_buffer.speech_stopped':
        console.log('[Realtime] VAD speech stopped')
        this.callbacks.onVadSpeechStop()
        break

      case 'conversation.item.input_audio_transcription.completed':
        console.log('[Realtime] User transcript:', msg.transcript)
        this.callbacks.onUserTranscript(msg.transcript || '')
        break

      case 'response.audio_transcript.delta': {
        const text = msg.delta || msg.transcript || msg.text || ''
        if (text) {
          this.textReceivedThisTurn = true
          console.log('[Realtime] Audio transcript delta:', text.slice(0, 40))
          this.callbacks.onResponseTextDelta(text)
        }
        break
      }

      case 'response.audio_transcript.done': {
        const text = msg.transcript || msg.text || ''
        if (text) {
          this.textReceivedThisTurn = true
          console.log('[Realtime] Audio transcript done:', text.slice(0, 80))
          this.callbacks.onResponseTextDelta(text)
        }
        break
      }

      case 'response.text.delta': {
        const text = msg.delta || msg.text || msg.content || ''
        if (text) {
          this.textReceivedThisTurn = true
          console.log('[Realtime] Text delta:', text.slice(0, 40))
          this.callbacks.onResponseTextDelta(text)
        }
        break
      }

      case 'response.text.done': {
        const text = msg.text || msg.content || ''
        if (text) {
          this.textReceivedThisTurn = true
          console.log('[Realtime] Text done:', text.slice(0, 80))
          this.callbacks.onResponseTextDelta(text)
        }
        break
      }

      case 'response.audio.delta': {
        this.callbacks.onResponseAudioDelta(msg.delta || '')
        break
      }

      case 'response.output_item.done': {
        const text = msg.item?.content?.[0]?.transcript
          || msg.item?.content?.[0]?.text
          || ''
        if (text) {
          this.textReceivedThisTurn = true
          console.log('[Realtime] Output item done, text:', text.slice(0, 80))
          this.callbacks.onResponseTextDelta(text)
        }
        break
      }

      case 'response.done': {
        console.log('[Realtime] Response done — textReceivedThisTurn=', this.textReceivedThisTurn)
        // If DashScope never sent text deltas, extract full text from the response output
        if (!this.textReceivedThisTurn) {
          console.log('[Realtime] No text deltas received — extracting from response.done:', JSON.stringify(msg).slice(0, 500))
          let fullText = ''
          const output = msg.response?.output
          if (Array.isArray(output)) {
            for (const item of output) {
              if (item.content && Array.isArray(item.content)) {
                for (const c of item.content) {
                  const t = c.transcript || c.text || ''
                  if (t) fullText += t
                }
              }
            }
          } else if (output?.text) {
            fullText = output.text
          } else if (msg.response?.text) {
            fullText = msg.response.text
          }
          if (fullText) {
            console.log('[Realtime] Extracted text from response.done:', fullText.slice(0, 120))
            this.callbacks.onResponseTextDelta(fullText)
          }
        }
        this.textReceivedThisTurn = false
        this.callbacks.onResponseDone()
        break
      }

      case 'error':
        console.error('[Realtime] Error event:', JSON.stringify(msg))
        this.callbacks.onError(msg.message || JSON.stringify(msg))
        break

      default:
        if (type !== 'response.audio.delta') {
          console.log('[Realtime] Unhandled event:', type, JSON.stringify(msg).slice(0, 300))
        }
        break
    }
  }
}
