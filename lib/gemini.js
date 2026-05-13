import { GoogleGenerativeAI } from '@google/generative-ai'

let cached = null

export function getGeminiClient() {
  if (cached) return cached
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')
  cached = new GoogleGenerativeAI(key)
  return cached
}

export const DEFAULT_MODEL = 'gemini-2.5-flash'
