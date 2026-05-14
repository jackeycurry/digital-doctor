interface ChatSidebarProps {
  activeNav: 'chat' | 'history' | 'profile'
  onNavChange: (nav: 'chat' | 'history' | 'profile') => void
}

function getInitials(phone: string) {
  // 从手机号提取尾号作为显示名
  return phone.slice(-4)
}

export default function ChatSidebar({ activeNav, onNavChange }: ChatSidebarProps) {
  const saved = sessionStorage.getItem('dd_auth')
  const user = saved ? JSON.parse(saved) : null
  const phone = user?.phone || '未登录'
  const displayName = phone === '未登录' ? phone : `用户${phone.slice(-4)}`

  const handleLogout = () => {
    sessionStorage.removeItem('dd_auth')
    window.location.reload()
  }

  return (
    <aside className="nav-sidebar">
      <div className="nav-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="url(#grad)" />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f09668" />
              <stop offset="100%" stopColor="#e07b50" />
            </linearGradient>
          </defs>
          <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <nav className="nav-menu">
        <button
          className={`nav-item ${activeNav === 'chat' ? 'active' : ''}`}
          onClick={() => onNavChange('chat')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>AI咨询</span>
        </button>
        <button
          className={`nav-item ${activeNav === 'history' ? 'active' : ''}`}
          onClick={() => onNavChange('history')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>历史记录</span>
        </button>
        <button
          className={`nav-item ${activeNav === 'profile' ? 'active' : ''}`}
          onClick={() => onNavChange('profile')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>健康档案</span>
        </button>
      </nav>

      <div className="nav-user-profile">
        <div className="nav-user-avatar">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="url(#avatarGrad)" />
            <defs>
              <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f0a888" />
                <stop offset="100%" stopColor="#d06840" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="13" r="5" fill="white" fillOpacity="0.9" />
            <path d="M6 26c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="nav-user-status" />
        </div>
        <div className="nav-user-info">
          <span className="nav-user-name">{displayName}</span>
          <span className="nav-user-status-text">在线</span>
        </div>
        <button className="nav-logout-btn" onClick={handleLogout} title="退出登录">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}