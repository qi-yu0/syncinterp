# 同声传译助手

一款基于 AI 的实时语音翻译工具，帮助您降低语言门槛，提升信息获取效率。

## 功能特点

- 🎤 **实时语音识别** - 通过 Web Speech API 实时识别英语语音
- 🌐 **即时翻译** - MyMemory API 提供高质量英译中
- 🤖 **AI 上下文修正** - DeepSeek API 智能修正代词指代问题
- 🔊 **语音合成** - Web SpeechSynthesis 自动朗读翻译结果
- 📝 **实时字幕** - 支持 interim（临时）和 final（最终）两种状态
- 🎨 **精美界面** - 深色主题、状态区分、音波动画
- 🔄 **翻译缓存** - 减少 API 请求，提升响应速度
- 🛡️ **异常处理** - 权限拒绝、网络超时友好提示

## 技术栈

- **前端框架**: Vue 3 + Vite
- **样式**: Tailwind CSS
- **语音识别**: Web Speech API
- **翻译**: MyMemory API
- **AI 修正**: DeepSeek API
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

### DeepSeek API Key（AI 修正功能）

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

#### 方式 3：.env 文件

```bash
# 复制模板
cp server/.env.example server/.env

# 编辑 .env（API Key 留空，从环境变量读取）
nano server/.env
```

`.env` 文件内容：
```bash
DEEPSEEK_API_KEY=
PORT=3000
```

#### 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com/
2. 注册并登录账户
3. 在 API Keys 管理页面生成新的 Key

### MyMemory API Key（可选）

访问 https://mymemory.translated.net/doc/key.php 获取免费 API Key，可提升翻译配额。在应用界面中直接输入即可。

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

1. 点击「开始」按钮，允许浏览器访问麦克风
2. 开始说英语，屏幕上会实时显示识别的英文和中文翻译
3. 停顿后会自动确认翻译并朗读
4. 说满三句后，AI 会根据上下文自动修正翻译
5. 点击字幕可以重复播放语音
6. 也可使用手动输入框输入英文进行翻译

## 项目结构

```
syncinterp/
├── src/
│   ├── App.vue           # 主应用组件
│   ├── main.js           # 入口文件
│   └── style.css         # 样式文件
├── server/
│   ├── index.js          # 后端服务器
│   ├── .env.example      # 环境变量配置模板
│   └── .env              # 环境变量配置（不提交到Git）
├── public/               # 静态资源
├── start.sh              # 一键启动脚本
├── package.json          # 前端依赖
├── vite.config.js        # Vite 配置
└── tailwind.config.js    # Tailwind CSS 配置
```

## 浏览器兼容性

推荐使用 **Chrome 浏览器**，因为 Web Speech API 在 Chrome 中支持最好。

## License

MIT