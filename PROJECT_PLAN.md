# 同声传译助手 - 项目规划

## 一、项目概述

### 1.1 项目背景

用户经常需要观看英语（或其他外语）演讲、技术分享、国际会议或网课，本项目开发一款 AI 同声传译助手，帮助用户降低语言门槛，提升信息获取效率。

### 1.2 核心需求

通过 AI 能力，将单向音频流实时、流畅地翻译成中文，以字幕或语音形式呈现，帮助用户跟上内容节奏。系统需具备修正能力，能够自动纠正之前识别或翻译的错误。

### 1.3 核心逻辑

以唯一 ID 追踪语音流，用状态机管理识别生命周期，通过上下文窗口触发 AI 修正，最终驱动 UI 响应式更新。

---

## 二、技术架构

### 2.1 技术栈

| 模块 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3 + Vite | 响应式 UI 开发 |
| 样式 | Tailwind CSS | 快速样式开发 |
| 语音识别 | Web Speech API | 浏览器原生 ASR |
| 翻译 | MyMemory API | 免费翻译服务 |
| AI 修正 | DeepSeek API | 上下文修正 |
| 后端 | Node.js + Express | API 中转服务 |

### 2.2 项目结构

```
syncinterp/
├── src/                    # 前端源码
│   ├── App.vue            # 主应用组件
│   ├── main.js            # 入口文件
│   └── style.css          # 样式文件
├── server/                 # 后端服务
│   ├── index.js           # Express 服务器
│   └── .env               # 环境变量
├── public/                 # 静态资源
└── 配置文件                # Vite/Tailwind/PostCSS
```

---

## 三、核心模块设计

### 3.1 语音识别模块 (ASR)

**功能**：流式接收与状态切割

**核心概念**：
- **Interim（临时）**：高频触发，内容不断被自身覆盖
- **Final（最终）**：低频触发，代表引擎已确认这句话结束

**数据切割与 ID 绑定**：
```
开始说话 -> 引擎返回 Interim A -> 分配 ID: 001, 状态: interim
继续说话 -> 引擎返回 Interim A+ -> 更新 ID: 001 的原文
停顿(句号) -> 引擎返回 Final A   -> 将 ID: 001 状态改为 final
开始新话题 -> 引擎返回 Interim B -> 分配 ID: 002, 状态: interim
```

**断线重连逻辑**：
浏览器原生的 Web Speech API 有个臭名昭著的特性：静音超过 15 秒左右会自动断开。实现逻辑：在 onend 事件中，判断是否为"用户手动点击停止"。如果不是，则立即调用 recognition.start() 重新激活。

### 3.2 实时翻译模块 (MT)

**功能**：防抖与队列控制

**防抖逻辑**：
- 对于 Interim：设置一个 500ms 的定时器。每次 Interim 更新都重置定时器，只有当用户停顿 500ms 不说话时，才拿当前的 Interim 文本去请求翻译
- 对于 Final：不防抖，立即请求翻译

**状态覆盖逻辑**：
由于网络延迟，可能 Final 的翻译请求已经发出，但 Interim 的翻译请求才返回（晚发先至）。逻辑：每个翻译请求必须携带目标 ID。当请求返回时，检查该 ID 当前的状态。

### 3.3 AI 上下文纠错模块 (LLM)

**功能**：滑动窗口与重写

**问题背景**：
逐句翻译最大的问题是缺乏上下文。比如第一句 "I met Apple's CEO." 翻译为"我见了苹果的CEO"，第二句 "He said..." 逐句翻译只会翻译成"他说"，但结合上下文，更好的翻译是"苹果CEO说"。

**滑动窗口逻辑**：
维护一个"上下文窗口"（最近 3 句话）。当第 3 句话 Final 确认时，把第 1、2、3 句打包发给 LLM。

**Prompt 构造**：
```
你是一个同声传译修正助手。请根据上下文，修正以下中英对照翻译，解决代词指代不明和语意断层问题。

历史记录：
[1] 原文: I met Apple's CEO. | 旧译文: 我见了苹果的CEO。
[2] 原文: He said they will release a new phone. | 旧译文: 他说他们将发布新手机。
当前句：
[3] 原文: It will be amazing. | 旧译文: 它会很棒的。

请输出修正后的 JSON 数组：
```

**Diff 更新逻辑**：
- 如果 旧译文 === 新译文：不做任何操作
- 如果 旧译文 !== 新译文：更新数据模型中的译文，将状态改为 corrected

### 3.4 语音合成模块 (TTS)

**功能**：队列与打断

**队列管理**：
浏览器的 speechSynthesis.speak() 天然是一个队列。但我们不希望积压太多旧语音。

**打断逻辑**：
如果用户已经开始说下一句话（产生了新的 Interim），此时上一句的 TTS 还在朗读，应该调用 speechSynthesis.cancel() 清空队列，优先保证字幕和声音的同步。

### 3.5 UI 渲染模块

**功能**：数据驱动与响应式更新

**核心数据模型**：
```javascript
subtitleList = [
  { id: 1, original: "...", translation: "...", status: "final" },
  { id: 2, original: "...", translation: "...", status: "corrected" }
]
// status: 'interim' | 'final' | 'corrected'
```

**高效更新策略**：
- Interim 更新时，只定位到当前行 DOM，修改其 innerText
- 新增 Final 时，往数组 push 新对象，列表底部追加新 DOM 节点，并自动滚动到底部
- AI 修正发生时，通过 ID 找到对应 DOM，替换译文节点内容，并添加 CSS 动画类名

---

## 四、数据流向图

```
┌─────────────────────────────────────────────────────────────────┐
│                      麦克风音频流                                  │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ASR 引擎                                    │
└───────┬──────────────────────────────┬───────────────────────────┘
        │                              │
        ▼                              ▼
┌───────────────────────┐    ┌───────────────────────┐
│   Interim 结果         │    │    Final 结果         │
│   (状态机: 临时ID)     │    │    (状态机: 锁定ID)   │
└───────┬───────────────┘    └───────┬───────────────┘
        │                              │
        ▼                              │
┌───────────────────────┐              │
│   防抖 500ms          │              │
└───────┬───────────────┘              │
        ▼                              ▼
┌───────────────────────┐    ┌───────────────────────┐
│   调用翻译 API        │    │   调用翻译 API        │
│   (立即)              │    │   (立即)              │
└───────┬───────────────┘    └───────┬───────────────┘
        │                              │
        ▼                              │
┌───────────────────────┐              │
│   UI: 更新当前行       │              │
│   (灰色临时字幕)       │              │
└───────────────────────┘              ▼
                           ┌───────────────────────┐
                           │   字幕变白确认         │
                           └───────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                              │
                    ▼                              ▼
           ┌───────────────────┐        ┌───────────────────┐
           │  触发上下文窗口    │        │  触发 TTS        │
           │  (最近3句)        │        │  (语音合成)      │
           └───────┬───────────┘        └───────┬───────────┘
                   │                              │
                   ▼                              ▼
           ┌───────────────────┐        ┌───────────────────┐
           │  调用 LLM 修正 API │        │  扬声器输出       │
           └───────┬───────────┘        └───────────────────┘
                   │
                   ▼
           ┌───────────────────┐
           │  Diff 比对         │
           └───────┬───────────┘
                   │
          ┌────────┴────────┐
          │ 有差异?          │
          └────────┬────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
     ┌─────────┐       ┌─────────┐
     │  更新   │       │  无操作 │
     │  数据   │       │         │
     └────┬────┘       └─────────┘
          │
          ▼
     ┌─────────┐
     │ UI 高亮 │
     │ 动画    │
     └─────────┘
```

---

## 五、MVP 开发计划

### Day 1：跑通 MVP（最小可行性产品）

**目标**：实现从麦克风输入到屏幕显示中文字幕的基础链路

#### 上午：项目初始化与语音流接入

**1. 初始化项目**
```bash
npm create vite@latest syncinterp -- --template vue
cd syncinterp
npm install tailwindcss @tailwindcss/postcss autoprefixer lodash
npx tailwindcss init -p
```

**2. 配置文件**

**tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**postcss.config.js**
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

**src/style.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  min-height: 100vh;
}
```

**3. 核心数据模型**
```javascript
const subtitleList = ref([]); // { id, original, translation, status }
// status: 'interim' | 'final' | 'corrected'
```

**4. 语音识别模块**
- 接入 Web Speech API
- 开启 `continuous: true` 和 `interimResults: true`
- 实现 interim 和 final 状态区分
- 添加静音自动重连逻辑（onend 事件中延迟 200ms 重启）

#### 下午：接入基础翻译与界面渲染

**5. 接入 MyMemory 翻译 API**
```javascript
const translateText = async (text, id) => {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
  );
  const data = await response.json();
  return data.responseData?.translatedText || '';
};
```

**6. UI 界面搭建**
- 深色主题设计
- 实时滚动字幕区
- 开始/停止控制按钮
- 原文（灰色）和译文（白色）上下排列

**7. 串联逻辑**
- final 确认时调用翻译
- 翻译结果更新响应式数据
- 自动滚动到底部

**✅ Day 1 验收标准**：
点击开始，对着麦克风说英语，屏幕上能实时出现英文，停顿后能出现中文翻译。

---

### Day 2：注入灵魂 —— AI 上下文修正与状态管理

**目标**：实现核心的 AI 上下文修正能力，让翻译具备连贯性

#### 上午：搭建 Node 中转服务器

**1. 初始化后端项目**
```bash
mkdir server
cd server
npm init -y
npm install express cors axios dotenv
```

**2. 创建 server/index.js**
```javascript
import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/correct', async (req, res) => {
  const { subtitles } = req.body;
  
  // 构造 Prompt
  const prompt = buildCorrectionPrompt(subtitles);
  
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个同声传译修正助手。请根据上下文，修正以下中英对照翻译，解决代词指代不明和语意断层问题。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': 'Bearer YOUR_DEEPSEEK_API_KEY',
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: '修正失败' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**3. 构建 Prompt**
```javascript
const buildCorrectionPrompt = (subtitles) => {
  let prompt = '历史记录：\n';
  subtitles.forEach((sub, index) => {
    prompt += `[${index + 1}] 原文: ${sub.original} | 旧译文: ${sub.translation}\n`;
  });
  prompt += '\n请输出修正后的 JSON 数组：';
  return prompt;
};
```

#### 下午：前端滑动窗口与 Diff 更新

**4. 实现滑动窗口**
```javascript
// 监听 final 状态，截取最后 3 句
const triggerCorrection = () => {
  if (subtitleList.value.length >= 3) {
    const window = subtitleList.value.slice(-3);
    correctSubtitles(window);
  }
};
```

**5. Diff 更新逻辑**
```javascript
const applyCorrections = (corrections) => {
  corrections.forEach(corrected => {
    const item = subtitleList.value.find(s => s.id === corrected.id);
    if (item && item.translation !== corrected.translation) {
      item.translation = corrected.translation;
      item.status = 'corrected';
    }
  });
};
```

**6. UI 修正反馈**
- 修正状态显示淡黄色背景闪烁动画
- 添加「🔄 AI修正」Tag 标记

**✅ Day 2 验收标准**：
连续说三句有关联的话（如 "I met Tim Cook." -> "He is nice."），第二句的翻译能从"他很好"被 AI 主动修正为"Tim Cook很好"，且界面上有明显的修正动画提示。

---

### Day 3：锦上添花 —— 体验优化与防崩处理

**目标**：让项目从"能跑"变成"好用且炫酷"，处理各种边界情况

#### 上午：防抖控制与语音合成 (TTS)

**1. Interim 翻译防抖**
```javascript
import { debounce } from 'lodash';

const debouncedTranslate = debounce((text, id) => {
  translateText(text, id);
}, 500);
```

**2. 接入 Web SpeechSynthesis**
```javascript
const speakText = (text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  
  // 优化：如果积压超过 3 句，清空队列
  if (speechSynthesis.getVoices().length > 3) {
    speechSynthesis.cancel();
  }
  
  speechSynthesis.speak(utterance);
};
```

#### 下午：UI 美化与异常兜底

**3. 界面优化**
- 添加麦克风音波动画效果
- 细化状态样式区分
  - interim: 灰色斜体 + 闪烁光标
  - final: 白色
  - corrected: 高亮样式
- 优化移动端适配

**4. 异常处理**
- 麦克风权限拒绝友好提示
- API 错误处理（显示"网络超时"）
- 添加手动输入框兜底

**✅ Day 3 验收标准**：
整个系统丝滑流畅，无多余请求，语音朗读跟手，界面专业，强行断网或拒绝权限也不会白屏。

---

## 六、关键开发提示

### 6.1 Web Speech API 坑点

Chrome 中如果没有真正在麦克风前发出声音，onend 会频繁触发。重连逻辑必须加上适当的延迟（如 200ms），否则会死循环卡死浏览器。

**错误示例**：
```javascript
recognition.onend = () => {
  if (isListening.value) {
    recognition.start(); // 可能导致死循环
  }
};
```

**正确示例**：
```javascript
recognition.onend = () => {
  if (isListening.value) {
    setTimeout(() => {
      if (isListening.value) {
        recognition.start();
      }
    }, 200); // 延迟 200ms
  }
};
```

### 6.2 LLM 返回格式不可控

DeepSeek 开启 JSON Mode 后偶尔还会带点废话。前端解析时一定要 try...catch，可以用正则提取核心数组防崩溃。

**健壮的解析逻辑**：
```javascript
const extractJSONArray = (text) => {
  // 移除 markdown 代码块标记
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 尝试正则提取
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
};
```

### 6.3 字幕滚动体验

不要用整个页面滚动，字幕区必须设置固定高度 `overflow-y-auto`，数据更新后调用滚动方法。

```javascript
nextTick(() => {
  const container = document.getElementById('subtitle-container');
  if (container) {
    container.scrollTo({ 
      top: container.scrollHeight, 
      behavior: 'smooth' 
    });
  }
});
```

### 6.4 API 配额限制

MyMemory API 有每日请求限制，建议：
- 添加 API Key 支持（提升配额）
- 实现翻译缓存机制
- 添加配额耗尽提示

---

## 七、验收清单

### 功能验收

- [ ] 语音识别正常启动和停止
- [ ] Interim 结果实时显示
- [ ] Final 结果翻译准确
- [ ] 翻译缓存正常工作
- [ ] AI 上下文修正生效
- [ ] TTS 语音朗读正常
- [ ] 手动输入翻译功能正常
- [ ] 异常处理友好

### 体验验收

- [ ] 界面美观专业
- [ ] 状态区分清晰
- [ ] 动画流畅自然
- [ ] 滚动体验顺畅
- [ ] 响应速度快

### 稳定性验收

- [ ] 长时间运行无崩溃
- [ ] 网络异常处理得当
- [ ] 权限拒绝友好提示
- [ ] 无内存泄漏

---

## 八、后续优化方向

1. **多语言支持**：扩展支持日语、韩语等其他语言
2. **历史记录**：保存和导出翻译历史
3. **个性化设置**：主题切换、语速调节
4. **性能优化**：虚拟滚动支持大量字幕
5. **离线支持**：Service Worker 实现离线翻译
6. **部署优化**：Docker 容器化部署
