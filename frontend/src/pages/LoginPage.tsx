import { useState } from 'react'
import './LoginPage.css'

interface Props {
  onLogin: (phone: string, token: string) => void
  onGoRegister: () => void
}

const PHONE_REG = /^1[3-9]\d{9}$/

export default function LoginPage({ onLogin, onGoRegister }: Props) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登录失败')
      } else {
        onLogin(data.phone, data.token)
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 检查是否有注册成功提示
  const isRegistered = new URLSearchParams(window.location.search).has('registered')
  // 清除 URL 参数
  if (isRegistered) {
    window.history.replaceState({}, '', '/login')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">小云医生 · AI健康助手</h1>

        {isRegistered && (
          <div className="auth-success">注册成功，请登录</div>
        )}

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
              type={showPassword ? 'text' : 'password'}
              className="auth-input"
              placeholder="请输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="auth-footer">
          还没有账号？<button className="auth-link" onClick={onGoRegister}>立即注册 →</button>
        </div>
      </div>
    </div>
  )
}