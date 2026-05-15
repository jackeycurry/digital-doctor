import { useState, useEffect, useCallback } from 'react'
import type { ChatSession, ChatMessage } from '../types'

const STORAGE_KEY = 'dd_sessions'

// 从 AI 回复提取关键词作为 title
function extractTitleFromAIResponse(text: string): string {
  // 去掉开头寒暄，提取核心症状/问题
  const cleaned = text
    .replace(/您好[，,]?/g, '')
    .replace(/我是小云医生[。,]?/g, '')
    .replace(/根据您描述的[，,]?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // 取前15个字
  return cleaned.slice(0, 15) || '新对话'
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  // 获取当前会话
  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null

  // 创建新会话（仅当没有活动会话时）
  const createSession = useCallback((): string => {
    const id = crypto.randomUUID()
    const now = Date.now()
    const newSession: ChatSession = {
      id,
      title: '',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    setSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(id)
    return id
  }, [])

  // 确保有活动会话
  const ensureSession = useCallback((): string => {
    if (currentSessionId && sessions.find((s) => s.id === currentSessionId)) {
      return currentSessionId
    }
    return createSession()
  }, [currentSessionId, sessions, createSession])

  // 添加用户消息（sessionId 可选，用于避免 ensureSession 重复调用）
  const addUserMessage = useCallback((text: string, sessionId?: string) => {
    const sid = sessionId ?? ensureSession()
    const msg: ChatMessage = { role: 'user', text }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sid
          ? { ...s, messages: [...s.messages, msg], updatedAt: Date.now() }
          : s
      )
    )
  }, [ensureSession])

  // 添加 AI 回复（同时生成 title，sessionId 可选）
  const addAssistantMessage = useCallback((text: string, sessionId?: string) => {
    const sid = sessionId ?? ensureSession()
    const msg: ChatMessage = { role: 'assistant', text }
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sid) return s
        // 如果还没有 title，从 AI 回复提取
        const title = s.title || extractTitleFromAIResponse(text)
        return { ...s, messages: [...s.messages, msg], title, updatedAt: Date.now() }
      })
    )
  }, [ensureSession])

  // 切换到指定会话
  const switchToSession = useCallback((id: string) => {
    setCurrentSessionId(id)
  }, [])

  // 删除会话
  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (currentSessionId === id) {
      setCurrentSessionId(null)
    }
  }, [currentSessionId])

  return {
    sessions,
    currentSession,
    currentSessionId,
    addUserMessage,
    addAssistantMessage,
    switchToSession,
    deleteSession,
    createSession,
    ensureSession,
  }
}
