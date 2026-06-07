<template>
  <div class="mb-4 p-4 bg-white rounded-xl border border-gray-200">
    <div class="flex gap-3">
      <input
        v-model="inputText"
        type="text"
        placeholder="手动输入文本进行翻译..."
        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        @keyup.enter="handleSubmit"
      />
      <button
        @click="handleSubmit"
        class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
      >
        翻译
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const inputText = ref('')

const handleSubmit = () => {
  if (inputText.value.trim()) {
    emit('submit', inputText.value.trim())
    inputText.value = ''
  }
}

const emit = defineEmits(['submit'])
</script>