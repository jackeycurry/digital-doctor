# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

小云医生 (Digital Doctor) — 河南人工智能大健康研究院研发的 AI 数字人医生系统，支持文字问诊、语音通话、视频问诊和 3D 数字人实时互动。

- **前端**: React 18 + TypeScript + Three.js (@react-three/fiber) + Vite（HTTPS 端口 5173）
- **后端**: Express 4 + WebSocket (ws) + TypeScript（默认端口 3001）
- **AI 服务**: 阿里云百炼（qwen-plus 文字对话、qwen-omni 实时语音）+ 讯飞（STT/TTS via WebSocket）

## 常用命令

```bash
# 安装所有依赖
npm run install:all

# 开发（需两个终端）
npm run dev:backend   # 后端: tsx watch 模式，端口 3001
npm run dev:frontend  # 前端: Vite HTTPS，端口 5173

# 构建生产版本
npm run build         # 前端打包到 frontend/dist/
cd backend && npm run build  # 后端 TypeScript 编译
```

## 架构

```
浏览器 (React)            后端 (Express)              外部 API
    │                          │                        │
    │──HTTPS/WebSocket────────►│                        │
    │                          │───HTTP SSE───────────►│ 百炼 qwen-plus
    │                          │   /api/chat             │
    │                          │                        │
    │                          │───WebSocket──────────►│ 讯飞 tts-api.xfyun.cn
    │                          │   /api/tts, /api/stt   │ (STT/TTS)
    │                          │                        │
    │                          │───WebSocket──────────►│ 百炼 qwen-omni
    │◄──WebSocket──────────────│   /ws                  │ (实时语音)
    │    /ws (audio_chunk,      │   PCM16↔PCM24          │
    │     response_audio)       │   VAD + 文本 + 音频   │
```

**重要**: 后端默认端口 3001，但 `frontend/vite.config.ts` 代理目标为 `localhost:3002`。如遇 API 代理失败，检查两边端口是否一致。

## 关键源文件

### 后端 (`backend/src/`)
- `server.ts` — HTTP 服务器、REST 端点 (`/api/chat`, `/api/tts`, `/api/stt`)、WebSocket 升级
- `wsHandler.ts` — WebSocket 连接处理，消息路由到 RealtimeSession
- `services/realtime.ts` — 百炼 Realtime API WebSocket 客户端（语音/视频）
- `config.ts` — 环境变量读取（端口、API keys）

### 前端 (`frontend/src/`)
- `App.tsx` — 主组件，WebSocket 消息处理、状态编排
- `components/DigitalHuman.tsx` — 3D 数字人渲染（GLB 模型 + 程序化备用）
- `components/ChatInterface.tsx` — 文字聊天面板，SSE 流式
- `hooks/useWebSocket.ts` — WebSocket 连接管理
- `hooks/useAudioCapture.ts` — 麦克风 PCM 采集（AudioWorklet）
- `hooks/useStreamingAudio.ts` — 音频流播放队列（带 analyser node）
- `utils/lipSync.ts` — Blend shape 权重计算（从音频频率驱动唇形）

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ws` | WebSocket | 实时语音/视频对话 |
| `/api/chat` | POST | 文字问诊（SSE 流式） |
| `/api/tts` | POST | 文字转语音（返回 MP3） |
| `/api/stt` | POST | 语音转文字（接收 base64 音频） |
| `/health` | GET | 健康检查 |

## WebSocket 消息协议

**客户端 → 服务端**: `start_conversation`, `stop_conversation`, `audio_chunk`, `text_input`, `start_video_call`, `stop_video_call`, `video_frame`

**服务端 → 客户端**: `status` (idle/listening/thinking/speaking), `user_transcript`, `response_text_delta`, `response_audio_delta`, `response_done`, `error`

## 配置

### 后端 (`backend/.env`)
```
PORT=3001
DASHSCOPE_API_KEY=sk-your_key          # 阿里云百炼 API Key
REALTIME_MODEL=qwen3.5-omni-plus-realtime
REALTIME_VOICE=Cherry                  # 音色: Cherry/Tina/longxiaochun/longanyang
IFLYTEK_APP_ID=your_app_id             # 讯飞语音识别/合成
IFLYTEK_API_KEY=your_api_key
IFLYTEK_API_SECRET=your_secret
```

### 前端 (`frontend/.env`)
- `VITE_WS_URL` — WebSocket URL（开发环境默认走 Vite 代理）

## 3D 模型

放置 GLB 模型到 `frontend/public/models/doctor.glb`。支持 ARKit blend shapes（jawOpen、mouthSmile、mouthFunnel）实现唇形同步。无模型时自动回退到程序化形象。
