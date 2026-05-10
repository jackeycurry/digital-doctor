import { useRef, useEffect, useState, useCallback } from 'react'
import type { ChatMessage } from '../types'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  partialText: string
  onSendText: (text: string) => void
  onVoiceInput: () => void
  isRecordingVoice: boolean
  onStopSpeaking?: () => void
  onPerMsgSpeak?: (text: string, idx: number) => void
  speakingMsgIdx?: number | null
}

const WELCOME_GUIDES = [
  '我头疼发烧，浑身没劲',
  '最近总是失眠，半夜容易醒',
  '肩膀和腰酸痛，坐久了更严重',
  '怀孕期间饮食要注意什么？',
  '有时候会心慌胸闷，喘不上气',
  '体检有几项指标偏高，帮我看看',
]

// Doctor guides patient on what to answer next — chips are patient's choices
const FOLLOW_UP_OPTIONS: Record<string, { label: string; options: string[] }> = {
  default: {
    label: '小云医生想进一步了解：',
    options: ['这里不太舒服', '已经有几天了', '之前没有过这种情况'],
  },
  头痛: {
    label: '小云医生想确认一下：',
    options: ['前额这一块疼', '后脑勺疼', '太阳穴两边跳着疼', '整个头都疼'],
  },
  发烧: {
    label: '小云医生想知道：',
    options: ['体温38度左右', '烧了一天了', '吃了退烧药', '还伴有咳嗽'],
  },
  失眠: {
    label: '小云医生想了解更多：',
    options: ['躺下很久才能睡着', '半夜醒好几次', '天没亮就醒了', '白天特别困'],
  },
  酸痛: {
    label: '小云医生想确认：',
    options: ['主要是肩膀酸', '腰疼得厉害', '脖子也不舒服', '休息后会好一些'],
  },
  过敏: {
    label: '小云医生想了解：',
    options: ['皮肤发红发痒', '起了很多小疹子', '吃了海鲜之后开始的', '以前也有过敏史'],
  },
  咳嗽: {
    label: '小云医生想了解：',
    options: ['干咳没痰', '有黄色痰', '晚上咳得更厉害', '咳了快一周了'],
  },
  肠胃: {
    label: '小云医生想了解：',
    options: ['胃隐隐作痛', '有点恶心反胃', '这两天拉肚子', '吃东西没胃口'],
  },
}

function getFollowUp(aiText: string): { label: string; options: string[] } | null {
  for (const [keyword, data] of Object.entries(FOLLOW_UP_OPTIONS)) {
    if (keyword === 'default') continue
    if (aiText.includes(keyword)) return data
  }
  return FOLLOW_UP_OPTIONS.default
}

export default function ChatInterface({
  messages,
  partialText,
  onSendText,
  onVoiceInput,
  isRecordingVoice,
  onStopSpeaking,
  onPerMsgSpeak,
  speakingMsgIdx,
}: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputText, setInputText] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partialText])

  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text && attachments.length === 0) return
    // Include attachment info in text for now
    let fullText = text
    if (attachments.length > 0) {
      const fileNames = attachments.map((f) => f.name).join(', ')
      fullText = text + (text ? '\n\n' : '') + `[附件: ${fileNames}]`
    }
    onSendText(fullText)
    setInputText('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputText, attachments, onSendText])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 100) + 'px'
    }
  }, [])

  // Per-message speak button — delegate audio playback to App via onPerMsgSpeak
  const handleSpeak = useCallback(async (text: string, idx: number) => {
    onPerMsgSpeak?.(text, idx)
  }, [onPerMsgSpeak])

  const showPlaceholder = messages.length === 0 && !partialText

  // Get last AI message for follow-up suggestions
  const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant')
  const followUp = lastAiMsg && !partialText ? getFollowUp(lastAiMsg.text) : null

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {showPlaceholder && (
          <div className="chat-placeholder">
            <div className="placeholder-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <p className="placeholder-title">您好，我是小云医生</p>
            <p className="placeholder-subtitle">
              由河南人工智能大健康研究院研发的AI健康助手。请描述您的症状，我会为您提供专业建议。
            </p>
            <div className="placeholder-hints">
              {WELCOME_GUIDES.map((text) => (
                <span
                  key={text}
                  className="hint-chip"
                  onClick={() => onSendText(text)}
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`chat-message ${msg.role}`}>
              <div className="message-role">
                {msg.role === 'user' ? '您' : '小云医生'}
              </div>
              <div className="message-text">{msg.text}</div>
              {msg.role === 'assistant' && (
                <button
                  className={`msg-speak-btn ${speakingMsgIdx === i ? 'speaking' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleSpeak(msg.text, i) }}
                  aria-label={speakingMsgIdx === i ? '停止播报' : '语音播报'}
                  title={speakingMsgIdx === i ? '停止' : '播报'}
                >
                  {speakingMsgIdx === i ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
            {/* Follow-up guide chips — doctor prompts patient */}
            {msg.role === 'assistant' && i === messages.length - 1 && followUp && (
              <div className="followup-chips">
                <span className="followup-label">{followUp.label}</span>
                {followUp.options.map((opt) => (
                  <span
                    key={opt}
                    className="followup-chip"
                    onClick={() => onSendText(opt)}
                  >
                    {opt}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {partialText && (
          <div className="chat-message assistant">
            <div className="message-role">小云医生</div>
            <div className="message-text streaming">{partialText}</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((file, i) => (
              <div key={i} className="chat-attachment">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <span>{file.name}</span>
                <button
                  className="attachment-close"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="移除附件"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) {
                setAttachments((prev) => [...prev, ...files])
              }
              e.target.value = ''
            }}
          />
          <button
            className="input-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="上传文件"
            title="上传文件"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
          <button
            className={`input-mic-btn ${isRecordingVoice ? 'recording' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              console.log('[Chat] mic btn clicked, isRecordingVoice:', isRecordingVoice)
              try {
                onVoiceInput()
              } catch (err) {
                console.error('[Chat] onVoiceInput error:', err)
              }
            }}
            aria-label={isRecordingVoice ? '停止录音' : '语音输入'}
            title={isRecordingVoice ? '点击停止' : '语音转文字'}
          >
            {isRecordingVoice ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="描述您的症状，小云医生为您解答..."
          />
          <button
            className="input-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim() && attachments.length === 0}
            aria-label="发送"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
