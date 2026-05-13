import { create } from 'zustand'

export const useJobsStore = create((set) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchJobs: async (token) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      set({ jobs: data.jobs, loading: false })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  createJob: async (token, jobData) => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Auto-breakdown via AI
      await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ job_id: data.job.id }),
      })

      // Refresh
      const refreshRes = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const refreshData = await refreshRes.json()
      set({ jobs: refreshData.jobs })

      return data.job
    } catch (e) {
      set({ error: e.message })
      return null
    }
  },

  updateJob: async (token, id, updates) => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, ...updates }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? data.job : j),
      }))
    } catch (e) {
      set({ error: e.message })
    }
  },
}))
