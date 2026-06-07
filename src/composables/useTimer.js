import { ref, onMounted, onUnmounted } from 'vue'

export function useTimer() {
  const elapsedTime = ref('00:00')
  const maxDuration = ref('05:00')
  let timerInterval = null
  let seconds = 0

  const startTimer = () => {
    if (timerInterval) return
    timerInterval = setInterval(() => {
      seconds++
      elapsedTime.value = formatTime(seconds)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  const resetTimer = () => {
    stopTimer()
    seconds = 0
    elapsedTime.value = '00:00'
  }

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  onUnmounted(() => {
    stopTimer()
  })

  return {
    elapsedTime,
    maxDuration,
    startTimer,
    stopTimer,
    resetTimer
  }
}