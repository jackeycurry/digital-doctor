import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

export interface User {
  phone: string
  passwordHash: string
  createdAt: string
}

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
  users.push({ phone, passwordHash, createdAt: new Date().toISOString() })
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