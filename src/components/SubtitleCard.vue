<template>
  <div
    @click="$emit('select')"
    :class="[
      'p-4 rounded-xl border-2 cursor-pointer transition-all',
      isSelected
        ? 'border-blue-500 bg-blue-50/50'
        : item.status === 'interim'
          ? 'border-dashed border-gray-300 bg-gray-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
    ]"
  >
    <!-- 发言人标签 -->
    <div class="flex items-center gap-2 mb-3">
      <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
        </svg>
      </div>
      <span class="text-sm font-medium text-gray-600">发言人</span>
      <span
        v-if="item.status === 'interim'"
        class="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full font-medium animate-pulse"
      >
        识别中...
      </span>
      <span
        v-if="item.status === 'corrected'"
        class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium"
      >
        AI修正
      </span>
    </div>

    <!-- 原文矩形框 -->
    <div
      :class="[
        'border rounded-lg p-3 mb-2',
        item.status === 'interim'
          ? 'border-gray-300 bg-white'
          : 'border-gray-300 bg-gray-50'
      ]"
    >
      <!-- 显示修正前的原文 -->
      <div v-if="originalText" class="text-xs text-gray-400 mb-1 line-through">
        {{ originalText }}
      </div>
      <div
        :class="[
          'text-base leading-relaxed',
          item.status === 'interim' ? 'text-gray-500 italic' : 'text-gray-800'
        ]"
      >
        {{ item.original }}
      </div>
    </div>

    <!-- 译文矩形框 -->
    <div
      :class="[
        'border rounded-lg p-3',
        item.translation
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 bg-gray-50'
      ]"
    >
      <div
        :class="[
          'text-sm leading-relaxed',
          item.translation
            ? 'text-blue-800'
            : 'text-gray-400 italic'
        ]"
      >
        {{ item.translation || '翻译中...' }}
      </div>
    </div>

    <!-- 操作按钮（选中时显示） -->
    <div
      v-if="isSelected"
      class="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100"
    >
      <button
        @click.stop="$emit('play')"
        class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        title="播放"
      >
        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </button>
      <button
        @click.stop="$emit('delete')"
        class="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors"
        title="删除"
      >
        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  item: Object,
  isSelected: Boolean,
  originalText: String
})

defineEmits(['select', 'play', 'delete'])
</script>