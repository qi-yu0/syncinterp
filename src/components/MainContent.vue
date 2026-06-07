<template>
  <main class="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto">
    <!-- 字幕列表 -->
    <div id="subtitle-container" class="space-y-4">
      <div v-if="subtitleList.length === 0" class="text-center py-16">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-xl mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
          </svg>
        </div>
        <p class="text-gray-500 text-sm">点击开始按钮启动语音识别</p>
      </div>

      <!-- 字幕卡片 -->
      <SubtitleCard
        v-for="item in subtitleList"
        :key="item.id"
        :item="item"
        :isSelected="selectedId === item.id"
        :originalText="originalTexts.get(item.id)"
        @select="$emit('selectCard', item.id)"
        @play="$emit('playCard', item)"
        @delete="$emit('deleteCard', item.id)"
      />
    </div>
  </main>
</template>

<script setup>
import SubtitleCard from './SubtitleCard.vue'

defineProps({
  subtitleList: Array,
  selectedId: Number,
  originalTexts: Map
})

defineEmits(['selectCard', 'playCard', 'deleteCard'])
</script>