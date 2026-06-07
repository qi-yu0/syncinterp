export function useSpeechSynthesis() {
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      console.log('浏览器不支持语音合成')
      return
    }
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.0
    utterance.pitch = 1
    speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
  }

  return { speakText, stopSpeaking }
}