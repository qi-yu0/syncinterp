import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 配置常量 - 全部从环境变量读取
const CONFIG = {
  port: process.env.PORT || 3000,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
  timeout: parseInt(process.env.TIMEOUT) || 30000,
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  temperature: parseFloat(process.env.TEMPERATURE) || 0.1,
  maxTokens: parseInt(process.env.MAX_TOKENS) || 500
};

const app = express();
app.use(cors());
app.use(express.json());

// 构建 Prompt - 全面修正语音识别错误和翻译问题
const buildCorrectionPrompt = (subtitles) => {
  let prompt = `你是一个专业的同声传译修正助手。语音识别可能存在以下问题，请根据上下文进行修正：

【可能的识别错误类型】
1. 同音词错误：their/there, your/you're, it's/its, to/too/two 等
2. 漏听单词：识别遗漏了部分词汇
3. 语法错误：时态、单复数等识别不准确
4. 语义不通：识别结果在上下文中不连贯
5. 代词指代：he/she/it 等代词指代不清

【上下文句子】
`;
  subtitles.forEach((sub, index) => {
    prompt += `[${index + 1}] 英文原文: "${sub.original}"\n    中文译文: "${sub.translation}"\n`;
  });

  prompt += `
【修正要求】
1. 分析上下文，推断说话者的真实意图
2. 修正识别错误：根据语义选择正确的同音词
3. 补充漏听内容：根据上下文推断可能遗漏的词汇
4. 优化翻译：使译文更准确、自然、符合中文表达习惯
5. 保持代词指代清晰：明确 he/she/it 指代的对象

【输出格式】
- 只输出 JSON 数组，不要任何其他内容
- 不要添加 markdown 代码块标记
- 不要添加解释或说明
- 格式：[{"id":数字,"original":"修正后的英文","translation":"修正后的中文"}]
- 必须包含所有原始 ID，保持顺序不变
- 如果某句无需修正，保持原样即可

【输出示例】
[{"id":0,"original":"Their are many people","translation":"有很多人"},{"id":1,"original":"She likes it very much","translation":"她非常喜欢这个"}]`;

  return prompt;
};

// 从文本中提取 JSON 数组
const extractJSONArray = (text) => {
  // 移除 markdown 代码块标记
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // 尝试直接解析
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // 如果是对象，尝试提取数组字段
    if (parsed.corrections && Array.isArray(parsed.corrections)) {
      return parsed.corrections;
    }
    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results;
    }
  } catch (e) {
    // 直接解析失败，尝试正则提取
  }
  
  // 使用正则提取 JSON 数组
  // 匹配 [...] 或 {...}[...] 等模式
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error('正则提取的JSON解析失败:', e);
    }
  }
  
  return null;
};

// AI 修正接口
app.post('/api/correct', async (req, res) => {
  const { subtitles } = req.body;
  
  if (!subtitles || subtitles.length === 0) {
    return res.status(400).json({ error: '缺少字幕数据' });
  }
  
  // 验证 API Key
  if (!CONFIG.deepseekApiKey || CONFIG.deepseekApiKey === 'your_api_key_here') {
    return res.status(500).json({ error: '请配置有效的 DeepSeek API Key' });
  }
  
  const prompt = buildCorrectionPrompt(subtitles);
  
  try {
    const response = await axios.post(
      CONFIG.deepseekApiUrl,
      {
        model: CONFIG.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的语音识别和翻译修正助手。你的任务是分析语音识别结果，根据上下文修正识别错误（如同音词、漏听、语法错误等），并提供准确的中文翻译。只输出纯 JSON 数组，不要输出任何其他内容。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: CONFIG.temperature,
        max_tokens: CONFIG.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.timeout
      }
    );
    
    const content = response.data.choices[0].message.content;
    console.log('AI原始输出:', content);
    
    const corrections = extractJSONArray(content);
    
    if (!corrections || !Array.isArray(corrections)) {
      console.error('无法解析AI输出为JSON数组:', content);
      return res.status(500).json({ error: 'AI输出格式错误' });
    }
    
    // 验证并清理数据
    const validCorrections = corrections
      .filter(item => item && typeof item.id !== 'undefined' && typeof item.translation === 'string')
      .map(item => {
        const result = {
          id: item.id,
          translation: item.translation.trim()
        };
        // 如果有修正后的英文原文，也返回
        if (item.original && typeof item.original === 'string') {
          result.original = item.original.trim();
        }
        return result;
      });
    
    if (validCorrections.length === 0) {
      console.error('AI输出没有有效数据:', content);
      return res.status(500).json({ error: 'AI输出数据无效' });
    }
    
    res.json({ corrections: validCorrections });
  } catch (error) {
    console.error('修正失败:', error.response?.data || error.message);
    res.status(500).json({ error: '修正失败', message: error.message });
  }
});

// AI 翻译接口
app.post('/api/translate', async (req, res) => {
  const { text } = req.body;
  
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: '缺少翻译文本' });
  }
  
  // 验证 API Key
  if (!CONFIG.deepseekApiKey || CONFIG.deepseekApiKey === 'your_api_key_here') {
    return res.status(500).json({ error: '请配置有效的 DeepSeek API Key' });
  }
  
  const prompt = `请将以下英文翻译成中文，确保翻译准确、自然：

英文原文：${text}

只输出中文翻译结果，不要输出任何其他内容。`;
  
  try {
    const response = await axios.post(
      CONFIG.deepseekApiUrl,
      {
        model: CONFIG.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的翻译助手，擅长将英文翻译成准确、自然的中文。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: CONFIG.temperature,
        max_tokens: CONFIG.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.timeout
      }
    );
    
    const translation = response.data.choices[0].message.content.trim();
    console.log('AI翻译结果:', text, '→', translation);
    
    res.json({ translation });
  } catch (error) {
    console.error('AI翻译失败:', error.response?.data || error.message);
    res.status(500).json({ error: '翻译失败', message: error.message });
  }
});

// 健康检查接口
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '同声传译助手后端服务运行中',
    endpoints: {
      '/api/correct': 'POST - AI 上下文修正接口',
      '/api/translate': 'POST - AI 翻译接口'
    },
    config: {
      port: CONFIG.port,
      apiKeyConfigured: !!CONFIG.deepseekApiKey && CONFIG.deepseekApiKey !== 'your_api_key_here',
      model: CONFIG.model,
      timeout: CONFIG.timeout,
      temperature: CONFIG.temperature,
      maxTokens: CONFIG.maxTokens
    }
  });
});

// 启动服务器
app.listen(CONFIG.port, () => {
  console.log(`\n┌─────────────────────────────────────────────┐`);
  console.log(`│    同声传译助手后端服务已启动                   │`);
  console.log(`├─────────────────────────────────────────────┤`);
  console.log(`│  端口: ${CONFIG.port}                          │`);
  console.log(`│  API Key: ${CONFIG.deepseekApiKey && CONFIG.deepseekApiKey !== 'your_api_key_here' ? '✓ 已配置' : '✗ 未配置'} │`);
  console.log(`│  模型: ${CONFIG.model}                        │`);
  console.log(`│  超时: ${CONFIG.timeout}ms                    │`);
  console.log(`├─────────────────────────────────────────────┤`);
  console.log(`│  访问地址: http://localhost:${CONFIG.port}     │`);
  console.log(`└─────────────────────────────────────────────┘`);
});
