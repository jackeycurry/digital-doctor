import type { ChatSession } from '../types'

interface HistoryListPageProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const oneDay = 24 * 60 * 60 * 1000

  if (diff < oneDay) {
    return `今天 ${new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diff < 2 * oneDay) {
    return `昨天 ${new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

function getLastMessagePreview(session: ChatSession): string {
  if (session.messages.length === 0) return '暂无消息'
  const last = session.messages[session.messages.length - 1]
  const prefix = last.role === 'user' ? '我: ' : 'AI: '
  return prefix + last.text.slice(0, 30) + (last.text.length > 30 ? '...' : '')
}

export default function HistoryListPage({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
}: HistoryListPageProps) {
  if (sessions.length === 0) {
    return (
      <div className="history-list-empty">
        <div className="history-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <p className="history-empty-text">暂无问诊记录</p>
        <p className="history-empty-sub">开始一段新的对话吧</p>
      </div>
    )
  }

  return (
    <div className="history-list">
      <div className="history-list-header">
        <h2 className="history-list-title">问诊历史</h2>
        <span className="history-list-count">{sessions.length} 条记录</span>
      </div>
      <div className="history-cards">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`history-card ${session.id === currentSessionId ? 'active' : ''}`}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="history-card-header">
              <span className="history-card-title">{session.title || '新对话'}</span>
              <span className="history-card-time">{formatRelativeTime(session.updatedAt)}</span>
            </div>
            <div className="history-card-preview">{getLastMessagePreview(session)}</div>
            <button
              className="history-card-delete"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSession(session.id)
              }}
              aria-label="删除"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}