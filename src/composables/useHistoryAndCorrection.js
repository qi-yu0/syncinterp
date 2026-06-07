import { ref } from 'vue'

export function useHistoryAndCorrection({ originalTexts, subtitleList }) {
  const historyRecords = ref([])
  const showHistory = ref(false)

  const saveToHistory = (original, translation) => {
    const record = {
      id: Date.now(),
      original: original,
      translation: translation,
      timestamp: new Date().toLocaleTimeString()
    }
    historyRecords.value.push(record)
  }

  const clearHistory = () => {
    historyRecords.value = []
  }

  const toggleHistory = () => {
    showHistory.value = !showHistory.value
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles })
      })

      const data = await response.json()
      if (data.corrections && Array.isArray(data.corrections)) {
        applyCorrections(data.corrections)
      }
    } catch (error) {
      console.error('AI修正失败:', error)
    }
  }

  const applyCorrections = (corrections) => {
    corrections.forEach(corrected => {
      const item = subtitleList.value.find(s => s.id === corrected.id)
      if (item) {
        if (corrected.original && item.original !== corrected.original) {
          originalTexts.value.set(item.id, item.original)
          item.original = corrected.original
        }

        if (corrected.translation && item.translation !== corrected.translation) {
          item.translation = corrected.translation
        }

        item.status = 'corrected'

        setTimeout(() => {
          if (item.status === 'corrected') {
            item.status = 'final'
          }
          originalTexts.value.delete(item.id)
        }, 5000)
      }
    })
  }

  return {
    historyRecords,
    showHistory,
    saveToHistory,
    clearHistory,
    toggleHistory,
    triggerCorrection
  }
}