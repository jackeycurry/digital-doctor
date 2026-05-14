import { useState } from 'react'

export interface AllergyItem {
  allergen: string
  severity: 'mild' | 'moderate' | 'severe'
}

interface AllergyListProps {
  value: AllergyItem[]
  onChange: (items: AllergyItem[]) => void
}

export default function AllergyList({ value, onChange }: AllergyListProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  const addItem = () => {
    onChange([...value, { allergen: '', severity: 'moderate' }])
    setEditingIdx(value.length)
  }

  const removeItem = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
    setEditingIdx(null)
  }

  const updateItem = (idx: number, field: 'allergen' | 'severity', val: string) => {
    const updated = value.map((item, i) =>
      i === idx ? { ...item, [field]: field === 'severity' ? val as AllergyItem['severity'] : val } : item
    )
    onChange(updated)
  }

  return (
    <div className="allergy-list">
      {value.map((item, idx) => (
        <div key={idx} className="allergy-item">
          <input
            type="text"
            className="allergy-name-input"
            value={item.allergen}
            placeholder="过敏原（如：青霉素）"
            onChange={(e) => updateItem(idx, 'allergen', e.target.value)}
          />
          <div className="allergy-severity">
            {(['mild', 'moderate', 'severe'] as const).map((s) => (
              <label key={s} className={`severity-${s}`}>
                <input
                  type="radio"
                  name={`severity-${idx}`}
                  checked={item.severity === s}
                  onChange={() => updateItem(idx, 'severity', s)}
                />
                {s === 'mild' ? '轻' : s === 'moderate' ? '中' : '重'}
              </label>
            ))}
          </div>
          <button className="allergy-remove-btn" onClick={() => removeItem(idx)}>删除</button>
        </div>
      ))}
      <button className="allergy-add-btn" onClick={addItem}>+ 添加过敏项</button>
    </div>
  )
}