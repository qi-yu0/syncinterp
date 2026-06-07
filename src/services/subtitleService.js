/**
 * 字幕管理服务（简化版）
 */

export class SubtitleService {
  constructor() {
    this.subtitles = []
    this.interimCardId = null
    this.originalTexts = new Map()
  }

  /**
   * 处理临时结果 - 更新或创建临时卡片
   */
  handleInterimResult(text) {
    if (!text || !text.trim()) return null

    // 如果有临时卡片，更新它
    if (this.interimCardId) {
      const card = this.subtitles.find(item => item.id === this.interimCardId)
      if (card) {
        card.original = text
        return card
      }
    }

    // 创建新卡片
    const newCard = {
      id: Date.now(),
      original: text,
      translation: '',
      status: 'interim'
    }
    this.subtitles.push(newCard)
    this.interimCardId = newCard.id
    return newCard
  }

  /**
   * 处理最终结果 - 将临时卡片转为最终状态
   */
  handleFinalResult(text) {
    if (!text || !text.trim()) return null

    let card

    // 如果有临时卡片，更新它为最终状态
    if (this.interimCardId) {
      card = this.subtitles.find(item => item.id === this.interimCardId)
      if (card) {
        card.original = text
        card.status = 'final'
        this.interimCardId = null
        return card
      }
    }

    // 创建新卡片
    card = {
      id: Date.now(),
      original: text,
      translation: '',
      status: 'final'
    }
    this.subtitles.push(card)
    return card
  }

  updateTranslation(cardId, translation) {
    const card = this.subtitles.find(item => item.id === cardId)
    if (card) {
      card.translation = translation
    }
  }

  deleteCard(cardId) {
    this.subtitles = this.subtitles.filter(item => item.id !== cardId)
    if (this.interimCardId === cardId) {
      this.interimCardId = null
    }
  }

  getCard(cardId) {
    return this.subtitles.find(item => item.id === cardId)
  }

  getSubtitles() {
    return this.subtitles
  }

  clearAll() {
    this.subtitles = []
    this.interimCardId = null
    this.originalTexts.clear()
  }
}