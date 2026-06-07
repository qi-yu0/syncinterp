<template>
  <transition name="fade">
    <div v-if="show" class="mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-lg">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-800">翻译历史记录 ({{ historyRecords.length }}条)</h3>
        <button
          @click="$emit('clear')"
          class="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
        >
          清空记录
        </button>
      </div>

      <div v-if="historyRecords.length === 0" class="text-center py-8 text-gray-500 text-sm">
        暂无历史记录
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="item in historyRecords"
          :key="item.id"
          @click="$emit('play', item)"
          class="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <div class="text-xs text-gray-500 mb-1">{{ item.timestamp }}</div>
          <div class="text-sm text-gray-800 mb-1">{{ item.original }}</div>
          <div class="text-sm text-blue-600">{{ item.translation }}</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  show: Boolean,
  historyRecords: Array
})

defineEmits(['clear', 'play'])
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>