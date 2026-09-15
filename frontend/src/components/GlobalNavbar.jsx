import { useState, useRef, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import GlobalLiveSearchModal from './GlobalLiveSearchModal'

/*
 * GlobalNavbar — single reusable top navigation bar rendered by AppShell
 * on every page. Contains:
 *   - Logo (links to /)
 *   - Page links (Home, Dashboard, Route Detail, Live Flights, Data Quality, Settings)
 *   - Theme toggle
 *   - Auth controls (Log In/Sign Up when logged out, user dropdown when logged in)
 *   - Mobile hamburger menu
 *
 * Props:
 *   onOpenAuthModal(tab: 'login'|'signup') — opens the AuthModal from AppShell
 */

const navLinks = [
  { to: '/', label: 'Home', exact: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/routes/DEL-BOM', label: 'Route Analytics', matchPrefix: '/dashboard/routes' },
  { to: '/dashboard/flights', label: 'Flight Radar' },
  { to: '/dashboard/quality', label: 'Data Quality' },
  { to: '/dashboard/settings', label: 'Settings' },
]

const ROLE_META = {
  economist: { label: 'Economist', icon: '📊', color: '#F5A623' },
  regulator: { label: 'Regulator', icon: '🔍', color: '#00A5B5' },
  researcher: { label: 'Researcher', icon: '🔬', color: '#8B5CF6' },
  custom: { label: 'Custom', icon: '⚙️', color: '#E5245A' },
}

const ROLE_ROUTES = {
  economist:  '/dashboard/economist',
  regulator:  '/dashboard/regulator',
  researcher: '/dashboard/researcher',
  custom: '/dashboard/overview',
}

export default function GlobalNavbar({ onOpenAuthModal }) {
  const { isAuthenticated, user, profile, logout, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  // Derive the user's home dashboard link from their role
  const dashboardLink = profile?.role && ROLE_ROUTES[profile.role]
    ? ROLE_ROUTES[profile.role]
    : '/dashboard'

  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const dropdownRef = useRef(null)

  const isHome = location.pathname === '/'

  // Keyboard shortcut Ctrl+K / ⌘K to open live search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchModalOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track scroll for transparent-to-solid navbar on homepage
  useEffect(() => {
    if (!isHome) { setScrolled(true); return }
    const handleScroll = () => setScrolled(window.scrollY > 80)
    handleScroll() // set initial value
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isHome])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    setDropdownOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLogout = () => {
    logout()
    setDropdownOpen(false)
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <>
      <nav className={`gn ${isHome && !scrolled ? 'gn--transparent' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="gn__inner">
          {/* Logo */}
          <Link to="/" className="gn__logo">
            <div className="gn__logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1D1D1B" stroke="none">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
            <span className="gn__logo-text">Aerogin</span>
          </Link>

          {/* Desktop nav links */}
          <div className="gn__links">
            {navLinks.map(link => {
              // Resolve Dashboard link to role-specific route
              const resolvedTo = link.label === 'Dashboard' ? dashboardLink : link.to
              const isActive = link.exact
                ? location.pathname === link.to
                : link.matchPrefix
                  ? location.pathname.startsWith(link.matchPrefix)
                  : location.pathname === resolvedTo || location.pathname.startsWith('/dashboard/economist') || location.pathname.startsWith('/dashboard/regulator') || location.pathname.startsWith('/dashboard/researcher') ? (link.label === 'Dashboard') : location.pathname === resolvedTo

              return (
                <NavLink
                  key={link.to}
                  to={resolvedTo}
                  className={`gn__link ${isActive && link.label === 'Dashboard' && ['/dashboard/economist', '/dashboard/regulator', '/dashboard/researcher'].some(p => location.pathname === p) ? 'gn__link--active' : isActive && link.label !== 'Dashboard' ? 'gn__link--active' : ''}`}
                >
                  {link.label}
                </NavLink>
              )
            })}
          </div>

          {/* Right side: theme + auth */}
          <div className="gn__right">
            {/* Live Search Trigger */}
            <button
              type="button"
              className="gn__search-trigger"
              onClick={() => setSearchModalOpen(true)}
              title="Search Live Fares & Flights (Ctrl+K)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface, rgba(255, 255, 255, 0.05))',
                color: 'var(--color-text)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🔍</span>
              <span className="hidden sm:inline">Search</span>
              <kbd style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-secondary)',
              }}>
                ⌘K
              </kbd>
            </button>

            {/* Theme toggle */}
            <button
              className="gn__theme-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {/* Auth controls */}
            {!loading && (
              isAuthenticated ? (
                /* Logged-in: user dropdown */
                <div className="gn__user" ref={dropdownRef}>
                  <button
                    className="gn__user-btn"
                    onClick={() => setDropdownOpen(prev => !prev)}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <div className="gn__avatar">{userInitial}</div>
                    <span className="gn__user-email">{user?.email}</span>
                    {profile?.role && ROLE_META[profile.role] && (
                      <Link
                        to="/dashboard/settings"
                        title="Change role in Settings"
                        onClick={() => setDropdownOpen(false)}
                        style={{
                          fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px',
                          borderRadius: '5px', whiteSpace: 'nowrap', textDecoration: 'none',
                          color: ROLE_META[profile.role].color,
                          background: `${ROLE_META[profile.role].color}18`,
                          border: `1px solid ${ROLE_META[profile.role].color}30`,
                        }}
                      >
                        {ROLE_META[profile.role].icon} {ROLE_META[profile.role].label}
                      </Link>
                    )}
                    <svg className={`gn__chevron ${dropdownOpen ? 'gn__chevron--open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="gn__dropdown">
                      {/* Role header */}
                      {profile?.role && ROLE_META[profile.role] && (
                        <div style={{
                          padding: '0.5rem 0.875rem 0.4rem',
                          fontSize: '0.65rem', fontWeight: 700,
                          color: ROLE_META[profile.role].color,
                          borderBottom: '1px solid var(--color-border)',
                          marginBottom: '0.25rem',
                        }}>
                          {ROLE_META[profile.role].icon} {ROLE_META[profile.role].label}
                          <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>role</span>
                        </div>
                      )}
                      <Link to={dashboardLink} className="gn__dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                        </svg>
                        My Dashboard
                      </Link>
                      <Link to="/dashboard/settings" className="gn__dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </Link>
                      <div className="gn__dropdown-divider" />
                      <button className="gn__dropdown-item gn__dropdown-item--danger" onClick={handleLogout}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Logged-out: Log In + Sign Up buttons */
                <div className="gn__auth-buttons">
                  <button className="gn__login-btn" onClick={() => onOpenAuthModal('login')}>
                    Log In
                  </button>
                  <button className="gn__signup-btn" onClick={() => onOpenAuthModal('signup')}>
                    Sign Up
                  </button>
                </div>
              )
            )}

            {/* Mobile hamburger */}
            <button
              className="gn__hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ==================== MOBILE MENU ==================== */}
      {mobileOpen && (
        <div className="gn-mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <div className={`gn-mobile ${mobileOpen ? 'gn-mobile--open' : ''}`}>
        <div className="gn-mobile__header">
          <Link to="/" className="gn__logo" onClick={() => setMobileOpen(false)}>
            <div className="gn__logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1D1D1B" stroke="none">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
            <span className="gn__logo-text">Aerogin</span>
          </Link>
          <button className="gn-mobile__close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="gn-mobile__links">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className="gn-mobile__link"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="gn-mobile__footer">
          {/* Theme toggle */}
          <div className="gn-mobile__theme">
            <span>{theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" />
          </div>

          {/* Auth */}
          {!loading && (
            isAuthenticated ? (
              <div className="gn-mobile__user">
                <div className="gn-mobile__user-info">
                  <div className="gn__avatar">{userInitial}</div>
                  <div>
                    <span style={{ display: 'block' }}>{user?.email}</span>
                    {profile?.role && ROLE_META[profile.role] && (
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700,
                        color: ROLE_META[profile.role].color,
                      }}>
                        {ROLE_META[profile.role].icon} {ROLE_META[profile.role].label}
                      </span>
                    )}
                  </div>
                </div>
                <Link to={dashboardLink} className="gn-mobile__link" onClick={() => setMobileOpen(false)}>My Dashboard</Link>
                <Link to="/dashboard/settings" className="gn-mobile__link" onClick={() => setMobileOpen(false)}>Settings</Link>
                <button className="gn-mobile__logout" onClick={() => { handleLogout(); setMobileOpen(false) }}>
                  Log Out
                </button>
              </div>
            ) : (
              <div className="gn-mobile__auth">
                <button className="gn__signup-btn" style={{ width: '100%' }} onClick={() => { onOpenAuthModal('signup'); setMobileOpen(false) }}>
                  Sign Up
                </button>
                <button className="gn__login-btn" style={{ width: '100%' }} onClick={() => { onOpenAuthModal('login'); setMobileOpen(false) }}>
                  Log In
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <GlobalLiveSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </>
  )
}
