import { useCallback, useEffect, useRef, useState } from 'react'

export interface LogEntry {
  time: string
  type: 'info' | 'warn' | 'error' | 'send' | 'recv'
  text: string
}

interface LogPanelProps {
  logs: LogEntry[]
}

export function useLogger() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [...prev.slice(-200), { time, type, text }])
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  return { logs, addLog, clearLogs }
}

const COLOR: Record<string, string> = {
  info: '#8ab4f8',
  warn: '#fdd663',
  error: '#f28b82',
  send: '#4fc3f7',
  recv: '#81c995',
}

export default function LogPanel({ logs }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="log-panel">
      <div className="log-entries">
        {logs.length === 0 && (
          <div className="log-placeholder">等待事件...</div>
        )}
        {logs.map((entry, i) => (
          <div key={i} className="log-entry">
            <span className="log-time">{entry.time}</span>
            <span className="log-type" style={{ color: COLOR[entry.type] }}>
              [{entry.type.toUpperCase()}]
            </span>
            <span className="log-text">{entry.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
