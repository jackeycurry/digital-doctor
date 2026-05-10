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

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}
