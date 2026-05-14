export interface Allergy {
  allergen: string
  severity: 'mild' | 'moderate' | 'severe'
}

export interface UserProfile {
  name: string
  gender: 'male' | 'female' | 'other'
  birthYear: number
  height: number
  weight: number
  bloodType: 'A' | 'B' | 'AB' | 'O' | 'unknown'
  allergies: Allergy[]
  notes: string
}

export interface User {
  phone: string
  passwordHash: string
  createdAt: string
  profile: UserProfile | null
}

export type ClientMessage =
  | { type: 'start_conversation' }
  | { type: 'stop_conversation' }
  | { type: 'audio_chunk'; data: string }
  | { type: 'text_input'; text: string }
  | { type: 'video_frame'; data: string }
  | { type: 'start_video_call' }
  | { type: 'stop_video_call' }

export type ServerMessage =
  | { type: 'status'; state: DialogState }
  | { type: 'user_transcript'; text: string }
  | { type: 'response_text_delta'; text: string }
  | { type: 'response_audio_delta'; data: string }
  | { type: 'response_done' }
  | { type: 'error'; message: string }
  | { type: 'video_observation'; text: string }

export type DialogState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'disconnected'
