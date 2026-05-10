import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    realtimeModel: process.env.REALTIME_MODEL || 'qwen3.5-omni-plus-realtime',
    realtimeEndpoint: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
    realtimeVoice: process.env.REALTIME_VOICE || 'Tina',
  },

  iflytek: {
    appId: process.env.IFLYTEK_APP_ID || '',
    apiKey: process.env.IFLYTEK_API_KEY || '',
    apiSecret: process.env.IFLYTEK_API_SECRET || '',
  },
}
