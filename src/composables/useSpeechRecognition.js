import { ref, onMounted, onUnmounted } from 'vue'

export function useSpeechRecognition({
  onFinalResult,
  onInterimResult,
  onError,
  sourceLang
}) {
  const isListening = ref(false)
  const errorMessage = ref('')
  let recognition = null

  const initRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      errorMessage.value = '浏览器不支持 Web Speech API，请使用 Chrome 浏览器'
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = sourceLang.value === 'en' ? 'en-US' : 'zh-CN'
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      console.log('识别事件:', event)
      // 只处理resultIndex之后的新结果
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript.trim()
        console.log(`识别结果 [${i}]: ${transcript}, isFinal: ${result.isFinal}`)

        if (result.isFinal) {
          onFinalResult && onFinalResult(transcript)
        } else {
          onInterimResult && onInterimResult(transcript)
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        errorMessage.value = `识别错误: ${event.error}`
        onError && onError(event.error)
      }
    }

    recognition.onend = () => {
      if (isListening.value) {
        try {
          recognition.start()
        } catch (error) {
          console.error('Restart recognition error:', error)
        }
      }
    }
  }

  const startListening = () => {
    errorMessage.value = ''
    try {
      if (!recognition) {
        initRecognition()
      }
      isListening.value = true
      recognition.lang = sourceLang.value === 'en' ? 'en-US' : 'zh-CN'
      recognition.start()
    } catch (error) {
      errorMessage.value = '无法访问麦克风，请检查权限设置'
      console.error('Start recognition error:', error)
    }
  }

  const stopListening = () => {
    isListening.value = false
    if (recognition) {
      try {
        recognition.stop()
      } catch (error) {
        console.error('Stop recognition error:', error)
      }
    }
  }

  const updateSourceLang = (lang) => {
    if (recognition) {
      recognition.lang = lang === 'en' ? 'en-US' : 'zh-CN'
    }
  }

  onMounted(() => {
    initRecognition()
  })

  onUnmounted(() => {
    stopListening()
  })

  return {
    isListening,
    errorMessage,
    startListening,
    stopListening,
    updateSourceLang
  }
}