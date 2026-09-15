import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ComposedChart, Area, AreaChart, Line, ReferenceLine,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { fetchRoutes, fetchIndex, fetchLeadTimeTrends, fetchFlightsForRoute, fetchIndexForecast } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import ChartCard from '../components/ChartCard'
import PeriodToggle from '../components/PeriodToggle'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
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

const formatTime = (iso) => {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return typeof iso === 'string' && iso.includes('T') ? iso.split('T')[1].slice(0, 5) : String(iso)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return String(iso || '-')
  }
}

// Mantis Theme Color Palette for Lead Time
const LEAD_TIME_COLORS = ['#FF4D4F', '#FAAD14', '#1677FF', '#52C41A']
const STATUS_LABELS = { scheduled: 'Scheduled', active: 'Active / En Route', en_route: 'En Route', landed: 'Landed', delayed: 'Delayed', cancelled: 'Cancelled' }

export default function RouteDetail() {
  const { routeCode } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, profile, updateProfile } = useAuth()
  const [routes, setRoutes] = useState([])
  const [indexData, setIndexData] = useState([])
  const [leadTimeData, setLeadTimeData] = useState([])
  const [flights, setFlights] = useState([])
  const [period, setPeriod] = useState('daily')
  const [loading, setLoading] = useState(true)
  const [ltLoading, setLtLoading] = useState(true)
  const [flightLoading, setFlightLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [forecastData, setForecastData] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)

  useEffect(() => {
    fetchRoutes().then(setRoutes).catch(console.error)
  }, [])

  useEffect(() => {
    if (!routeCode) return
    setLoading(true)
    fetchIndex({ route: routeCode, period })
      .then(data => { setIndexData(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [routeCode, period])

  useEffect(() => {
    if (!routeCode) return
    setLtLoading(true)
    fetchLeadTimeTrends(routeCode)
      .then(data => { setLeadTimeData(data); setLtLoading(false) })
      .catch(err => { console.error(err); setLtLoading(false) })
  }, [routeCode])

  // Fetch Chronos-2 index forecast for this route
  useEffect(() => {
    if (!routeCode) return
    setForecastLoading(true)
    fetchIndexForecast(routeCode)
      .then(data => { setForecastData(data); setForecastLoading(false) })
      .catch(() => setForecastLoading(false))
  }, [routeCode])

  // Fetch live flights for this route
  useEffect(() => {
    if (!routeCode) return
    const [origin, dest] = routeCode.split('-')
    if (!origin || !dest) return
    setFlightLoading(true)
    fetchFlightsForRoute(origin, dest)
      .then(data => { setFlights(Array.isArray(data) ? data : []); setFlightLoading(false) })
      .catch(() => { setFlights([]); setFlightLoading(false) })
  }, [routeCode])

  // Check if route is saved in dashboard preferences
  useEffect(() => {
    if (profile?.dashboard_preferences?.pinned_routes) {
      setSaved(profile.dashboard_preferences.pinned_routes.includes(routeCode))
    }
  }, [profile, routeCode])

  const handleSaveRoute = async () => {
    if (!isAuthenticated) return
    const currentPinned = profile?.dashboard_preferences?.pinned_routes || []
    const newPinned = saved
      ? currentPinned.filter(r => r !== routeCode)
      : [...currentPinned, routeCode]
    await updateProfile({ dashboard_preferences: { pinned_routes: newPinned } })
    setSaved(!saved)
  }

  const currentRoute = routes.find(r => r.route === routeCode)
  const [origin, destination] = (routeCode || '').split('-')

  // Build unified historical + forecast chart data
  const historicalPoints = indexData.map(d => ({
    date: d.index_date,
    historical: parseFloat(d.index_value),
    avg_fare: parseFloat(d.avg_fare),
  }))

  const forecastPoints = (forecastData?.forecasts || []).map(f => ({
    date: f.forecast_date,
    predicted: parseFloat(f.predicted_index),
    lower: parseFloat(f.lower_bound),
    upper: parseFloat(f.upper_bound),
    // confidence band extent = [lower, upper-lower] for stacked area trick
    bandBase: parseFloat(f.lower_bound),
    bandRange: parseFloat(f.upper_bound) - parseFloat(f.lower_bound),
  }))

  // Merge: historical first, then forecast. Mark the handoff date.
  const lastHistoricalDate = historicalPoints.length > 0
    ? historicalPoints[historicalPoints.length - 1].date
    : null

  const combinedData = [
    ...historicalPoints,
    ...forecastPoints,
  ]

  const hasForecast = forecastPoints.length > 0
  const cpiNote = forecastData?.summary?.cpi_impact_note || ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Route Analytics: {routeCode || 'All Routes'}</h1>
          <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
            Historical index trends, Chronos-2 forward forecast, and booking lead-time elasticity
          </p>
        </div>
      </div>

      {/* Route Selector */}
      <div className="card p-5 animate-fade-in-up">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                  style={{background: 'var(--color-brand-yellow)', color: 'var(--color-brand-dark)'}}>
              {origin || '---'}
            </span>
            <svg className="w-5 h-5" style={{color: 'var(--color-text-light)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                  style={{background: 'var(--color-brand-yellow)', color: 'var(--color-brand-dark)'}}>
              {destination || '---'}
            </span>
          </div>

          <select
            value={routeCode}
            onChange={(e) => navigate(`/dashboard/routes/${e.target.value}`)}
            className="input-field text-sm w-auto"
            style={{ maxWidth: 250 }}
          >
            {routes.map(r => (
              <option key={r.route} value={r.route}>
                {r.route} ({formatINR(r.avg_fare)} avg)
              </option>
            ))}
          </select>

          {isAuthenticated && (
            <button onClick={handleSaveRoute} className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5">
              {saved ? '★ Saved' : '☆ Save Route'}
            </button>
          )}
        </div>
      </div>

      {/* Route Stats (AdminKit grid rhythm + Mantis sparklines) */}
      {currentRoute && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            title="Current Index"
            value={currentRoute.latest_index ? parseFloat(currentRoute.latest_index).toFixed(1) : '-'}
            icon={<svg className="w-4 h-4 text-[#13C2C2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            delay={80}
          />
          <StatCard
            title="Average Fare"
            value={formatINR(currentRoute.avg_fare)}
            icon={<svg className="w-4 h-4 text-[#1677FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            delay={160}
          />
          <StatCard
            title="Total Observations"
            value={currentRoute.total_observations?.toLocaleString()}
            icon={<svg className="w-4 h-4 text-[#52C41A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            delay={240}
          />
        </div>
      )}

      {/* Index Chart — Historical + Forecast Overlay (Mantis Visual Styling) */}
      <ChartCard
        title={`Price Index — ${routeCode}`}
        subtitle={
          hasForecast
            ? 'Solid line: Historical · Dashed line: Chronos-2 Forecast · Shaded: 80% confidence interval'
            : 'Route-specific CPI-style index (Base Period = 100)'
        }
        delay={300}
        actions={<PeriodToggle value={period} onChange={setPeriod} />}
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={combinedData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="routeHistGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-mantis-secondary, #13C2C2)" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="var(--color-mantis-secondary, #13C2C2)" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="confBandRoute" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-mantis-purple, #722ED1)" stopOpacity={0.20}/>
                    <stop offset="95%" stopColor="var(--color-mantis-purple, #722ED1)" stopOpacity={0.04}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  stroke="var(--color-border)"
                />
                <YAxis
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  stroke="var(--color-border)"
                />
                <Tooltip
                  content={
                    <MantisChartTooltip
                      labelFormatter={(l) => new Date(l).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      valueFormatter={(value, name) => {
                        const val = parseFloat(value).toFixed(2)
                        if (name === 'historical') return `${val} (Historical)`
                        if (name === 'predicted') return `${val} (Forecast)`
                        if (name === 'upper') return `${val} (90th Pct)`
                        if (name === 'lower') return `${val} (10th Pct)`
                        return val
                      }}
                    />
                  }
                />
                {hasForecast && <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  formatter={(value) => {
                    if (value === 'historical') return 'Historical Route Index'
                    if (value === 'predicted') return 'Forecast (Chronos-2)'
                    if (value === 'upper') return '80% Confidence Range'
                    return value
                  }}
                />}

                {/* Historical: solid cyan line with Mantis gradient fill */}
                <Area
                  type="monotone"
                  name="historical"
                  dataKey="historical"
                  stroke="var(--color-mantis-secondary, #13C2C2)"
                  strokeWidth={2.5}
                  fill="url(#routeHistGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--color-mantis-secondary, #13C2C2)', stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls
                />

                {/* Confidence band: upper boundary */}
                {hasForecast && <Area
                  type="monotone"
                  name="upper"
                  dataKey="upper"
                  stroke="var(--color-mantis-purple, #722ED1)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="url(#confBandRoute)"
                  dot={false}
                  connectNulls
                />}
                {/* Confidence band: lower boundary */}
                {hasForecast && <Area
                  type="monotone"
                  name="lower"
                  dataKey="lower"
                  stroke="var(--color-mantis-purple, #722ED1)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="transparent"
                  dot={false}
                  connectNulls
                  legendType="none"
                />}

                {/* Forecast: dashed line with Mantis purple */}
                {hasForecast && <Line
                  type="monotone"
                  name="predicted"
                  dataKey="predicted"
                  stroke="var(--color-mantis-purple, #722ED1)"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--color-mantis-purple, #722ED1)', stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls
                />}

                {/* Handoff reference line */}
                {hasForecast && lastHistoricalDate && (
                  <ReferenceLine
                    x={lastHistoricalDate}
                    stroke="rgba(255,230,0,0.5)"
                    strokeDasharray="4 3"
                    label={{
                      value: 'Forecast →',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: '#FFE600',
                      fontWeight: 600,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Forecast data-source note */}
            {hasForecast && (
              <div style={{
                display: 'flex', gap: '1rem', flexWrap: 'wrap',
                padding: '0.5rem 0.25rem', marginTop: '0.25rem',
                fontSize: '0.7rem', color: 'var(--color-text-secondary)',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 20, height: 2, background: '#00A5B5' }} />
                  Historical
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    display: 'inline-block', width: 20, height: 2,
                    background: '#3b82f6', borderTop: '2px dashed #3b82f6',
                  }} />
                  Chronos-2 Forecast
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    display: 'inline-block', width: 14, height: 10,
                    background: 'rgba(59,130,246,0.15)', borderRadius: 2,
                  }} />
                  80% Confidence Interval
                </span>
              </div>
            )}
          </>
        )}
      </ChartCard>

      {/* CPI Impact Note — shown directly below the forecast chart */}
      {cpiNote && (
        <div className="card p-4 animate-fade-in-up" style={{
          borderLeft: '3px solid var(--color-brand-yellow)',
          animationDelay: '350ms',
        }}>
          <p className="text-xs" style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
            💡 Illustrative CPI Relevance
            <span style={{ fontWeight: 400, marginLeft: 6, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
              (illustrative note — not a formal CPI revision estimate)
            </span>
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
            {cpiNote}
          </p>
        </div>
      )}

      {/* Lead-Time Elasticity */}
      <ChartCard title="Lead-Time Elasticity" subtitle="How fare varies by booking advance" delay={400}>
        {ltLoading ? (
          <LoadingSpinner />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={leadTimeData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
              <XAxis dataKey="bucket_label" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)"
                     tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip
                content={
                  <MantisChartTooltip
                    valueFormatter={(v) => formatINR(v)}
                    labelFormatter={(l) => `Advance Window: ${l}`}
                  />
                }
              />
              <Bar dataKey="avg_fare" radius={[6, 6, 0, 0]} barSize={48}>
                {leadTimeData.map((_, i) => (
                  <Cell key={i} fill={LEAD_TIME_COLORS[i % LEAD_TIME_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex flex-wrap gap-4 px-2 pt-2">
          {leadTimeData.map((bucket, i) => (
            <div key={bucket.bucket} className="flex items-center gap-2 text-xs" style={{color: 'var(--color-text-secondary)'}}>
              <span className="w-3 h-3 rounded-sm" style={{background: LEAD_TIME_COLORS[i]}} />
              <span>{bucket.bucket_label}: {formatINR(bucket.avg_fare)}</span>
              <span style={{color: 'var(--color-text-light)'}}>({bucket.sample_size?.toLocaleString()} obs)</span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Live Flights for this Route */}
      <div className="card p-6 animate-fade-in-up" style={{animationDelay: '500ms'}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">
              ✈️ Live Flights — {routeCode}
            </h3>
            <p className="text-xs sm:text-sm mt-0.5" style={{color: 'var(--color-text-secondary)'}}>
              Real-time flight status for this route powered by live flight operations feed
            </p>
          </div>
        </div>

        {flightLoading ? (
          <LoadingSpinner />
        ) : flights.length === 0 ? (
          <p className="text-sm" style={{color: 'var(--color-text-light)'}}>No flights found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Flight</th>
                  <th>Airline</th>
                  <th>Departure</th>
                  <th>Arrival</th>
                  <th>Status</th>
                  <th>Aircraft</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((f, i) => (
                  <tr key={`${f.flight_number}-${i}`}>
                    <td className="font-medium">{f.flight_number}</td>
                    <td>{f.airline}</td>
                    <td>
                      <span>{formatTime(f.scheduled_departure)}</span>
                      {f.gate && <span className="text-xs ml-1" style={{color: 'var(--color-text-light)'}}>Gate {f.gate}</span>}
                    </td>
                    <td>{formatTime(f.scheduled_arrival)}</td>
                    <td>
                      <span className={`badge status-${f.status}`}>
                        {STATUS_LABELS[f.status] || f.status}
                        {f.delay_minutes > 0 && ` (+${f.delay_minutes}m)`}
                      </span>
                    </td>
                    <td className="text-xs" style={{color: 'var(--color-text-secondary)'}}>{f.aircraft_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
