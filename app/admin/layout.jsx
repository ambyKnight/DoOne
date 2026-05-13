'use client'

import './admin.css'
import { AuthProvider } from '../../src/lib/authContext'

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
