<script setup>
import { ref, nextTick } from 'vue'

const subtitleList = ref([])
const isListening = ref(false)
const errorMessage = ref('')
const manualInput = ref('')
const translationCache = ref(new Map()) // 翻译缓存
const apiKey = ref('') // MyMemory API Key（可选）
let recognition = null
let currentId = 0
let debounceTimer = null

// TTS 语音合成
const speakText = (text) => {
  if (!('speechSynthesis' in window)) {
    console.log('浏览器不支持语音合成')
    return
  }
  
  // 取消之前的语音
  speechSynthesis.cancel()
  
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1.2
  utterance.pitch = 1
  
  speechSynthesis.speak(utterance)
}

const initRecognition = () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    errorMessage.value = '浏览器不支持 Web Speech API，请使用 Chrome 浏览器'
    return
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onresult = (event) => {
    let interimTranscript = ''
    let finalTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    if (finalTranscript) {
      // 清除防抖定时器
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      
      const existingItem = subtitleList.value.find(item => item.id === currentId)
      if (existingItem) {
        existingItem.original = finalTranscript
        existingItem.status = 'final'
        translateAndSpeak(finalTranscript, currentId)
      } else {
        const newItem = {
          id: currentId,
          original: finalTranscript,
          translation: '',
          status: 'final'
        }
        subtitleList.value.push(newItem)
        translateAndSpeak(finalTranscript, currentId)
      }
      currentId++
      
      // 触发 AI 修正（滑动窗口）
      triggerCorrection()
    } else if (interimTranscript) {
      let existingItem = subtitleList.value.find(item => item.id === currentId)
      if (!existingItem) {
        existingItem = {
          id: currentId,
          original: interimTranscript,
          translation: '',
          status: 'interim'
        }
        subtitleList.value.push(existingItem)
      } else {
        existingItem.original = interimTranscript
        existingItem.status = 'interim'
      }
      
      // 防抖：500ms 后翻译
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        translateText(interimTranscript, currentId)
      }, 500)
    }

    nextTick(() => {
      const container = document.getElementById('subtitle-container')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    })
  }

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error)
    if (event.error === 'not-allowed') {
      errorMessage.value = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问'
    } else if (event.error === 'no-speech') {
      errorMessage.value = '未检测到语音，请重试'
    }
  }

  recognition.onend = () => {
    if (isListening.value) {
      setTimeout(() => {
        if (isListening.value) {
          recognition.start()
        }
      }, 200)
    }
  }
}

const translateText = async (text, id) => {
  // 检查缓存
  const cacheKey = text.toLowerCase().trim()
  if (translationCache.value.has(cacheKey)) {
    const cachedTranslation = translationCache.value.get(cacheKey)
    const item = subtitleList.value.find(item => item.id === id)
    if (item && item.status === 'interim') {
      item.translation = cachedTranslation
    }
    return
  }
  
  try {
    // 构建 URL，包含 API Key（如果有）
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    if (apiKey.value) {
      url += `&key=${apiKey.value}`
    }
    
    const response = await fetch(url)
    const data = await response.json()
    
    // 检查是否是配额用尽错误
    if (data.responseStatus === 429 || data.responseDetails?.includes('QUOTA')) {
      const item = subtitleList.value.find(item => item.id === id)
      if (item && item.status === 'interim') {
        item.translation = '翻译配额已用尽'
      }
      return
    }
    
    const translation = data.responseData?.translatedText || ''
    
    // 存入缓存
    if (translation && translation !== '翻译配额已用尽') {
      translationCache.value.set(cacheKey, translation)
    }
    
    const item = subtitleList.value.find(item => item.id === id)
    if (item && item.status === 'interim') {
      item.translation = translation
    }
  } catch (error) {
    console.error('Translation error:', error)
  }
}

// 翻译并语音合成
const translateAndSpeak = async (text, id) => {
  // 检查缓存
  const cacheKey = text.toLowerCase().trim()
  if (translationCache.value.has(cacheKey)) {
    const cachedTranslation = translationCache.value.get(cacheKey)
    const item = subtitleList.value.find(item => item.id === id)
    if (item) {
      item.translation = cachedTranslation
      speakText(cachedTranslation)
    }
    return
  }
  
  try {
    // 构建 URL，包含 API Key（如果有）
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    if (apiKey.value) {
      url += `&key=${apiKey.value}`
    }
    
    const response = await fetch(url)
    const data = await response.json()
    
    // 检查是否是配额用尽错误
    if (data.responseStatus === 429 || data.responseDetails?.includes('QUOTA')) {
      const item = subtitleList.value.find(item => item.id === id)
      if (item) {
        item.translation = '翻译配额已用尽，请明天再试'
      }
      return
    }
    
    const translation = data.responseData?.translatedText || ''
    
    // 存入缓存
    if (translation && translation !== '翻译配额已用尽，请明天再试') {
      translationCache.value.set(cacheKey, translation)
    }
    
    const item = subtitleList.value.find(item => item.id === id)
    if (item) {
      item.translation = translation
      // 语音合成
      speakText(translation)
    }
  } catch (error) {
    console.error('Translation error:', error)
    const item = subtitleList.value.find(item => item.id === id)
    if (item) {
      item.translation = '网络超时'
    }
  }
}

// AI 修正：滑动窗口逻辑
const triggerCorrection = async () => {
  // 获取所有 final 状态的条目
  const finalItems = subtitleList.value.filter(item => item.status === 'final' && item.translation)
  
  // 当有至少 3 句时触发修正
  if (finalItems.length >= 3) {
    const window = finalItems.slice(-3)
    await correctSubtitles(window)
  }
}

// 调用后端 AI 修正 API
const correctSubtitles = async (subtitles) => {
  try {
    const response = await fetch('http://localhost:3000/api/correct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ subtitles })
    })
    
    const data = await response.json()
    
    if (data.corrections && Array.isArray(data.corrections)) {
      applyCorrections(data.corrections)
    }
  } catch (error) {
    console.error('AI correction error:', error)
  }
}

// Diff 更新逻辑
const applyCorrections = (corrections) => {
  corrections.forEach(corrected => {
    const item = subtitleList.value.find(s => s.id === corrected.id)
    if (item && item.translation !== corrected.translation) {
      item.translation = corrected.translation
      item.status = 'corrected'
      
      // 3秒后移除修正标记
      setTimeout(() => {
        if (item.status === 'corrected') {
          item.status = 'final'
        }
      }, 3000)
    }
  })
}

const startListening = async () => {
  errorMessage.value = ''
  try {
    if (!recognition) {
      initRecognition()
    }
    isListening.value = true
    recognition.start()
  } catch (error) {
    errorMessage.value = '无法访问麦克风，请检查权限设置'
    console.error('Start recognition error:', error)
  }
}

const stopListening = () => {
  isListening.value = false
  speechSynthesis.cancel()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (recognition) {
    recognition.stop()
  }
}

// 手动输入翻译
const handleManualInput = () => {
  if (!manualInput.value.trim()) return
  
  const text = manualInput.value.trim()
  const newItem = {
    id: currentId++,
    original: text,
    translation: '',
    status: 'final'
  }
  subtitleList.value.push(newItem)
  translateAndSpeak(text, newItem.id)
  triggerCorrection()
  manualInput.value = ''
  
  nextTick(() => {
    const container = document.getElementById('subtitle-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
    <!-- 头部 -->
    <header class="p-6 border-b border-gray-700 backdrop-blur-sm bg-gray-900/50">
      <div class="flex items-center justify-center gap-4">
        <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          同声传译助手
        </h1>
        <div 
          v-if="isListening" 
          class="flex gap-1"
        >
          <span class="w-1 h-4 bg-green-500 rounded animate-bounce" style="animation-delay: 0s"></span>
          <span class="w-1 h-6 bg-green-500 rounded animate-bounce" style="animation-delay: 0.1s"></span>
          <span class="w-1 h-8 bg-green-500 rounded animate-bounce" style="animation-delay: 0.2s"></span>
          <span class="w-1 h-6 bg-green-500 rounded animate-bounce" style="animation-delay: 0.3s"></span>
        </div>
      </div>
    </header>

    <main class="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
      <!-- 错误提示 -->
      <div 
        v-if="errorMessage" 
        class="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200"
      >
        {{ errorMessage }}
      </div>

      <!-- 字幕区域 -->
      <div 
        id="subtitle-container"
        class="flex-1 overflow-y-auto bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 custom-scrollbar"
      >
        <div v-if="subtitleList.length === 0" class="text-center text-gray-500 mt-20">
          <div class="text-6xl mb-4">🎙️</div>
          <p class="text-lg">点击「开始」按钮开始识别</p>
        </div>
        <div v-else class="space-y-4">
          <div 
            v-for="item in subtitleList" 
            :key="item.id"
            :class="[
              'p-4 rounded-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer',
              item.status === 'interim' ? 'bg-blue-900/30 border-l-4 border-blue-500 italic' : 
              item.status === 'corrected' ? 'bg-yellow-900/30 border-l-4 border-yellow-500 shadow-lg shadow-yellow-500/20' :
              'bg-gray-800/80 border-l-4 border-green-500'
            ]"
            @click="item.translation && speakText(item.translation)"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="text-gray-400 text-sm">{{ item.original }}</span>
              <span 
                v-if="item.status === 'interim'" 
                class="inline-block w-2 h-4 bg-blue-400 animate-pulse"
              ></span>
              <span 
                v-if="item.status === 'corrected'" 
                class="px-2 py-1 bg-yellow-500 text-black text-xs rounded-full font-semibold"
              >
                🔄 AI修正
              </span>
            </div>
            <div class="text-xl">
              {{ item.translation || '翻译中...' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="flex flex-col gap-4">
        <div class="flex justify-center gap-4">
          <button
            v-if="!isListening"
            @click="startListening"
            class="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-full font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-green-500/50"
          >
            🎤 开始
          </button>
          <button
            v-else
            @click="stopListening"
            class="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-full font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-red-500/50"
          >
            ⏹️ 停止
          </button>
        </div>

        <!-- API Key 配置 -->
        <div class="flex gap-2">
          <input 
            v-model="apiKey"
            type="password"
            placeholder="MyMemory API Key（可选，提升翻译配额）"
            class="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
          <span class="px-4 py-2 bg-gray-700/50 rounded-lg text-sm text-gray-400 flex items-center">
            {{ translationCache.size }} 条缓存
          </span>
        </div>

        <!-- 手动输入区域 -->
        <div class="flex gap-2">
          <input 
            v-model="manualInput"
            @keyup.enter="handleManualInput"
            type="text"
            placeholder="手动输入英文进行翻译..."
            class="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button 
            @click="handleManualInput"
            :disabled="!manualInput.trim()"
            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            翻译
          </button>
        </div>
      </div>
    </main>

    <!-- 底部信息 -->
    <footer class="p-4 text-center text-gray-500 text-sm border-t border-gray-800">
      <p>💡 提示：点击字幕可重复播放语音</p>
    </footer>
  </div>
</template>

<style>
/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 1);
}
</style>
