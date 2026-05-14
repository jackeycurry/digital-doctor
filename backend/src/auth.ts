import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { User, UserProfile } from './types'

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

function readUsers(): User[] {
  if (!fs.existsSync(USERS_FILE)) return []
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
}

function writeUsers(users: User[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

export async function register(phone: string, password: string): Promise<{ success: true } | { success: false; error: string }> {
  const users = readUsers()
  if (users.find(u => u.phone === phone)) {
    return { success: false, error: '手机号已注册' }
  }
  const passwordHash = await bcrypt.hash(password, 10)
  users.push({ phone, passwordHash, createdAt: new Date().toISOString(), profile: null })
  writeUsers(users)
  return { success: true }
}

export async function login(phone: string, password: string): Promise<{ success: true; token: string; phone: string } | { success: false; error: string }> {
  const users = readUsers()
  const user = users.find(u => u.phone === phone)
  if (!user) {
    return { success: false, error: '手机号未注册' }
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: '密码错误' }
  }
  const token = Buffer.from(`${phone}:${Date.now()}`).toString('base64')
  return { success: true, token, phone }
}

const PROFILE_DEFAULTS: UserProfile = {
  name: '',
  gender: 'other',
  birthYear: 0,
  height: 0,
  weight: 0,
  bloodType: 'unknown',
  allergies: [],
  notes: '',
}

export function getUserProfile(phone: string): UserProfile | null {
  const users = readUsers()
  const user = users.find(u => u.phone === phone)
  return user?.profile ?? null
}

export function updateUserProfile(phone: string, profile: UserProfile): UserProfile {
  const users = readUsers()
  const idx = users.findIndex(u => u.phone === phone)
  if (idx === -1) throw new Error('User not found')
  users[idx].profile = profile
  writeUsers(users)
  return profile
}

export function patchUserProfile(phone: string, partial: Partial<UserProfile>): UserProfile {
  const users = readUsers()
  const idx = users.findIndex(u => u.phone === phone)
  if (idx === -1) throw new Error('User not found')
  const current = users[idx].profile ?? { ...PROFILE_DEFAULTS }
  users[idx].profile = { ...current, ...partial }
  writeUsers(users)
  return users[idx].profile!
}