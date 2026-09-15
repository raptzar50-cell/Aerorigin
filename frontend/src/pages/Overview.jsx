import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { fetchStats, fetchIndex, fetchRoutes, fetchIndexForecast, exportIndex } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { ProvenanceSummary } from '../components/DataProvenanceBadge'
import StatCard from '../components/StatCard'
import ChartCard from '../components/ChartCard'
import PeriodToggle from '../components/PeriodToggle'
import LoadingSpinner from '../components/LoadingSpinner'
import RoleSwitcher from '../components/RoleSwitcher'
import MantisChartTooltip from '../components/MantisChartTooltip'

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

const formatINR = (val) => {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(val)
}

/**
 * Role-adaptive widget ordering.
 * All widgets are always rendered — the role determines which appear FIRST.
 */
const WIDGET_ORDER = {
  economist: ['stats', 'index_chart', 'provenance', 'routes', 'forecast_preview'],
  regulator: ['stats', 'anomaly_summary', 'provenance', 'index_chart', 'routes'],
  researcher: ['stats', 'model_info', 'provenance', 'forecast_preview', 'index_chart', 'routes'],
}

export default function Overview() {
  const { isAuthenticated, profile, role } = useAuth()
  const [stats, setStats] = useState(null)
  const [indexData, setIndexData] = useState([])
  const [routes, setRoutes] = useState([])
  const [period, setPeriod] = useState('daily')
  const [loading, setLoading] = useState(true)
  const [forecastPreview, setForecastPreview] = useState(null)

  useEffect(() => {
    Promise.all([fetchStats(), fetchRoutes()])
      .then(([s, r]) => { setStats(s); setRoutes(r) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchIndex({ period })
      .then(data => { setIndexData(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [period])

  useEffect(() => {
    fetchIndexForecast()
      .then(setForecastPreview)
      .catch(() => {})
  }, [])

  const currentRole = role || 'researcher'
  const provenance = stats?.data_provenance

  // Render widgets in role-determined order
  let widgetOrder = WIDGET_ORDER[currentRole] || WIDGET_ORDER.researcher

  if (currentRole === 'custom') {
    widgetOrder = profile?.dashboard_preferences?.custom_panels || []
  }

  const widgets = {
    stats: (
      <div key="stats" className="space-y-4">
        {/* Role indicator */}
        {isAuthenticated && (
          <div className="card p-4 animate-fade-in-up"
               style={{background: 'linear-gradient(135deg, rgba(255,230,0,0.08), rgba(0,165,181,0.05))'}}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold" style={{color: 'var(--color-text)'}}>
                  {profile?.display_name || profile?.email?.split('@')[0] || 'Stakeholder'} Dashboard
                </h2>
                <p className="text-xs mt-1" style={{color: 'var(--color-text-secondary)'}}>
                  Viewing as: <strong>{profile?.role_label || currentRole}</strong> — widgets ordered for your workflow
                </p>
              </div>
              <RoleSwitcher compact />
            </div>
          </div>
        )}

        {/* Headline Stats (AdminKit 4-column Grid) */}
        <div className="adminkit-grid-4">
          <StatCard
            title="National Index"
            value={stats ? parseFloat(stats.current_index).toFixed(1) : null}
            change={stats?.index_change_7d}
            changeLabel="vs 7d baseline"
            icon={<svg className="w-4 h-4 text-[#1677FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            delay={0}
          />
          <StatCard
            title="7-Day Change"
            value={stats?.index_change_7d != null ? `${stats.index_change_7d > 0 ? '+' : ''}${stats.index_change_7d}%` : null}
            change={stats?.index_change_7d}
            changeLabel="vs last week"
            delay={80}
          />
          <StatCard
            title="30-Day Change"
            value={stats?.index_change_30d != null ? `${stats.index_change_30d > 0 ? '+' : ''}${stats.index_change_30d}%` : null}
            change={stats?.index_change_30d}
            changeLabel="vs last month"
            delay={160}
          />
          <StatCard
            title="Routes Tracked"
            value={stats ? stats.total_routes : null}
            icon={<svg className="w-4 h-4 text-[#52C41A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
            delay={240}
          />
        </div>
      </div>
    ),

    index_chart: (
      <ChartCard
        key="index_chart"
        title="National Airfare Price Index"
        subtitle="CPI-style index — Base: 100 = average fare in base period"
        delay={300}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <PeriodToggle value={period} onChange={setPeriod} />
            {isAuthenticated && (
              <>
                <button
                  onClick={() => exportIndex({ format: 'csv', period })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem',
                    fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-secondary)',
                    transition: 'all 0.15s',
                  }}
                  title="Export index data as CSV"
                >
                  ⬇ CSV
                </button>
                <button
                  onClick={() => exportIndex({ format: 'json', period })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem',
                    fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-secondary)',
                    transition: 'all 0.15s',
                  }}
                  title="Export index data as JSON"
                >
                  ⬇ JSON
                </button>
              </>
            )}
          </div>
        }
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={indexData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="indexGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-mantis-primary, #1677FF)" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="var(--color-mantis-primary, #1677FF)" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
              <XAxis dataKey="index_date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <Tooltip
                content={
                  <MantisChartTooltip
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                    valueFormatter={(value) => `${parseFloat(value).toFixed(2)} pts`}
                  />
                }
              />
              <Area
                type="monotone"
                name="Index Value"
                dataKey="index_value"
                stroke="var(--color-mantis-primary, #1677FF)"
                strokeWidth={2.5}
                fill="url(#indexGradient)"
                dot={false}
                activeDot={{ r: 5, fill: 'var(--color-mantis-primary, #1677FF)', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),

    provenance: provenance ? (
      <div key="provenance" className="animate-fade-in-up" style={{animationDelay: '350ms'}}>
        <ProvenanceSummary provenance={provenance} />
      </div>
    ) : null,

    anomaly_summary: (
      <div key="anomaly_summary" className="card p-5 animate-fade-in-up" style={{animationDelay: '280ms'}}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>
            🔍 Anomaly Detection Overview
          </h3>
          <Link to="/dashboard/quality" className="text-xs font-medium no-underline"
                style={{color: 'var(--color-brand-yellow)'}}>
            View Full Report →
          </Link>
        </div>
        <p className="text-xs" style={{color: 'var(--color-text-secondary)', marginBottom: '0.5rem'}}>
          Flagged fare records that may indicate unusual pricing behavior across carriers/routes.
          Full details available in the Data Quality section.
        </p>
        <div className="flex gap-4 flex-wrap">
          <div className="stat-card" style={{flex: 1, minWidth: 120}}>
            <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>Total Observations</p>
            <p className="text-xl font-bold" style={{color: 'var(--color-text)'}}>{stats?.total_observations?.toLocaleString() || '-'}</p>
          </div>
          <div className="stat-card" style={{flex: 1, minWidth: 120}}>
            <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>Routes Monitored</p>
            <p className="text-xl font-bold" style={{color: 'var(--color-text)'}}>{stats?.total_routes || '-'}</p>
          </div>
        </div>
      </div>
    ),

    model_info: (
      <div key="model_info" className="card p-5 animate-fade-in-up" style={{animationDelay: '280ms'}}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>
            🔬 Model & Data Overview
          </h3>
          <div className="flex gap-2">
            <Link to="/dashboard/quality" className="text-xs font-medium no-underline"
                  style={{color: 'var(--color-brand-yellow)'}}>
              Model Metrics →
            </Link>
            <Link to="/dashboard/api-docs" className="text-xs font-medium no-underline"
                  style={{color: 'var(--color-text-secondary)'}}>
              API Docs →
            </Link>
          </div>
        </div>
        <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>
          Anomaly detection: PyOD (ECOD) · Forecasting: Chronos-2 (zero-shot) ·
          {stats?.total_observations?.toLocaleString() || '0'} observations across {stats?.total_routes || '0'} routes
        </p>
      </div>
    ),

    forecast_preview: forecastPreview?.forecasts?.length > 0 ? (
      <div key="forecast_preview" className="card p-5 animate-fade-in-up" style={{animationDelay: '380ms'}}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>
            📈 Index Forecast Preview (National)
          </h3>
          <Link to="/dashboard/forecast" className="text-xs font-medium no-underline"
                style={{color: 'var(--color-brand-yellow)'}}>
            Full Forecast →
          </Link>
        </div>
        {forecastPreview.summary && (
          <div className="flex gap-4 mb-3">
            <div>
              <span className="text-xs" style={{color: 'var(--color-text-secondary)'}}>Projected Change</span>
              <p className="text-lg font-bold" style={{
                color: forecastPreview.summary.projected_change_pct > 0 ? 'var(--color-danger)' : 'var(--color-success)'
              }}>
                {forecastPreview.summary.projected_change_pct > 0 ? '+' : ''}
                {forecastPreview.summary.projected_change_pct}%
              </p>
            </div>
          </div>
        )}
      </div>
    ) : null,

    routes: (
      <div key="routes">
        <h3 className="text-sm font-semibold mb-4" style={{color: 'var(--color-text)'}}>
          Routes Overview
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route, i) => (
            <Link
              key={route.route}
              to={`/dashboard/routes/${route.route}`}
              className="stat-card animate-fade-in-up block no-underline"
              style={{ animationDelay: `${500 + i * 60}ms`, textDecoration: 'none' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{background: 'var(--color-brand-yellow)', color: 'var(--color-brand-dark)'}}>
                    {route.origin}
                  </span>
                  <svg className="w-4 h-4" style={{color: 'var(--color-text-light)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{background: 'var(--color-brand-yellow)', color: 'var(--color-brand-dark)'}}>
                    {route.destination}
                  </span>
                </div>
                <svg className="w-4 h-4" style={{color: 'var(--color-text-light)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>Index</p>
                  <p className="text-xl font-bold" style={{color: 'var(--color-text)'}}>
                    {route.latest_index ? parseFloat(route.latest_index).toFixed(1) : '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>Avg Fare</p>
                  <p className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>
                    {formatINR(route.avg_fare)}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2" style={{borderTop: '1px solid var(--color-border)'}}>
                <p className="text-xs" style={{color: 'var(--color-text-light)'}}>
                  {route.total_observations?.toLocaleString()} observations
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    ),
  }

  return (
    <div className="space-y-6">
      {/* We always render the role header/stats block as part of 'stats', but if stats is not in widgetOrder, we should probably render the header manually, or the user can just toggle it. For now, just render whatever is in widgetOrder. */}
      {currentRole === 'custom' && widgetOrder.length === 0 && (
        <div className="card p-10 text-center animate-fade-in-up" style={{
          background: 'var(--color-bg-card)', borderRadius: '16px', border: '1px solid var(--color-border)'
        }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>Your Custom Dashboard is Empty</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            You haven't selected any panels to display yet. Click the "Configure" button in the role switcher to customize your view.
          </p>
          <RoleSwitcher compact />
        </div>
      )}
      {widgetOrder.map(key => widgets[key]).filter(Boolean)}
    </div>
  )
}
