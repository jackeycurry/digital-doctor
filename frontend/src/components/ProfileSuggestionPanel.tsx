import { useState } from 'react'

interface SuggestionPanelProps {
  suggestion: string | null
  onApply: (text: string) => void
  onDismiss: () => void
}

export default function ProfileSuggestionPanel({ suggestion, onApply, onDismiss }: SuggestionPanelProps) {
  const [applying, setApplying] = useState(false)

  if (!suggestion) return null

  const handleApply = async () => {
    setApplying(true)
    await onApply(suggestion)
    setApplying(false)
  }

  return (
    <div className="suggestion-panel">
      <div className="suggestion-header">
        <span>健康更新建议</span>
        <button className="suggestion-close" onClick={onDismiss}>×</button>
      </div>
      <div className="suggestion-body">
        <p className="suggestion-text">{suggestion}</p>
      </div>
      <div className="suggestion-actions">
        <button className="suggestion-apply-btn" onClick={handleApply} disabled={applying}>
          {applying ? '应用中...' : '采纳建议'}
        </button>
        <button className="suggestion-dismiss-btn" onClick={onDismiss}>忽略</button>
      </div>
    </div>
  )
}
