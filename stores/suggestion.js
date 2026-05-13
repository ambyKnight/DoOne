import { create } from 'zustand'

export const useSuggestionStore = create((set, get) => ({
  suggestion: null,
  message: null,
  loading: false,
  error: null,
  formattedMessage: null,

  fetchSuggestion: async (token) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/suggestion', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      set({
        suggestion: data.suggestion,
        message: data.message,
        loading: false,
      })

      // Format message via AI (non-blocking)
      if (data.suggestion) {
        get().formatSuggestion(token, data.suggestion, data.reason)
      }
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  formatSuggestion: async (token, suggestion, reason) => {
    try {
      const res = await fetch('/api/ai/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: suggestion.title,
          duration: suggestion.duration,
          reason,
          progress: suggestion.progress,
          job_title: suggestion.job_title,
        }),
      })
      const data = await res.json()
      set({ formattedMessage: data.message })
    } catch {
      // Fallback already built into the suggestion
    }
  },

  recordAction: async (token, itemType, itemId, action, meta = {}) => {
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          action,
          ...meta,
        }),
      })
      // Refresh suggestion after action
      get().fetchSuggestion(token)

      // Recompute behavior in background (non-blocking)
      fetch('/api/behavior', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    } catch (e) {
      console.error('[action]', e)
    }
  },

  clear: () => set({ suggestion: null, message: null, formattedMessage: null }),
}))
