import { useRef, useCallback, useEffect, useState } from 'react'
import type { DialogState } from '../types'

interface FloatingCallButtonsProps {
  state: DialogState
  connected: boolean
  inCall: boolean
  onStartCall: () => void
  staticPosition?: boolean
}

const DRAG_THRESHOLD = 4

export default function FloatingCallButtons({
  state,
  connected,
  inCall,
  onStartCall,
  staticPosition,
}: FloatingCallButtonsProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const movedRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0, left: 0, top: 0 })

  useEffect(() => {
    const el = wrapperRef.current
    if (el && pos.x === 0 && pos.y === 0) {
      const rect = el.getBoundingClientRect()
      setPos({ x: rect.left, y: rect.top })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    movedRef.current = false
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      top: rect.top,
    }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startRef.current.x
      const dy = ev.clientY - startRef.current.y
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        movedRef.current = true
      }
      if (!movedRef.current) return

      const vw = window.innerWidth
      const vh = window.innerHeight
      const elW = el.offsetWidth
      const elH = el.offsetHeight

      setPos({
        x: Math.min(Math.max(startRef.current.left + dx, 0), vw - elW),
        y: Math.min(Math.max(startRef.current.top + dy, 0), vh - elH),
      })
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [])

  if (!connected || inCall) return null

  return (
    <div
      ref={wrapperRef}
      className={`fab-wrapper${staticPosition ? ' fab-wrapper--static' : ''}`}
      style={
        staticPosition
          ? undefined
          : {
              position: 'fixed',
              left: pos.x || undefined,
              top: pos.y || undefined,
            }
      }
    >
      {/* Drag handle — visible grab point for repositioning */}
      {!staticPosition && (
        <div
          className="fab-drag-handle"
          onPointerDown={handleDragStart}
          title="拖动移动位置"
        >
          <span className="drag-dots">
            <i /><i /><i />
          </span>
        </div>
      )}

      {/* Video call button */}
      <button
        className="fab fab-video"
        onClick={() => {
          if (!staticPosition && movedRef.current) { movedRef.current = false; return }
          onStartCall()
        }}
        aria-label="视频通话"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      </button>
    </div>
  )
}
