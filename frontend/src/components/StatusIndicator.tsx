import type { DialogState } from '../types'

interface StatusIndicatorProps {
  state: DialogState
  connected: boolean
}

const STATUS_INFO: Record<DialogState, { label: string; className: string }> = {
  idle: { label: '就绪', className: 'idle' },
  listening: { label: '聆听中', className: 'listening' },
  thinking: { label: '思考中', className: 'thinking' },
  speaking: { label: '回复中', className: 'speaking' },
  disconnected: { label: '已断开', className: 'disconnected' },
}

export default function StatusIndicator({ state, connected }: StatusIndicatorProps) {
  const info = STATUS_INFO[state] || STATUS_INFO.idle

  return (
    <div className="status-indicator">
      <div className={`status-dot ${connected ? info.className : 'disconnected'}`} />
      <span className="status-text">
        {connected ? info.label : '未连接'}
      </span>
    </div>
  )
}
