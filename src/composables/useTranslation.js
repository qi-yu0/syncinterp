import { ref } from 'vue'

export function useTranslation({ onSaveHistory, onUpdateCard }) {
  const translationMode = ref('ai')
  let debounceTimer = null
  let pendingTranslations = new Map()

  const translateText = async (text, sourceLang, targetLang, itemId, isFinal = false) => {
    if (!text || !text.trim()) {
      return { success: false, itemId }
    }

    if (translationMode.value === 'ai') {
      return await aiTranslate(text, itemId, isFinal)
    } else {
      return await normalTranslate(text, sourceLang, targetLang, itemId, isFinal)
    }
  }

  const aiTranslate = async (text, itemId, isFinal) => {
    try {
      console.log(`[翻译][AI模式] 卡片 ${itemId}: ${text.substring(0, 50)}...`)
      const response = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        timeout: 30000
      })
      
      if (!response.ok) {
        console.error(`[翻译][AI模式] 请求失败: ${response.status}`)
        return { success: false, itemId }
      }
      
      const data = await response.json()
      console.log(`[翻译][AI模式] 响应成功: ${itemId}`)
      
      if (data.translation) {
        if (isFinal) {
          onSaveHistory && onSaveHistory(text, data.translation)
        }
        return { success: true, translation: data.translation, itemId }
      }
      
      console.error('[翻译][AI模式] 返回空结果')
      return { success: false, itemId }
    } catch (error) {
      console.error(`[翻译][AI模式] 失败:`, error)
      return { success: false, itemId }
    }
  }

  const normalTranslate = async (text, sourceLang, targetLang, itemId, isFinal) => {
    try {
      console.log(`[翻译][常规模式] 卡片 ${itemId}: ${text.substring(0, 50)}...`)
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
      const response = await fetch(url, { timeout: 30000 })
      
      if (!response.ok) {
        console.error(`[翻译][常规模式] 请求失败: ${response.status}`)
        return { success: false, itemId }
      }
      
      const data = await response.json()
      console.log(`[翻译][常规模式] 响应成功: ${itemId}`)
      
      if (data.responseData?.translatedText) {
        if (isFinal) {
          onSaveHistory && onSaveHistory(text, data.responseData.translatedText)
        }
        return { success: true, translation: data.responseData.translatedText, itemId }
      }
      
      console.error('[翻译][常规模式] 返回空结果')
      return { success: false, itemId }
    } catch (error) {
      console.error(`[翻译][常规模式] 失败:`, error)
      return { success: false, itemId }
    }
  }

  const translateWithDebounce = (text, sourceLang, targetLang, itemId, delay = 500) => {
    // 更新待翻译的文本（总是更新最新的文本）
    pendingTranslations.set(itemId, { text, sourceLang, targetLang })
    
    // 清除之前的定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    
    // 设置新的定时器
    debounceTimer = setTimeout(async () => {
      // 收集所有待翻译的任务
      const tasks = [...pendingTranslations.entries()]
      pendingTranslations.clear()
      
      // 并发执行所有翻译请求
      const promises = tasks.map(([id, params]) => {
        return translateText(params.text, params.sourceLang, params.targetLang, id, false)
          .then(result => {
            if (result.success && result.translation) {
              onUpdateCard && onUpdateCard(id, result.translation)
            }
          })
          .catch(error => {
            console.error(`[防抖] 翻译失败: ${id}`, error)
          })
      })
      
      // 等待所有翻译完成
      await Promise.all(promises)
    }, delay)
  }

  const cancelDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    pendingTranslations.clear()
  }

  return {
    translationMode,
    translateText,
    translateWithDebounce,
    cancelDebounce
  }
}