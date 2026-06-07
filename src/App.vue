<script setup>
import { ref, watch, nextTick } from 'vue'
import Header from './components/Header.vue'
import ErrorAlert from './components/ErrorAlert.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import ManualInput from './components/ManualInput.vue'
import MainContent from './components/MainContent.vue'
import { useSpeechRecognition } from './composables/useSpeechRecognition'
import { useTranslation } from './composables/useTranslation'
import { useSpeechSynthesis } from './composables/useSpeechSynthesis'
import { useHistoryAndCorrection } from './composables/useHistoryAndCorrection'
import { useTimer } from './composables/useTimer'
import { SubtitleService } from './services/subtitleService'

const subtitleService = new SubtitleService()
const subtitleList = ref([])
const selectedId = ref(null)
const originalTexts = ref(new Map())
const sourceLang = ref('en')
const targetLang = ref('zh')

const { speakText, stopSpeaking } = useSpeechSynthesis()
const { elapsedTime, maxDuration, startTimer, stopTimer } = useTimer()

const { translationMode, translateText, translateWithDebounce, cancelDebounce } = useTranslation({
  onSaveHistory: (original, translation) => saveToHistory(original, translation),
  onUpdateCard: (cardId, translation) => {
    updateCardTranslation(cardId, translation)
  }
})

const { historyRecords, showHistory, saveToHistory, clearHistory, toggleHistory, triggerCorrection } = useHistoryAndCorrection({
  originalTexts,
  subtitleList
})

function forceUpdateSubtitleList() {
  subtitleList.value = JSON.parse(JSON.stringify(subtitleService.subtitles))
}

function updateCardTranslation(cardId, translation) {
  subtitleService.updateTranslation(cardId, translation)
  forceUpdateSubtitleList()
}

function handleInterimResult(text) {
  console.log('处理临时结果:', text)
  const card = subtitleService.handleInterimResult(text)
  
  if (card) {
    forceUpdateSubtitleList()
    selectedId.value = card.id
    translateWithDebounce(card.original, sourceLang.value, targetLang.value, card.id, 500)
    scrollToBottom()
  }
}

function handleFinalResult(text) {
  console.log('处理最终结果:', text)
  const card = subtitleService.handleFinalResult(text)
  
  if (card) {
    forceUpdateSubtitleList()
    selectedId.value = card.id
    cancelDebounce()
    translateAndUpdateCard(card.original, card.id, true)
    scrollToBottom()
  }
}

async function translateAndUpdateCard(text, cardId, isFinal = false) {
  console.log(`翻译卡片 ${cardId}: ${text}, isFinal: ${isFinal}`)
  const result = await translateText(text, sourceLang.value, targetLang.value, cardId, isFinal)
  console.log(`翻译结果:`, result)
  
  if (result.success && result.translation) {
    updateCardTranslation(cardId, result.translation)
    if (isFinal) {
      speakText(result.translation)
      triggerCorrection()
    }
  }
}

const { isListening, errorMessage, startListening: startRecognition, stopListening: stopRecognition, updateSourceLang } = useSpeechRecognition({
  onFinalResult: handleFinalResult,
  onInterimResult: handleInterimResult,
  onError: (error) => console.error('Recognition error:', error),
  sourceLang
})

watch(sourceLang, (newLang) => updateSourceLang(newLang))

function toggleListening() {
  if (isListening.value) {
    stopListening()
  } else {
    startListening()
  }
}

function startListening() {
  startRecognition()
  startTimer()
}

function stopListening() {
  cancelDebounce()
  stopRecognition()
  stopSpeaking()
  stopTimer()
}

function selectCard(id) {
  selectedId.value = id
}

function deleteCard(id) {
  subtitleService.deleteCard(id)
  forceUpdateSubtitleList()
  if (selectedId.value === id) {
    selectedId.value = subtitleList.value.length > 0 ? subtitleList.value[subtitleList.value.length - 1].id : null
  }
}

function playCard(item) {
  if (item.translation) {
    speakText(item.translation)
  }
}

function handleManualInput(text) {
  const card = subtitleService.handleFinalResult(text)
  if (card) {
    forceUpdateSubtitleList()
    selectedId.value = card.id
    translateAndUpdateCard(card.original, card.id, true)
  }
}

function playHistory(item) {
  if (item.translation) {
    speakText(item.translation)
  }
}

function scrollToBottom() {
  nextTick(() => {
    const container = document.getElementById('subtitle-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <Header
      :translationMode="translationMode"
      :showHistory="showHistory"
      :historyCount="historyRecords.length"
      :isListening="isListening"
      :elapsedTime="elapsedTime"
      :maxDuration="maxDuration"
      :sourceLang="sourceLang"
      :targetLang="targetLang"
      @update:translationMode="translationMode = $event"
      @toggleHistory="toggleHistory"
      @toggleListening="toggleListening"
      @stopListening="stopListening"
      @update:sourceLang="sourceLang = $event"
      @update:targetLang="targetLang = $event"
    />

    <ErrorAlert :message="errorMessage" />

    <div class="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto">
      <HistoryPanel
        :show="showHistory"
        :historyRecords="historyRecords"
        @clear="clearHistory"
        @play="playHistory"
      />

      <ManualInput @submit="handleManualInput" />

      <MainContent
        :subtitleList="subtitleList"
        :selectedId="selectedId"
        :originalTexts="originalTexts"
        @selectCard="selectCard"
        @playCard="playCard"
        @deleteCard="deleteCard"
      />
    </div>
  </div>
</template>

<style>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>