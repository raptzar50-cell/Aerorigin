import { useState, useCallback } from 'react'
import GlobalNavbar from './GlobalNavbar'
import AuthModal from './AuthModal'

/*
 * AppShell — top-level layout wrapper that structurally guarantees the
 * GlobalNavbar and AuthModal appear on every single page.
 *
 * Rendered once in App.jsx around all <Routes>. Individual pages never
 * need to "remember" to include the navbar — it's always here.
 *
 * This pattern prevents the exact navigation gap this task is fixing:
 * because the navbar is rendered at the AppShell level, it's impossible
 * to have a page without it (unless you explicitly bypass AppShell).
 */

export default function AppShell({ children }) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalTab, setAuthModalTab] = useState('login')

  const handleOpenAuthModal = useCallback((tab = 'login') => {
    setAuthModalTab(tab)
    setAuthModalOpen(true)
  }, [])

  const handleCloseAuthModal = useCallback(() => {
    setAuthModalOpen(false)
  }, [])

  return (
    <>
      <GlobalNavbar onOpenAuthModal={handleOpenAuthModal} />
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={handleCloseAuthModal}
      />
      <div className="appshell-content">
        {children}
      </div>
    </>
  )
}
