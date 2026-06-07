<template>
  <header class="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
    <div class="flex items-center justify-between max-w-7xl mx-auto">
      <!-- 左侧 -->
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
        </svg>
        
        <!-- 翻译模式选择 -->
        <div class="relative">
          <select
            :value="translationMode"
            @change="$emit('update:translationMode', $event.target.value)"
            class="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-400 transition-colors"
          >
            <option value="ai">AI翻译模式</option>
            <option value="normal">常规翻译模式</option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>

        <!-- 历史记录按钮 -->
        <button
          @click="$emit('toggleHistory')"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            showHistory
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          历史记录 {{ historyCount > 0 ? `(${historyCount})` : '' }}
        </button>
      </div>

      <!-- 中间 -->
      <div class="flex items-center gap-4">
        <span class="text-sm font-medium text-gray-600">
          {{ isListening ? '同声传译中' : '同声传译暂停' }}
        </span>
        <span class="text-sm font-medium text-gray-700">{{ elapsedTime }} / {{ maxDuration }}</span>

        <!-- 开始/结束按钮 -->
        <button
          @click="$emit('toggleListening')"
          class="px-4 py-1.5 rounded-full bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {{ isListening ? '结束' : '开始' }}
        </button>

        <!-- 暂停按钮 -->
        <button
          v-if="isListening"
          @click="$emit('stopListening')"
          class="px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          暂停
        </button>
      </div>

      <!-- 右侧 -->
      <div class="flex items-center gap-4">
        <!-- 源语言 -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">源语言</span>
          <select
            :value="sourceLang"
            @change="$emit('update:sourceLang', $event.target.value)"
            class="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-6 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="en">英文</option>
            <option value="zh">中文</option>
          </select>
          <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>

        <!-- 目标语言 -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">目标语言</span>
          <select
            :value="targetLang"
            @change="$emit('update:targetLang', $event.target.value)"
            class="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-6 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="zh">中文</option>
            <option value="en">英文</option>
          </select>
          <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  translationMode: String,
  showHistory: Boolean,
  historyCount: Number,
  isListening: Boolean,
  elapsedTime: String,
  maxDuration: String,
  sourceLang: String,
  targetLang: String
})

defineEmits([
  'update:translationMode',
  'toggleHistory',
  'toggleListening',
  'stopListening',
  'update:sourceLang',
  'update:targetLang'
])
</script>