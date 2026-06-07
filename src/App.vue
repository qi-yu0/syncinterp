<script setup>
import { ref, nextTick } from 'vue'

const subtitleList = ref([])
const isListening = ref(false)
const errorMessage = ref('')
const manualInput = ref('')
const apiKey = ref('')
const originalTexts = ref(new Map())
const translationMode = ref('normal')
const maxSubtitles = 3  // 最多保留3句
const historyRecords = ref([])  // 所有翻译历史记录
const showHistory = ref(false)  // 是否显示历史记录面板
let recognition = null
let currentId = 0
let debounceTimer = null

const speakText = (text) => {
  if (!('speechSynthesis' in window)) {
    console.log('浏览器不支持语音合成')
    return
  }
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1.2
  utterance.pitch = 1
  speechSynthesis.speak(utterance)
}

// 限制字幕列表只保留最近3句
const limitSubtitles = () => {
  if (subtitleList.value.length > maxSubtitles) {
    const removeCount = subtitleList.value.length - maxSubtitles
    // 删除最旧的字幕
    for (let i = 0; i < removeCount; i++) {
      originalTexts.value.delete(subtitleList.value[0].id)
    }
    subtitleList.value = subtitleList.value.slice(-maxSubtitles)
  }
}

// 保存翻译记录到历史
const saveToHistory = (original, translation) => {
  if (!original || !translation) return
  // 避免重复记录
  const exists = historyRecords.value.some(
    record => record.original === original && record.translation === translation
  )
  if (!exists) {
    historyRecords.value.push({
      id: Date.now(),
      original,
      translation,
      timestamp: new Date().toLocaleTimeString('zh-CN')
    })
  }
}

// 切换历史记录面板显示
const toggleHistory = () => {
  showHistory.value = !showHistory.value
}

// 清空历史记录
const clearHistory = () => {
  historyRecords.value = []
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
      triggerCorrection()
      // 限制字幕数量
      limitSubtitles()
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
  if (translationMode.value === 'ai') {
    await aiTranslate(text, id)
    return
  }
  
  try {
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    if (apiKey.value) {
      url += `&key=${apiKey.value}`
    }
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.responseStatus === 429 || data.responseDetails?.includes('QUOTA')) {
      const item = subtitleList.value.find(item => item.id === id)
      if (item && item.status === 'interim') {
        item.translation = '翻译配额已用尽'
      }
      return
    }
    
    const translation = data.responseData?.translatedText || ''
    
    const item = subtitleList.value.find(item => item.id === id)
    if (item && item.status === 'interim') {
      item.translation = translation
    }
  } catch (error) {
    console.error('Translation error:', error)
  }
}

const aiTranslate = async (text, id, shouldSpeak = false) => {
  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    })
    
    const data = await response.json()
    
    if (data.translation) {
      const item = subtitleList.value.find(item => item.id === id)
      if (item) {
        item.translation = data.translation
        // 保存到历史记录
        saveToHistory(text, data.translation)
        // 翻译完成后立即播报（不等待最终状态）
        if (shouldSpeak) {
          speakText(data.translation)
        }
      }
    } else {
      const item = subtitleList.value.find(item => item.id === id)
      if (item) {
        item.translation = data.error || 'AI 翻译失败'
      }
    }
  } catch (error) {
    console.error('AI Translation error:', error)
    const item = subtitleList.value.find(item => item.id === id)
    if (item) {
      item.translation = '网络超时'
    }
  }
}

const translateAndSpeak = async (text, id) => {
  if (translationMode.value === 'ai') {
    await aiTranslate(text, id, true)
    return
  }
  
  try {
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    if (apiKey.value) {
      url += `&key=${apiKey.value}`
    }
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.responseStatus === 429 || data.responseDetails?.includes('QUOTA')) {
      const item = subtitleList.value.find(item => item.id === id)
      if (item) {
        item.translation = '翻译配额已用尽，请明天再试'
      }
      return
    }
    
    const translation = data.responseData?.translatedText || ''
    
    const item = subtitleList.value.find(item => item.id === id)
    if (item) {
      item.translation = translation
      // 保存到历史记录
      saveToHistory(text, translation)
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

const triggerCorrection = async () => {
  const finalItems = subtitleList.value.filter(item => item.status === 'final' && item.translation)
  
  if (finalItems.length >= 1) {
    const window = finalItems.slice(-3)
    await correctSubtitles(window)
  }
}

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

const applyCorrections = (corrections) => {
  corrections.forEach(corrected => {
    const item = subtitleList.value.find(s => s.id === corrected.id)
    if (item) {
      let hasChange = false
      
      if (corrected.original && item.original !== corrected.original) {
        originalTexts.value.set(item.id, item.original)
        item.original = corrected.original
        hasChange = true
      }
      
      if (corrected.translation && item.translation !== corrected.translation) {
        item.translation = corrected.translation
        hasChange = true
      }
      
      if (hasChange) {
        item.status = 'corrected'
        setTimeout(() => {
          if (item.status === 'corrected') {
            item.status = 'final'
          }
          originalTexts.value.delete(item.id)
        }, 5000)
      }
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
  
  // 限制字幕数量
  limitSubtitles()
  
  nextTick(() => {
    const container = document.getElementById('subtitle-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
    <!-- 头部 -->
    <header class="p-6 border-b border-gray-700/50 backdrop-blur-md bg-gray-900/60 sticky top-0 z-50">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            同声传译助手
          </h1>
        </div>
        
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-400">模式：</span>
            <span :class="[
              'px-3 py-1 rounded-full text-xs font-semibold',
              translationMode === 'normal' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            ]">
              {{ translationMode === 'normal' ? '常规' : '🤖 AI' }}
            </span>
          </div>
          <div v-if="isListening" class="flex items-center gap-2">
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span class="text-green-400 text-sm">正在监听</span>
            <div class="flex gap-0.5">
              <span class="w-1 h-3 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0s"></span>
              <span class="w-1 h-5 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
              <span class="w-1 h-7 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
              <span class="w-1 h-5 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
              <span class="w-1 h-3 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1 flex flex-col p-6 max-w-4xl mx-auto">
      <!-- 错误提示 -->
      <transition name="fade">
        <div v-if="errorMessage" class="mb-4 p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 flex items-center gap-3">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {{ errorMessage }}
        </div>
      </transition>

      <!-- 字幕区域 - 居中显示 -->
      <div id="subtitle-container" class="flex-1 flex flex-col justify-center items-center min-h-[300px] max-h-[400px] overflow-hidden bg-gray-800/30 backdrop-blur-md rounded-2xl p-8 mb-6 border border-gray-700/30">
        <div v-if="subtitleList.length === 0" class="text-center text-gray-500">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-2xl mb-4">
            <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            </svg>
          </div>
          <p class="text-lg text-gray-400 mb-2">点击下方按钮开始语音识别</p>
          <p class="text-sm text-gray-500">支持英语实时翻译，支持手动输入</p>
        </div>
        
        <div v-else class="w-full max-w-3xl space-y-6">
          <transition-group name="scroll">
            <div 
              v-for="item in subtitleList" 
              :key="item.id"
              :class="[
                'text-center transition-all duration-500 cursor-pointer',
                item.status === 'interim' ? 'opacity-70' : 
                item.status === 'corrected' ? 'opacity-100' :
                'opacity-90'
              ]"
              @click="item.translation && speakText(item.translation)"
            >
              <!-- 原文 -->
              <div class="flex flex-wrap items-center justify-center gap-2 mb-3">
                <template v-if="originalTexts.get(item.id)">
                  <span class="text-gray-500 text-base line-through">{{ originalTexts.get(item.id) }}</span>
                  <span class="text-gray-400 text-sm">→</span>
                </template>
                <span :class="['text-xl', item.status === 'interim' ? 'text-gray-400 italic' : 'text-gray-300']">
                  {{ item.original }}
                </span>
                <span v-if="item.status === 'corrected'" class="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full ml-2">
                  AI修正
                </span>
              </div>
              
              <!-- 译文 -->
              <div v-if="item.translation" :class="['text-3xl font-semibold', item.status === 'corrected' ? 'text-yellow-300' : 'text-white']">
                {{ item.translation }}
              </div>
            </div>
          </transition-group>
        </div>
      </div>

      <!-- 控制区域 -->
      <div class="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/30">
        <!-- 模式切换 -->
        <div class="flex justify-center items-center gap-3 mb-6">
          <span class="text-gray-400 text-sm">翻译模式：</span>
          <div class="relative">
            <select
              v-model="translationMode"
              class="appearance-none px-5 py-2.5 pr-10 bg-gray-700/60 border border-gray-600/50 rounded-xl text-white font-semibold text-sm cursor-pointer focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="normal">常规模式 - 免费翻译 API</option>
              <option value="ai">🤖 AI模式 - 智能翻译引擎</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="flex justify-center gap-4 mb-6">
          <button
            v-if="!isListening"
            @click="startListening"
            class="px-10 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 flex items-center gap-3"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            </svg>
            开始识别
          </button>
          <button
            v-else
            @click="stopListening"
            class="px-10 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 flex items-center gap-3"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            停止识别
          </button>
          
          <!-- 历史记录按钮 -->
          <button
            @click="toggleHistory"
            :class="[
              'px-6 py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 flex items-center gap-3',
              showHistory ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800'
            ]"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            历史记录
            <span v-if="historyRecords.length > 0" class="px-2 py-0.5 bg-white/20 rounded-full text-sm">
              {{ historyRecords.length }}
            </span>
          </button>
        </div>

        <!-- 输入区域 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- API Key -->
          <div>
            <label class="block text-gray-400 text-xs uppercase tracking-wider mb-2">MyMemory API Key（可选）</label>
            <input 
              v-model="apiKey"
              type="password"
              placeholder="输入 API Key 提升翻译配额"
              class="w-full px-4 py-3 bg-gray-700/40 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 text-sm"
            />
          </div>

          <!-- 手动输入 -->
          <div>
            <label class="block text-gray-400 text-xs uppercase tracking-wider mb-2">手动输入</label>
            <div class="flex gap-2">
              <input 
                v-model="manualInput"
                @keyup.enter="handleManualInput"
                type="text"
                placeholder="输入英文进行翻译..."
                class="flex-1 px-4 py-3 bg-gray-700/40 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
              />
              <button 
                @click="handleManualInput"
                :disabled="!manualInput.trim()"
                class="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold flex items-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                翻译
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 历史记录面板 -->
      <transition name="fade">
        <div v-if="showHistory" class="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/30 mt-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              翻译历史记录
              <span class="text-sm text-gray-400 font-normal">({{ historyRecords.length }} 条)</span>
            </h3>
            <button
              v-if="historyRecords.length > 0"
              @click="clearHistory"
              class="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all"
            >
              清空记录
            </button>
          </div>
          
          <div v-if="historyRecords.length === 0" class="text-center text-gray-500 py-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-700/50 rounded-xl mb-3">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <p>暂无翻译记录</p>
          </div>
          
          <div v-else class="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
            <div
              v-for="record in historyRecords"
              :key="record.id"
              class="p-4 bg-gray-700/30 rounded-xl border border-gray-600/30 hover:border-gray-500/40 transition-all cursor-pointer"
              @click="speakText(record.translation)"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-gray-500 text-xs">{{ record.timestamp }}</span>
              </div>
              <div class="text-gray-300 text-sm mb-1">{{ record.original }}</div>
              <div class="text-white font-medium">{{ record.translation }}</div>
            </div>
          </div>
        </div>
      </transition>
    </main>

    <!-- 底部 -->
    <footer class="p-4 text-center text-gray-500 text-sm border-t border-gray-800/50">
      <div class="flex items-center justify-center gap-6">
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          点击字幕重复播放
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          支持语音识别和手动输入
        </span>
      </div>
    </footer>
  </div>
</template>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.3);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.6);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.8);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 滚动动画 */
.scroll-enter-active {
  transition: all 0.5s ease;
}
.scroll-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.scroll-leave-active {
  transition: all 0.5s ease;
  position: absolute;
  width: 100%;
}
.scroll-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
.scroll-move {
  transition: transform 0.5s ease;
}
</style>