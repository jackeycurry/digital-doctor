import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { config } from './config.js'
import { handleConnection } from './wsHandler.js'
import { register, login } from './auth.js'
import CryptoJS from 'crypto-js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { phone, password } = req.body as { phone?: string; password?: string }
  if (!phone || !password) {
    return res.status(400).json({ error: '手机号和密码不能为空' })
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' })
  }
  const result = await register(phone, password)
  if (!result.success) {
    return res.status(409).json({ error: result.error })
  }
  res.json({ success: true })
})

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body as { phone?: string; password?: string }
  if (!phone || !password) {
    return res.status(400).json({ error: '手机号和密码不能为空' })
  }
  const result = await login(phone, password)
  if (!result.success) {
    return res.status(401).json({ error: result.error })
  }
  res.json({ token: result.token, phone: result.phone })
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Build iFlytek WebSocket authentication URL
function buildIFlytekAuthUrl(host: string, path: string, apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString()
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
  const signature = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
  )
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')

  return `wss://${host}${path}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`
}

// TTS endpoint — iFlytek TTS (WebSocket)
app.post('/api/tts', async (req, res) => {
  const { text } = req.body as { text: string }

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text field required' })
    return
  }

  const appId = config.iflytek.appId
  const apiKey = config.iflytek.apiKey
  const apiSecret = config.iflytek.apiSecret

  if (!appId || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'iFlytek credentials not configured' })
    return
  }

  try {
    const host = 'tts-api.xfyun.cn'
    const path = '/v2/tts'
    const url = buildIFlytekAuthUrl(host, path, apiKey, apiSecret)

    console.log('[TTS] Connecting to iFlytek TTS...')

    const audioChunks: Buffer[] = []
    let errorOccurred = false
    let sessionEnded = false

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url)

      const timeout = setTimeout(() => {
        if (!sessionEnded) {
          console.log('[TTS] Timeout, closing session')
          ws.close()
        }
      }, 30000)

      ws.on('open', () => {
        console.log('[TTS] WebSocket connected')

        const request = {
          common: { app_id: appId },
          business: {
            aue: 'lame',
            auf: 'audio/L16;rate=16000',
            vcn: 'x4_yezi',
            speed: 50,
            volume: 50,
            pitch: 50,
            bgs: 0,
            tte: 'utf8'
          },
          data: {
            status: 2,
            text: Buffer.from(text).toString('base64')
          }
        }

        ws.send(JSON.stringify(request))
        console.log('[TTS] Request sent')
      })

      ws.on('message', (data: Buffer | string) => {
        let text = ''
        if (Buffer.isBuffer(data)) {
          text = data.toString('utf8')
        } else if (typeof data === 'string') {
          text = data
        }

        // Try to parse as JSON
        try {
          const message = JSON.parse(text)
          console.log('[TTS] Response:', message.code, message.message)

          if (message.code !== 0) {
            console.error('[TTS] iFlytek error:', message.code, message.message)
            errorOccurred = true
            clearTimeout(timeout)
            ws.close()
            res.status(500).json({ error: message.message || 'TTS failed', code: message.code })
            reject(new Error(message.message))
            return
          }

          if (message.data?.audio) {
            const audioChunk = Buffer.from(message.data.audio, 'base64')
            audioChunks.push(audioChunk)
            console.log('[TTS] Audio from JSON:', audioChunk.length, 'bytes')
          }

          if (message.data?.status === 2 || message.status === 2) {
            sessionEnded = true
            clearTimeout(timeout)
            ws.close()
          }
          return
        } catch {
          // Not JSON — treat as binary audio
        }

        // Binary audio data (raw PCM/MP3 frames)
        const audioChunk = Buffer.isBuffer(data) ? data : Buffer.from(data)
        audioChunks.push(audioChunk)
        console.log('[TTS] Audio chunk:', audioChunk.length, 'bytes')
      })

      ws.on('error', (err) => {
        console.error('[TTS] WebSocket error:', err.message)
        if (!errorOccurred) {
          errorOccurred = true
          clearTimeout(timeout)
          res.status(500).json({ error: 'TTS connection error' })
          reject(err)
        }
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        console.log('[TTS] WebSocket closed')
        if (!errorOccurred && audioChunks.length > 0) {
          const audioBuffer = Buffer.concat(audioChunks)
          console.log('[TTS] Audio total:', audioBuffer.length, 'bytes')
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Content-Length', audioBuffer.length.toString())
          res.send(audioBuffer)
          resolve()
        } else if (!errorOccurred) {
          res.status(500).json({ error: 'No audio received' })
          reject(new Error('No audio received'))
        }
      })
    })
  } catch (err) {
    console.error('[TTS] Error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// STT endpoint — iFlytek Voice Dictation WebSocket (流式语音转写)
app.post('/api/stt', async (req, res) => {
  const { audio } = req.body as { audio: string }

  if (!audio || typeof audio !== 'string') {
    res.status(400).json({ error: 'audio field required' })
    return
  }

  console.log('[STT] Request received, audio base64 length:', audio.length)

  const appId = config.iflytek.appId
  const apiKey = config.iflytek.apiKey
  const apiSecret = config.iflytek.apiSecret

  if (!appId || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'iFlytek credentials not configured' })
    return
  }

  // Decode base64 audio to PCM binary
  const audioBuffer = Buffer.from(audio, 'base64')
  console.log('[STT] Decoded audio buffer size:', audioBuffer.length, 'bytes')

  // Strip WAV header if present (44-byte RIFF/WAVE header)
  let pcmBuffer = audioBuffer
  if (audioBuffer.length > 44 &&
      audioBuffer.slice(0, 4).toString() === 'RIFF' &&
      audioBuffer.slice(8, 12).toString() === 'WAVE') {
    pcmBuffer = audioBuffer.slice(44)
    console.log('[STT] Stripped WAV header, PCM size:', pcmBuffer.length)
  }

  // Build WebSocket URL with HMAC-SHA256 authentication
  const host = 'iat-api.xfyun.cn'
  const path = '/v2/iat'

  // date: RFC1123 format, UTC+0
  const dateStr = new Date().toUTCString()
  // signature_origin: host:{host}\ndate:{date}\nGET {path} HTTP/1.1
  const signatureOrigin = `host: ${host}\ndate: ${dateStr}\nGET ${path} HTTP/1.1`
  const signature = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
  )
  // authorization_origin
  const authOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authOrigin).toString('base64')

  const fullUrl = `wss://${host}${path}?host=${encodeURIComponent(host)}&date=${encodeURIComponent(dateStr)}&authorization=${encodeURIComponent(authorization)}`
  console.log('[STT] Connecting to:', `wss://${host}${path}?host=${host}&date=...`)

  let resultText = ''
  let errorOccurred = false
  let sessionEnded = false

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(fullUrl)

    const timeout = setTimeout(() => {
      console.log('[STT] Timeout')
      if (!sessionEnded) {
        sessionEnded = true
        ws.close()
      }
    }, 30000)

    ws.on('open', () => {
      console.log('[STT] WebSocket connected, sending first frame...')

      // First frame: include common + business params
      const firstChunkLen = Math.min(1280, pcmBuffer.length)
      const firstFrame = {
        common: { app_id: appId },
        business: {
          language: 'zh_cn',
          domain: 'iat',
          accent: 'mandarin',
          ptt: 0,
          eos: 3000,
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: pcmBuffer.toString('base64').slice(0, firstChunkLen),
        },
      }
      ws.send(JSON.stringify(firstFrame))

      // Send remaining audio in chunks (6400 bytes = 200ms at 16kHz)
      // First frame already included bytes [0, firstChunkLen), continue from there
      let offset = firstChunkLen
      const chunkSize = 6400

      const sendChunk = () => {
        while (offset < pcmBuffer.length && ws.readyState === WebSocket.OPEN) {
          const chunk = pcmBuffer.slice(offset, offset + chunkSize)
          offset += chunk.length
          const status = offset >= pcmBuffer.length ? 2 : 1
          ws.send(JSON.stringify({
            data: {
              status,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: chunk.toString('base64'),
            },
          }))
          if (status === 2) break
          // Small delay to avoid flooding (10ms between 200ms chunks = 5KB/s above pcm rate)
          setTimeout(sendChunk, 10)
          return
        }
        if (offset >= pcmBuffer.length) {
          console.log('[STT] All audio sent, total bytes:', offset)
        }
      }
      sendChunk()
    })

    ws.on('message', (data: Buffer | string) => {
      let text = ''
      if (Buffer.isBuffer(data)) {
        text = data.toString('utf8')
      } else {
        text = data
      }

      console.log('[STT] WS message, length:', text.length)

      try {
        const message = JSON.parse(text)
        console.log('[STT] Response:', JSON.stringify(message).slice(0, 300))

        // Check for errors
        if (message.code && message.code !== 0) {
          console.error('[STT] Error:', message.code, message.message)
          errorOccurred = true
          clearTimeout(timeout)
          ws.close()
          res.status(500).json({ error: message.message || 'STT failed', code: message.code })
          reject(new Error(message.message))
          return
        }

        // Voice dictation response:
        // { code: 0, data: { result: { ws: [{ cw: [{ w: "字" }] }] }, status } } }
        if (message.data?.result?.ws) {
          for (const word of message.data.result.ws) {
            if (word.cw) {
              for (const w of word.cw) {
                if (w.w) {
                  resultText += w.w
                }
              }
            }
          }
          console.log('[STT] Transcription chunk, accumulated:', resultText.length, 'chars')
        }

        // data.status: 0=first, 1=intermediate, 2=final
        if (message.data?.status === 2) {
          console.log('[STT] Transcription complete, final text:', resultText.slice(0, 100))
          sessionEnded = true
          clearTimeout(timeout)
          ws.close()
        }
      } catch (e) {
        console.log('[STT] Non-JSON message or parse error')
      }
    })

    ws.on('error', (err) => {
      console.error('[STT] WebSocket error:', err.message)
      if (!errorOccurred) {
        errorOccurred = true
        clearTimeout(timeout)
        res.status(500).json({ error: 'STT connection error: ' + err.message })
        reject(err)
      }
    })

    ws.on('close', () => {
      clearTimeout(timeout)
      console.log('[STT] WebSocket closed')
      console.log('[STT] Final transcription:', resultText.slice(0, 80))
      if (!errorOccurred) {
        res.json({ text: resultText })
        resolve()
      }
    })
  })
})

// REST text chat endpoint (SSE streaming)
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] }

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array required' })
    return
  }

  if (!config.dashscope.apiKey) {
    res.status(500).json({ error: 'API key not configured' })
    return
  }

  // System prompt for the doctor
  const systemMsg = {
    role: 'system',
    content: '你是小云医生，一位经验丰富、态度温和的年轻女医生，由河南人工智能大健康研究院研发的AI智能体。用通俗易懂的语言解释医学问题，回复简洁生动（80-150字），每次回复结尾提1-2个引导性问题帮助患者更详细描述症状。不要给出明确的诊断或药方（务必提醒就医确诊）。遇到紧急症状立即建议拨打120。语气亲切、专业、像邻家医生。始终以中文回复。',
  }

  const body = {
    model: 'qwen-plus',
    messages: [systemMsg, ...messages],
    stream: true,
    temperature: 0.7,
    max_tokens: 500,
  }

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.dashscope.apiKey}`,
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Chat] API error:', response.status, errText)
      res.status(response.status).json({ error: 'AI service error' })
      return
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const reader = response.body?.getReader()
    if (!reader) {
      res.status(500).json({ error: 'No response stream' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n')
            continue
          }
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              res.write(`data: ${JSON.stringify({ text: delta })}\n\n`)
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[Chat] Error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' })
    } else {
      res.end()
    }
  }
})

const server = createServer(app)

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  handleConnection(ws)
})

server.listen(config.port, () => {
  console.log(`[Server] Digital Doctor backend running on http://localhost:${config.port}`)
  console.log(`[Server] WebSocket at ws://localhost:${config.port}/ws`)
  console.log(`[Server] Chat API at http://localhost:${config.port}/api/chat`)
  console.log(`[Server] TTS/STT provider: iFlytek WebSocket API (tts-api.xfyun.cn)`)

  if (!config.dashscope.apiKey) {
    console.warn('[WARN] DASHSCOPE_API_KEY not set - AI chat will fail')
  }
  if (!config.iflytek.appId) {
    console.warn('[WARN] IFLYTEK credentials not set - STT/TTS will fail')
  }
})
