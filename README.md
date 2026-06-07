# 同声传译助手

一款基于 AI 的实时语音翻译工具，帮助您降低语言门槛，提升信息获取效率。

## 演示视频

### 在线观看
[点击观看演示视频](https://www.bilibili.com/video/BV12FEb66E8Q/?vd_source=213506e1f9d641218bb3f0650381ada7)

### 本地观看
项目根目录已包含演示视频文件：
- 文件名：`同声传译助手syncinterp演示视频.mp4`
- 位置：项目根目录

您可以直接使用视频播放器打开该文件观看演示。

## 功能特点

- 🎤 **实时语音识别** - 通过 Web Speech API 实时识别语音
- 🌐 **双模式翻译** - 支持 AI 翻译模式（DeepSeek）和常规翻译模式（MyMemory）
- 📝 **实时字幕** - 支持 interim（临时）和 final（最终）两种状态
- 🎨 **极简界面** - 浅色主题、状态区分、流畅动画
- 🔊 **语音合成** - Web SpeechSynthesis 自动朗读翻译结果
- 📚 **历史记录** - 保存所有翻译历史，随时查看
- ⌨️ **手动输入** - 支持手动输入文本进行翻译
- 🛡️ **异常处理** - 权限拒绝、网络超时友好提示

## 技术栈

- **前端框架**: Vue 3 + Vite
- **样式**: Tailwind CSS
- **语音识别**: Web Speech API
- **翻译**: MyMemory API / DeepSeek API
- **后端**: Node.js + Express

## 快速开始

### 一键启动（推荐）

```bash
# 赋予执行权限（首次运行）
chmod +x start.sh

# 启动项目
./start.sh
```

启动脚本会自动：
- 检测并配置 DeepSeek API Key
- 安装前后端依赖
- 同时启动前端和后端服务

访问地址：
- 前端: http://localhost:5173
- 后端: http://localhost:3000

### 手动启动

#### 前端

```bash
npm install
npm run dev
```

#### 后端

```bash
cd server
npm install
npm start
```

## 配置 API Key

### DeepSeek API Key（AI 翻译功能）

**重要：请勿将 API Key 硬编码或提交到 Git！**

#### 方式 1：环境变量（推荐）

```bash
# 永久设置（推荐）
echo 'export DEEPSEEK_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc

# 临时设置（当前会话有效）
export DEEPSEEK_API_KEY=your_api_key_here
```

#### 方式 2：启动脚本引导

运行 `./start.sh` 时，如果未检测到环境变量，会引导您选择配置方式：
1. 临时设置（本次会话有效）
2. 永久设置（添加到 ~/.bashrc）

#### 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com/
2. 注册并登录账户
3. 在 API Keys 管理页面生成新的 Key

## 环境变量说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key（必填） | - |
| `PORT` | 服务器端口 | `3000` |
| `DEEPSEEK_API_URL` | API 地址 | `https://api.deepseek.com/v1/chat/completions` |
| `DEEPSEEK_MODEL` | 使用的模型 | `deepseek-chat` |
| `TIMEOUT` | 请求超时时间（毫秒） | `30000` |
| `TEMPERATURE` | 温度参数 | `0.1` |
| `MAX_TOKENS` | 最大输出token | `500` |

## 使用说明

1. 点击顶部「开始」按钮，允许浏览器访问麦克风
2. 选择翻译模式：AI翻译模式（推荐）或常规翻译模式
3. 开始说话，屏幕上会实时显示识别的原文和译文
4. 停顿后会自动确认翻译并朗读
5. 点击「历史记录」按钮查看所有翻译历史
6. 也可使用手动输入框输入文本进行翻译

## 项目结构

```
syncinterp/
├── src/
│   ├── App.vue           # 主应用组件
│   ├── main.js           # 入口文件
│   ├── style.css         # 样式文件
│   ├── components/       # 组件
│   │   ├── Header.vue    # 顶部控制栏
│   │   ├── MainContent.vue # 主体内容区
│   │   ├── SubtitleCard.vue # 字幕卡片
│   │   ├── HistoryPanel.vue # 历史记录面板
│   │   ├── ManualInput.vue # 手动输入组件
│   │   └── ErrorAlert.vue # 错误提示组件
│   ├── composables/      # Vue composables
│   │   ├── useSpeechRecognition.js # 语音识别
│   │   ├── useTranslation.js # 翻译
│   │   ├── useSpeechSynthesis.js # 语音合成
│   │   ├── useHistoryAndCorrection.js # 历史记录和AI修正
│   │   └── useTimer.js # 计时器
│   └── services/        # 服务
│       └── subtitleService.js # 字幕管理服务
├── server/
│   ├── index.js          # 后端服务器
│   └── package.json      # 后端依赖
├── public/               # 静态资源
├── start.sh              # 一键启动脚本
├── package.json          # 前端依赖
├── vite.config.js        # Vite 配置
├── tailwind.config.js    # Tailwind CSS 配置
├── PROJECT_PLAN.md       # 项目规划
└── README.md             # 说明文档
```

## 浏览器兼容性

推荐使用 **Chrome 浏览器**，因为 Web Speech API 在 Chrome 中支持最好。

## License

MIT
