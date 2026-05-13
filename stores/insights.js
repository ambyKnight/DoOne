import { create } from 'zustand'

export const useInsightsStore = create((set) => ({
  insights: [],
  behaviorPatterns: [],
  loading: false,

  fetchInsights: async (token) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/insights', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      set({ insights: data.insights || [], loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchBehavior: async (token) => {
    try {
      const res = await fetch('/api/behavior', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      set({ behaviorPatterns: data.patterns || [] })
    } catch {}
  },

  generateInsight: async (token) => {
    try {
      await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      // Refresh
      const res = await fetch('/api/insights', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      set({ insights: data.insights || [] })
    } catch {}
  },

  generateMemorySummaries: async (token) => {
    try {
      await fetch('/api/ai/memory', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  },
}))
