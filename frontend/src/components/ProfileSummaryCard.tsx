interface ProfileSummaryCardProps {
  name: string
  gender: string
  birthYear: number
  height: number
  weight: number
  bloodType: string
}

function calcAge(birthYear: number): number {
  if (!birthYear) return 0
  return new Date().getFullYear() - birthYear
}

export default function ProfileSummaryCard({ name, gender, birthYear, height, weight, bloodType }: ProfileSummaryCardProps) {
  const genderText = gender === 'male' ? '男' : gender === 'female' ? '女' : '其他'
  const bloodTypeText = bloodType === 'unknown' ? '未知' : `${bloodType}型`
  const age = calcAge(birthYear)

  return (
    <div className="profile-summary-card">
      <div className="profile-avatar">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="24" fill="url(#avatarGrad)" />
          <defs>
            <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0a888" />
              <stop offset="100%" stopColor="#d06840" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="19" r="7" fill="white" fillOpacity="0.9" />
          <path d="M9 39c0-8.284 6.716-15 15-15s15 6.716 15 15" stroke="white" strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="profile-summary-info">
        <span className="profile-summary-name">{name || '未设置姓名'}</span>
        <span className="profile-summary-detail">
          {age > 0 ? `${age}岁` : '年龄未知'}
          {' · '}
          {genderText}
          {' · '}
          {height > 0 ? `${height}cm` : ''}
          {height > 0 && weight > 0 ? ' · ' : ''}
          {weight > 0 ? `${weight}kg` : ''}
          {' · '}
          {bloodTypeText}
        </span>
      </div>
    </div>
  )
}