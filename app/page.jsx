'use client'

import App from '../src/App'
import { AuthProvider } from '../src/lib/authContext'

export default function RootPage() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
