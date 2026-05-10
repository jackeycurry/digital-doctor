# 小云医生 · AI 数字人健康助手

由河南人工智能大健康研究院研发的 AI 数字人医生系统。支持文字问诊、语音通话、视频问诊，3D 数字人实时互动。

---

## 每日启动（必读）

> 以下操作每天开机后只需执行一次，两行命令即可。

### 启动服务

打开 **两个** 终端窗口，都进入项目目录：

```bash
cd D:\projects\digital-doctor\digital-doctor
```

**终端 1 — 启动后端**（不要关）：

```bash
npm run dev:backend
```

看到 `[Server] Digital Doctor backend running on http://localhost:3001` 即启动成功。

**终端 2 — 启动前端**（不要关）：

```bash
npm run dev:frontend
```

看到 `➜  Local:   https://localhost:5173/` 即启动成功。

### 打开界面

| 设备 | 地址 | 备注 |
|------|------|------|
| 电脑浏览器 | `https://localhost:5173` | 点击「高级」→「继续前往」 |
| 手机浏览器 | `https://192.168.1.147:5173` | 需与电脑连同一个 WiFi |

> 手机首次打开会提示"此连接非私人连接"：
> - **iPhone Safari**：点击「显示详细信息」→「访问此网站」
> - **Android Chrome**：点击「高级」→「继续前往（不安全）」

### 手机打不开？

Windows 防火墙可能拦截了。以**管理员身份**打开终端，执行一次即可：

```bash
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173
```

### 关闭服务

两个终端分别按 `Ctrl + C` 即可停止。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 文字问诊 | SSE 流式对话，智能引导词 + 病情追问，每条回复可语音播报 |
| 语音通话 | WebSocket 实时对话，VAD 自动检测说话起止，支持语义打断 |
| 视频问诊 | 摄像头 + 语音，AI 可观察画面辅助问诊 |
| 语音转文字 | 百炼 Paraformer ASR，聊天输入框一键语音输入 |
| 3D 数字人 | Three.js 渲染，支持 GLB 模型，唇形同步 + 呼吸微动 |
| 悬浮通话按钮 | 可拖动位置的语音/视频通话快捷入口 |

## 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **阿里云百炼 API Key**（[开通地址](https://bailian.console.aliyun.com)）
  - 需开通服务：模型调用（qwen-plus、qwen-omni）、语音合成（CosyVoice）、语音识别（Paraformer）

## 快速开始

### 1. 安装依赖

```bash
cd digital-doctor
npm run install:all
```

### 2. 配置 API Key

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入你的百炼 API Key：

```env
PORT=3001
DASHSCOPE_API_KEY=sk-你的APIKey
REALTIME_MODEL=qwen3.5-omni-plus-realtime
REALTIME_VOICE=Cherry
```

可选音色：`Cherry`（甜美女声）、`Tina`（知性女声）、`longxiaochun`（龙小春）、`longanyang`（龙小杨）等。

### 3. 启动

```bash
# 终端 1 — 后端（端口 3001）
npm run dev:backend

# 终端 2 — 前端（端口 5173）
npm run dev:frontend
```

浏览器打开 **http://localhost:5173**

## 3D 数字人模型（可选）

系统内置程序化生成的医生形象作为默认。如需更好的视觉效果，可放入 GLB 格式的 3D 模型：

1. 将 `.glb` 模型文件放到 `frontend/public/models/doctor.glb`
2. 支持带 ARKit blend shapes 的模型以实现唇形同步（自动检测 jawOpen、mouthSmile、mouthFunnel 等）
3. 模型格式要求：glTF 2.0（.glb），支持 SkinnedMesh
4. 推荐来源：
   - **Ready Player Me** — https://readyplayer.me（创建虚拟人形象 → 导出 GLB）
   - **VRoid Studio** — 免费桌面应用，可创建动漫风格角色 → 导出 VRM → 转换为 GLB
   - **Sketchfab** — 搜索 "doctor" → 筛选 Free Download → GLB 格式

模型放入后刷新页面即可自动加载，加载失败时自动回退到程序化形象。

## 项目结构

```
digital-doctor/
├── frontend/                    # React + Three.js + Vite
│   ├── src/
│   │   ├── App.tsx              # 主组件，WebSocket 消息处理
│   │   ├── App.css              # 全局样式（玻璃态 UI）
│   │   ├── types.ts             # 前后端消息类型定义
│   │   ├── components/
│   │   │   ├── DigitalHuman.tsx  # 3D 数字人渲染（GLB + 程序化备用）
│   │   │   ├── ChatInterface.tsx # 文字聊天面板
│   │   │   ├── FloatingCallButtons.tsx  # 可拖动悬浮通话按钮
│   │   │   ├── VideoCall.tsx     # 视频通话覆盖层
│   │   │   ├── TalkButton.tsx    # 通话状态按钮
│   │   │   ├── StatusIndicator.tsx     # WebSocket 连接状态
│   │   │   ├── LogPanel.tsx      # 调试日志面板
│   │   │   └── LipSyncController.tsx   # 唇形同步驱动
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts   # WebSocket 连接管理
│   │   │   ├── useAudioCapture.ts      # 麦克风 PCM 采集
│   │   │   ├── useStreamingAudio.ts    # 音频流播放队列
│   │   │   └── useStt.ts        # 语音转文字（百炼 Paraformer）
│   │   └── utils/
│   │       ├── lipSync.ts       # 唇形权重计算
│   │       └── audioUtils.ts    # PCM 音频工具
│   ├── public/
│   │   ├── models/              # 放 doctor.glb 模型文件
│   │   └── audio-processor.js   # AudioWorklet 处理器
│   └── vite.config.ts           # Vite 配置（含 API 代理）
├── backend/                     # Express + WebSocket
│   └── src/
│       ├── server.ts            # HTTP 服务（/api/chat, /api/tts, /api/stt）
│       ├── wsHandler.ts         # WebSocket 连接处理
│       ├── config.ts            # 配置读取
│       ├── types.ts             # 消息类型
│       └── services/
│           └── realtime.ts      # 百炼 Realtime API WebSocket 客户端
├── package.json                 # 根目录统一脚本
└── README.md
```

## 技术架构

```
┌──────────┐      WebSocket       ┌──────────┐      WebSocket       ┌─────────────┐
│  浏览器   │ ◄──────────────────► │  Node.js  │ ◄──────────────────► │  百炼实时API  │
│  React    │   audio_chunk        │  后端     │   PCM16 ↔ PCM24     │  qwen-omni   │
│  Three.js │   response_text      │  中继     │   VAD + 文本 + 音频  │  server_vad  │
└──────────┘   response_audio      └──────────┘                      └─────────────┘
     │                                     │
     │  HTTP SSE                           │  HTTP POST
     │  /api/chat (文字问诊)                │  /api/tts (语音合成)
     │  /api/stt  (语音识别)                │  /api/stt (语音识别)
     ▼                                     ▼
┌──────────┐                         ┌──────────┐
│  qwen-plus│                         │ CosyVoice │
│  (流式)   │                         │ Paraformer│
└──────────┘                         └──────────┘
```

**核心依赖**：

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 3D 渲染 | @react-three/fiber + @react-three/drei + Three.js |
| 构建 | Vite 5 |
| 后端 | Express 4 + ws + TypeScript |
| AI 模型 | 百炼 qwen3.5-omni-plus-realtime（实时语音） |
| 文字对话 | 百炼 qwen-plus（SSE 流式） |
| 语音合成 | 百炼 CosyVoice v3-flash（TTS 播报） |
| 语音识别 | 百炼 Paraformer v2（ASR 输入） |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ws` | WebSocket | 实时语音/视频对话 |
| `/api/chat` | POST | 文字问诊（SSE 流式） |
| `/api/tts` | POST | 文字转语音（返回 MP3） |
| `/api/stt` | POST | 语音转文字（base64 → 文本） |
| `/health` | GET | 健康检查 |

### WebSocket 消息协议

**客户端 → 服务端**：

| type | 字段 | 说明 |
|------|------|------|
| `start_conversation` | — | 开始语音对话 |
| `stop_conversation` | — | 结束语音对话 |
| `audio_chunk` | `data: string` | PCM16 base64 音频块 |
| `start_video_call` | — | 开始视频通话 |
| `stop_video_call` | — | 结束视频通话 |
| `video_frame` | `data: string` | JPEG base64 视频帧 |

**服务端 → 客户端**：

| type | 字段 | 说明 |
|------|------|------|
| `status` | `state: DialogState` | 对话状态（idle/listening/thinking/speaking） |
| `user_transcript` | `text: string` | 用户语音识别文本 |
| `response_text_delta` | `text: string` | AI 回复文本（流式增量） |
| `response_audio_delta` | `data: string` | AI 回复音频（PCM24 base64） |
| `response_done` | — | AI 回复完成 |
| `error` | `message: string` | 错误信息 |

## 打包发给同事

```bash
# 1. 打包项目（排除 node_modules、.env 等）
#    .gitignore 已配置排除敏感文件和依赖

# 2. 将整个 digital-doctor 目录复制给同事（U盘/网盘/压缩包均可）

# 3. 同事收到后：
cd digital-doctor
npm run install:all              # 安装所有依赖
cp backend/.env.example backend/.env   # 创建配置文件
# 编辑 backend/.env，填入自己的百炼 API Key

npm run dev:backend              # 终端1：启动后端
npm run dev:frontend             # 终端2：启动前端
# 打开 http://localhost:5173
```

## 常见问题

**Q: 语音通话没声音？**
- 检查浏览器麦克风权限是否已允许
- 确认百炼 API Key 已正确配置且余额充足
- 查看后端终端日志，确认 `[Realtime] Connected to DashScope` 出现
- 必须使用 HTTPS 或 localhost 才能访问麦克风

**Q: 语音转文字（麦克风按钮）不工作？**
- 系统使用百炼 Paraformer API，不依赖浏览器语音识别
- 检查后端 `/api/stt` 日志，确认 API 调用成功
- 确保浏览器已允许麦克风权限

**Q: 3D 数字人显示不正常？**
- 如未放置 GLB 模型，会显示内置程序化形象（正常）
- 若放置了模型但显示异常，检查 `frontend/public/models/doctor.glb` 是否存在
- 打开浏览器控制台查看 `[GLB]` 开头的日志

**Q: 端口被占用？**
- 后端默认 `3001`，前端默认 `5173`
- 修改 `backend/.env` 中 `PORT` 可更换后端端口（需同步修改 `frontend/vite.config.ts` 中代理目标）

**Q: 部署到服务器？**
- 前端：`cd frontend && npm run build` → 将 `dist/` 部署到 Nginx/CDN
- 后端：`cd backend && npm run build && npm start` → 使用 PM2 等进程管理
- 生产环境需配置 HTTPS（WebSocket 和麦克风均需要安全上下文）
