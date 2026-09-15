import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import GlobalLiveSearchModal from './GlobalLiveSearchModal'

// AdminKit-structured Navigation Groupings
const analyticsNavGroup = [
  {
    to: '/dashboard',
    label: 'Overview',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/dashboard/routes/DEL-BOM',
    label: 'Route Detail',
    matchPath: '/dashboard/routes',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    to: '/dashboard/compare',
    label: 'Compare Trends',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
]

const intelligenceNavGroup = [
  {
    to: '/dashboard/forecast',
    label: 'Index Forecast',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    to: '/dashboard/quality',
    label: 'Data Quality',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    to: '/dashboard/flights',
    label: 'Flight Radar',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
]

const stakeholderNavGroup = [
  {
    to: '/dashboard/export',
    label: 'Data Export',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
  {
    to: '/dashboard/scraper',
    label: 'Live Scraper Engine',
    roles: ['economist', 'regulator', 'researcher'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/dashboard/predictions-table',
    label: 'Fare Predictions',
    roles: ['economist', 'researcher'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    to: '/dashboard/api-access',
    label: 'API Access',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    to: '/dashboard/api-docs',
    label: 'API Docs',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    to: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const ROLE_LABELS = {
  economist:  '📊 Economist',
  regulator:  '🔍 Regulator',
  researcher: '🔬 Researcher',
}

const ROLE_COLORS = {
  economist:  { fg: '#F5A623', bg: 'rgba(245,166,35,0.12)',  border: 'rgba(245,166,35,0.3)'  },
  regulator:  { fg: '#00A5B5', bg: 'rgba(0,165,181,0.12)',   border: 'rgba(0,165,181,0.3)'   },
  researcher: { fg: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)'  },
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, role, profile, logout } = useAuth()
  const { theme } = useTheme()

  // Dynamically resolve Overview route based on role
  const ROLE_DASHBOARD_PATHS = {
    economist:  '/dashboard/economist',
    regulator:  '/dashboard/regulator',
    researcher: '/dashboard/researcher',
  }
  const overviewLink = (isAuthenticated && role && ROLE_DASHBOARD_PATHS[role])
    ? ROLE_DASHBOARD_PATHS[role]
    : '/dashboard'

  // Replace overview 'to' with role landing
  const runtimeAnalyticsGroup = analyticsNavGroup.map(item =>
    item.label === 'Overview' ? { ...item, to: overviewLink } : item
  )

  const allNavItems = [
    { to: '/dashboard/economist',  label: 'Economist Dashboard', group: 'Analytics' },
    { to: '/dashboard/regulator',  label: 'Regulator Oversight', group: 'Analytics' },
    { to: '/dashboard/researcher', label: 'Researcher Portal',   group: 'Analytics' },
    { to: '/dashboard/overview',   label: 'Overview',            group: 'Analytics' },
    ...runtimeAnalyticsGroup.map(item => ({ ...item, group: 'Pages & Dashboards' })),
    ...intelligenceNavGroup.map(item => ({ ...item, group: 'Intelligence' })),
    ...stakeholderNavGroup.map(item => ({ ...item, group: 'Stakeholder Tools' })),
  ]

  const activeItem = allNavItems.find(n =>
    n.matchPath ? location.pathname.startsWith(n.matchPath) : location.pathname === n.to
  ) || { label: 'Dashboard', group: 'Analytics' }

  const renderNavGroup = (title, items) => (
    <div className="mb-4">
      <div className="px-5 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
          {title}
        </span>
      </div>
      <div className="space-y-1 px-3">
        {items.map((item) => {
          const isOverview = item.label === 'Overview'
          const isActive = isOverview
            ? (location.pathname === item.to || (item.to === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/dashboard/overview')))
            : (item.matchPath
                ? location.pathname.startsWith(item.matchPath)
                : location.pathname === item.to)

          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={isOverview}
              onClick={() => setSidebarOpen(false)}
              className={() => `
                relative flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-white/12 text-white font-semibold shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-[#FFE600] before:rounded-r'
                  : 'text-white/60 hover:text-white hover:bg-white/6'
                }
              `}
            >
              <span className={isActive ? 'text-[#FFE600]' : 'text-white/60'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* AdminKit-Style Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''} flex flex-col justify-between`}
        style={{
          background: 'var(--color-sidebar, #1D1D1B)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <div>
          {/* Logo & Brand Section */}
          <div className="px-5 py-5 flex items-center justify-between border-b border-white/8">
            <Link to="/" className="flex items-center gap-3 no-underline">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs"
                style={{ background: '#FFE600' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1D1D1B" stroke="none">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
              </div>
              <div>
                <h1 className="sidebar__logo-text text-white font-bold text-lg tracking-tight">Aerogin</h1>
                <p className="text-[11px] text-white/40 leading-none">Airfare Price Index</p>
              </div>
            </Link>

            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-white/60 hover:text-white p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Role badge context */}
          {isAuthenticated && role && (
            <div className="px-5 pt-3.5 pb-1">
              <div
                className="py-1.5 px-3 rounded-lg text-xs font-semibold text-center tracking-wide"
                style={{
                  background: 'rgba(255,230,0,0.08)',
                  color: 'rgba(255,230,0,0.95)',
                  border: '1px solid rgba(255,230,0,0.18)',
                }}
              >
                {ROLE_LABELS[role] || role} Lens
              </div>
            </div>
          )}

          {/* Grouped Navigation */}
          <nav className="mt-3 flex-1 overflow-y-auto">
            {renderNavGroup('Pages & Dashboards', runtimeAnalyticsGroup)}
            {renderNavGroup('Intelligence', intelligenceNavGroup)}
            {renderNavGroup(
              'Stakeholder Tools',
              stakeholderNavGroup.filter(item => !item.roles || item.roles.includes(role))
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/8">
          <div className="p-3 rounded-xl bg-white/4 border border-white/6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] font-semibold text-white/70">National Airfare Index</p>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">Ministry of Statistics (MoSPI)</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 main-content" style={{ marginLeft: 260 }}>
        {/* AdminKit-Style Top Header Bar */}
        <header
          className="sticky z-30 backdrop-blur-md border-b transition-colors"
          style={{
            top: 64,
            borderColor: 'var(--color-border)',
            background: theme === 'dark' ? 'rgba(15,15,14,0.85)' : 'rgba(255,255,255,0.85)',
          }}
        >
          <div className="flex items-center justify-between px-6 py-3.5">
            {/* Left: Mobile toggle & Breadcrumb Trail */}
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* AdminKit Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-gray-400 dark:text-gray-500 font-medium">Dashboard</span>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {activeItem.label}
                </span>
              </div>
            </div>

            {/* Center: Search Placement (AdminKit style search bar trigger) */}
            <div className="hidden lg:flex items-center max-w-xs w-full mx-4">
              <button
                onClick={() => setSearchModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/60 text-xs text-gray-400 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search routes, flights, fares...</span>
                </div>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-neutral-800 text-gray-600 dark:text-gray-300">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right: Actions, Badges & User Context */}
            <div className="flex items-center gap-3">
              {/* Role badge context */}
              {isAuthenticated && role && ROLE_COLORS[role] && (
                <span
                  className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{
                    color: ROLE_COLORS[role].fg,
                    background: ROLE_COLORS[role].bg,
                    border: `1px solid ${ROLE_COLORS[role].border}`,
                  }}
                >
                  {ROLE_LABELS[role]?.split(' ')[1] || role} Lens
                </span>
              )}

              {/* Live Status indicator */}
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live System
              </div>

              {/* Search button on smaller screens */}
              <button
                onClick={() => setSearchModalOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"
                aria-label="Open search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content: AdminKit standardized spacing */}
        <main className="p-5 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>

      {/* Global Live Search Modal */}
      <GlobalLiveSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  )
}
