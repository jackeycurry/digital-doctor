interface ChatSidebarProps {
  activeNav: 'chat' | 'history'
  onNavChange: (nav: 'chat' | 'history') => void
}

export default function ChatSidebar({ activeNav, onNavChange }: ChatSidebarProps) {
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
      </nav>
    </aside>
  )
}