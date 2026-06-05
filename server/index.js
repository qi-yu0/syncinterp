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

// 构建 Prompt - 严格要求纯 JSON 输出
const buildCorrectionPrompt = (subtitles) => {
  let prompt = `你是一个同声传译修正助手。请根据上下文，修正以下翻译中的代词指代问题。

历史记录：
`;
  subtitles.forEach((sub, index) => {
    prompt += `[${index + 1}] 原文: "${sub.original}" 译文: "${sub.translation}"\n`;
  });
  
  prompt += `
【重要要求】
1. 只输出 JSON 数组，不要输出任何其他内容
2. 不要添加markdown代码块标记
3. 不要添加任何解释或说明
4. 数组格式：[{"id":数字,"translation":"修正后的译文"}]
5. 必须包含所有原始ID，保持顺序不变
6. 只有当译文需要修正时才修改，不需要修正时请保持原样

输出示例（只输出这个格式，不要输出其他内容）：
[{"id":0,"translation":"修正后的译文1"},{"id":1,"translation":"修正后的译文2"},{"id":2,"translation":"修正后的译文3"}]`;

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
            content: '你是一个严格的JSON输出助手。只输出纯JSON数组，不要输出任何其他内容，包括解释、说明或代码块标记。'
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
      .map(item => ({
        id: item.id,
        translation: item.translation.trim()
      }));
    
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

// 健康检查接口
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '同声传译助手后端服务运行中',
    endpoints: {
      '/api/correct': 'POST - AI 上下文修正接口'
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
