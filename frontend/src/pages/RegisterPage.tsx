import { useState } from 'react'
import './RegisterPage.css'

interface Props {
  onSuccess: () => void
  onBack: () => void
}

const PHONE_REG = /^1[3-9]\d{9}$/

export default function RegisterPage({ onSuccess, onBack }: Props) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!PHONE_REG.test(phone)) {
      setError('请输入正确的11位手机号')
      return
    }
    if (password.length < 6) {
      setError('密码至少6位')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '注册失败')
      } else {
        onSuccess()
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button className="auth-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回登录
        </button>

        <h1 className="auth-title">注册账号</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <input
              type="tel"
              className="auth-input"
              placeholder="请输入手机号"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={11}
              autoComplete="tel"
            />
          </div>

          <div className="auth-field">
            <input
              type="password"
              className="auth-input"
              placeholder="请设置登录密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>
      </div>
    </div>
  )
}