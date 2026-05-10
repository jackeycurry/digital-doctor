import type { DialogState } from '../types'

interface TalkButtonProps {
  state: DialogState
  connected: boolean
  inConversation: boolean
  onStart: () => void
  onStop: () => void
}

function StatusIcon({ state, connected, isActive }: { state: DialogState; connected: boolean; isActive: boolean }) {
  if (!connected) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="6" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )
  }
  if (state === 'disconnected') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )
  }
  if (!isActive || state === 'idle') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    )
  }
  if (state === 'listening') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    )
  }
  if (state === 'thinking') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="9" cy="10" r="1.5"/>
        <circle cx="15" cy="10" r="1.5"/>
        <path d="M9 15c.83.67 1.83 1 3 1s2.17-.33 3-1"/>
      </svg>
    )
  }
  if (state === 'speaking') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function getLabel(isActive: boolean, state: DialogState, connected: boolean) {
  if (!connected) return '连接中...'
  if (state === 'disconnected') return '连接断开'
  if (!isActive) return '开始通话'
  if (state === 'listening') return '聆听中...'
  if (state === 'thinking') return '思考中...'
  if (state === 'speaking') return '回复中...'
  return '通话中'
}

function getHint(isActive: boolean, state: DialogState, connected: boolean) {
  if (!connected) return ''
  if (state === 'disconnected') return '点击重试'
  if (!isActive) return '点击开始问诊'
  if (state === 'listening') return '请说话'
  if (state === 'thinking') return '稍等片刻'
  if (state === 'speaking') return '点击可挂断'
  return '等待语音...'
}

export default function TalkButton({
  state,
  connected,
  inConversation,
  onStart,
  onStop,
}: TalkButtonProps) {
  const isActive = state !== 'idle' || inConversation
  const label = getLabel(isActive, state, connected)
  const hint = getHint(isActive, state, connected)

  return (
    <div className="phone-button-wrapper">
      <button
        className={`phone-button ${isActive ? 'active' : ''}`}
        onClick={() => {
          if (isActive) {
            onStop()
          } else if (connected) {
            onStart()
          }
        }}
        disabled={!connected && !isActive}
        aria-label={label}
      >
        <span className="phone-button-icon">
          <StatusIcon state={state} connected={connected} isActive={isActive} />
        </span>
        <span className="phone-button-label">{label}</span>
      </button>
      {hint && <span className="phone-button-hint">{hint}</span>}
    </div>
  )
}
