import { useRef, useState, useCallback, useEffect } from 'react'
import type { ClientMessage, ServerMessage, DialogState } from '../types'

interface UseWebSocketReturn {
  sendMessage: (msg: ClientMessage) => void
  onMessage: (handler: (msg: ServerMessage) => void) => void
  state: DialogState
  connected: boolean
}

function buildWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  // In dev, use the Vite proxy; in prod, use same host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws`
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<((msg: ServerMessage) => void)[]>([])
  const [state, setState] = useState<DialogState>('idle')
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(buildWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      if (mountedRef.current) setConnected(true)
    }

    ws.onerror = () => {
      console.log('[WS] Error')
    }

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        console.log('[WS] ← msg type:', msg.type, 'handlers:', handlersRef.current.length)
        if (msg.type === 'status') {
          if (mountedRef.current) setState(msg.state)
        }
        handlersRef.current.forEach((h) => h(msg))
      } catch {
        // Binary message, ignore
      }
    }

    ws.onclose = (event) => {
      console.log('[WS] Disconnected', event.code, event.reason ? `"${event.reason}"` : '', 'wasClean:', event.wasClean)
      if (mountedRef.current) {
        setConnected(false)
        setState('idle')
        console.log('[WS] Scheduling reconnect in 2s...')
        reconnectTimerRef.current = setTimeout(connect, 2000)
      }
    }
  }, [])

  useEffect(() => {
    console.log('[WS Hook] Mounted, connecting...')
    mountedRef.current = true
    connect()
    return () => {
      console.log('[WS Hook] Unmounting, cleanup...')
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const onMessage = useCallback((handler: (msg: ServerMessage) => void) => {
    // Clear ALL previous handlers when a new one registers
    // This prevents duplicate processing from multiple handlers during reconnections
    handlersRef.current = [handler]
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler)
    }
  }, [])

  return { sendMessage, onMessage, state, connected }
}
