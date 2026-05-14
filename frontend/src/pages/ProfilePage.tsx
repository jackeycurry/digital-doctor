import { useState, useEffect } from 'react'
import ProfileSummaryCard from '../components/ProfileSummaryCard'
import AllergyList, { type AllergyItem } from '../components/AllergyList'

interface UserProfile {
  name: string
  gender: 'male' | 'female' | 'other'
  birthYear: number
  height: number
  weight: number
  bloodType: 'A' | 'B' | 'AB' | 'O' | 'unknown'
  allergies: AllergyItem[]
  notes: string
}

const EMPTY_PROFILE: UserProfile = {
  name: '',
  gender: 'other',
  birthYear: 0,
  height: 0,
  weight: 0,
  bloodType: 'unknown',
  allergies: [],
  notes: '',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('dd_auth')
    if (!savedAuth) return
    const token = JSON.parse(savedAuth).token

    fetch('/api/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          setProfile({
            ...EMPTY_PROFILE,
            ...data.profile,
            allergies: data.profile.allergies ?? [],
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const savedAuth = sessionStorage.getItem('dd_auth')
    if (!savedAuth) return
    const token = JSON.parse(savedAuth).token

    setSaving(true)
    setSaved(false)
    try {
      const resp = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      })
      if (resp.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="profile-loading">加载中...</div>
  }

  return (
    <div className="profile-page">
      <ProfileSummaryCard
        name={profile.name}
        gender={profile.gender}
        birthYear={profile.birthYear}
        height={profile.height}
        weight={profile.weight}
        bloodType={profile.bloodType}
      />

      <div className="profile-section">
        <h3 className="profile-section-title">基本信息</h3>
        <div className="profile-form-grid">
          <label className="profile-field">
            <span>姓名</span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="选填"
            />
          </label>
          <label className="profile-field">
            <span>性别</span>
            <div className="profile-radio-group">
              {(['male', 'female', 'other'] as const).map(g => (
                <label key={g}>
                  <input
                    type="radio"
                    name="gender"
                    checked={profile.gender === g}
                    onChange={() => setProfile({ ...profile, gender: g })}
                  />
                  {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
                </label>
              ))}
            </div>
          </label>
          <label className="profile-field">
            <span>出生年份</span>
            <input
              type="number"
              value={profile.birthYear || ''}
              onChange={(e) => setProfile({ ...profile, birthYear: parseInt(e.target.value) || 0 })}
              placeholder="如：1990"
              min="1900"
              max="2099"
            />
          </label>
          <label className="profile-field">
            <span>身高 (cm)</span>
            <input
              type="number"
              value={profile.height || ''}
              onChange={(e) => setProfile({ ...profile, height: parseInt(e.target.value) || 0 })}
              placeholder="如：175"
              min="50"
              max="250"
            />
          </label>
          <label className="profile-field">
            <span>体重 (kg)</span>
            <input
              type="number"
              value={profile.weight || ''}
              onChange={(e) => setProfile({ ...profile, weight: parseInt(e.target.value) || 0 })}
              placeholder="如：70"
              min="20"
              max="300"
            />
          </label>
          <label className="profile-field">
            <span>血型</span>
            <select
              value={profile.bloodType}
              onChange={(e) => setProfile({ ...profile, bloodType: e.target.value as UserProfile['bloodType'] })}
            >
              <option value="unknown">未知</option>
              <option value="A">A型</option>
              <option value="B">B型</option>
              <option value="AB">AB型</option>
              <option value="O">O型</option>
            </select>
          </label>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">过敏史</h3>
        <AllergyList
          value={profile.allergies}
          onChange={(allergies) => setProfile({ ...profile, allergies })}
        />
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">档案备注</h3>
        <textarea
          className="profile-notes"
          value={profile.notes}
          onChange={(e) => setProfile({ ...profile, notes: e.target.value.slice(0, 500) })}
          placeholder="如职业、居住地、特殊习惯等，AI医生会参考这些信息"
          maxLength={500}
          rows={4}
        />
        <div className="profile-notes-count">{profile.notes.length}/500</div>
      </div>

      <div className="profile-save-row">
        {saved && <span className="profile-saved-msg">已保存</span>}
        <button className="profile-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存档案'}
        </button>
      </div>
    </div>
  )
}