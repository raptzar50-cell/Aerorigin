import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Layout from './components/Layout'
import RoleLandingRedirect from './components/RoleLandingRedirect'
import HomePage from './pages/HomePage'
import Overview from './pages/Overview'
import EconomistDashboard from './pages/EconomistDashboard'
import RegulatorDashboard from './pages/RegulatorDashboard'
import ResearcherDashboard from './pages/ResearcherDashboard'
import RouteDetail from './pages/RouteDetail'
import DataQuality from './pages/DataQuality'
import TrendsComparison from './pages/TrendsComparison'
import LiveFlights from './pages/LiveFlights'
import SettingsPage from './pages/SettingsPage'
import ApiAccessPage from './pages/ApiAccessPage'
import ForecastPage from './pages/ForecastPage'
import ExportPage from './pages/ExportPage'
import ApiDocsPage from './pages/ApiDocsPage'
import ScraperPanel from './components/ScraperPanel'
import PredictionTable from './components/PredictionTable'

function App() {
  return (
    <AppShell>
      <Routes>
        {/* Public pages — no sidebar */}
        <Route path="/" element={<HomePage />} />

        {/* /dashboard → smart redirect to role-specific landing page */}
        <Route path="/dashboard" element={<Layout><RoleLandingRedirect /></Layout>} />

        {/* Role-specific landing pages */}
        <Route path="/dashboard/economist"  element={<Layout><EconomistDashboard /></Layout>} />
        <Route path="/dashboard/regulator"  element={<Layout><RegulatorDashboard /></Layout>} />
        <Route path="/dashboard/researcher" element={<Layout><ResearcherDashboard /></Layout>} />

        {/* Shared pages — accessible to all roles via sidebar */}
        <Route path="/dashboard/overview"           element={<Layout><Overview /></Layout>} />
        <Route path="/dashboard/routes/:routeCode"  element={<Layout><RouteDetail /></Layout>} />
        <Route path="/dashboard/quality"            element={<Layout><DataQuality /></Layout>} />
        <Route path="/dashboard/compare"            element={<Layout><TrendsComparison /></Layout>} />
        <Route path="/dashboard/flights"            element={<Layout><LiveFlights /></Layout>} />
        <Route path="/live-flights"                 element={<Layout><LiveFlights /></Layout>} />
        <Route path="/flights"                      element={<Navigate to="/dashboard/flights" replace />} />
        <Route path="/dashboard/forecast"           element={<Layout><ForecastPage /></Layout>} />
        <Route path="/dashboard/export"             element={<Layout><ExportPage /></Layout>} />
        <Route path="/dashboard/api-docs"           element={<Layout><ApiDocsPage /></Layout>} />
        <Route path="/dashboard/api-access"         element={<Layout><ApiAccessPage /></Layout>} />
        <Route path="/dashboard/settings"           element={<Layout><SettingsPage /></Layout>} />
        <Route path="/dashboard/scraper"            element={<Layout><ScraperPanel /></Layout>} />
        <Route path="/dashboard/predictions-table"  element={<Layout><PredictionTable /></Layout>} />
      </Routes>
    </AppShell>
  )
}

export default App

