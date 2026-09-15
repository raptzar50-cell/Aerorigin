import { useState, useEffect } from 'react'
import {
  ComposedChart, Area, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { fetchIndexForecast, fetchForecastAccuracy, fetchRoutes, fetchIndex } from '../api/client'
import ChartCard from '../components/ChartCard'
import LoadingSpinner from '../components/LoadingSpinner'
import MantisChartTooltip from '../components/MantisChartTooltip'
import StatCard from '../components/StatCard'

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export default function ForecastPage() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState('')
  const [forecast, setForecast] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [historical, setHistorical] = useState([])
  const [loading, setLoading] = useState(true)
  const [accuracyFilter, setAccuracyFilter] = useState('evaluated')

  useEffect(() => {
    fetchRoutes().then(setRoutes).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchIndexForecast(selectedRoute || undefined),
      fetchForecastAccuracy(selectedRoute || undefined),
      fetchIndex({ route: selectedRoute || undefined, period: 'daily' }),
    ])
      .then(([f, a, hist]) => { setForecast(f); setAccuracy(a); setHistorical(Array.isArray(hist) ? hist : []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedRoute])

  // Build unified chart data: historical solid line + forecast dashed + confidence band
  const historicalPoints = historical.map(d => ({
    date: d.index_date,
    historical: parseFloat(d.index_value),
  }))

  const forecastPoints = (forecast?.forecasts || []).map(f => ({
    date: f.forecast_date,
    predicted: parseFloat(f.predicted_index),
    upper: parseFloat(f.upper_bound),
    lower: parseFloat(f.lower_bound),
  }))

  const combinedData = [...historicalPoints, ...forecastPoints]

  const lastHistoricalDate = historicalPoints.length > 0
    ? historicalPoints[historicalPoints.length - 1].date
    : null

  const hasForecast = forecastPoints.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{color: 'var(--color-text)'}}>
            📈 Price Index Forecast
          </h1>
          <p className="text-xs mt-1" style={{color: 'var(--color-text-secondary)'}}>
            Chronos-2 probabilistic forecast of the airfare price index with confidence intervals
          </p>
        </div>
        <select
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
          style={{
            padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
            color: 'var(--color-text)',
          }}
        >
          <option value="">National Aggregate</option>
          {routes.map(r => (
            <option key={r.route} value={r.route}>{r.route}</option>
          ))}
        </select>
      </div>

      {/* Summary cards (AdminKit grid rhythm + Mantis sparklines) */}
      {forecast?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-fade-in-up">
          <StatCard
            title="Start Index"
            value={forecast.summary.start_index?.toFixed(1) || '-'}
            icon={<svg className="w-4 h-4 text-[#1677FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            delay={0}
          />
          <StatCard
            title="End Index (Projected)"
            value={forecast.summary.end_index?.toFixed(1) || '-'}
            icon={<svg className="w-4 h-4 text-[#722ED1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            delay={80}
          />
          <StatCard
            title="Projected Change"
            value={forecast.summary.projected_change_pct != null ? `${forecast.summary.projected_change_pct > 0 ? '+' : ''}${forecast.summary.projected_change_pct}%` : '-'}
            change={forecast.summary.projected_change_pct}
            changeLabel="overall shift"
            delay={160}
          />
        </div>
      )}

      {/* Forecast chart: Historical + Forecast unified (Mantis Chart Styling) */}
      <ChartCard
        title={`${selectedRoute || 'National'} — Historical Index + Chronos-2 Forecast`}
        subtitle="Solid line: Historical · Dashed: Forecast · Shaded area: 80% prediction confidence interval (10th–90th percentile)"
      >
        {loading ? (
          <LoadingSpinner />
        ) : combinedData.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <p>No forecast data available.</p>
            <p className="text-xs mt-2">Run: <code>python manage.py run_index_forecast</code></p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={combinedData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  {/* Mantis Primary Area Gradient */}
                  <linearGradient id="histGradFP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-mantis-primary, #1677FF)" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="var(--color-mantis-primary, #1677FF)" stopOpacity={0.02}/>
                  </linearGradient>
                  {/* Mantis Purple Confidence Band Area Shading */}
                  <linearGradient id="confBandFP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-mantis-purple, #722ED1)" stopOpacity={0.20}/>
                    <stop offset="100%" stopColor="var(--color-mantis-purple, #722ED1)" stopOpacity={0.04}/>
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
                  domain={['dataMin - 3', 'dataMax + 3']}
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  stroke="var(--color-border)"
                />
                <Tooltip
                  content={
                    <MantisChartTooltip
                      labelFormatter={formatDate}
                      valueFormatter={(value, key) => {
                        const val = parseFloat(value).toFixed(2)
                        if (key === 'historical') return `${val} (Historical)`
                        if (key === 'predicted') return `${val} (Forecast)`
                        if (key === 'upper') return `${val} (90th Pct)`
                        if (key === 'lower') return `${val} (10th Pct)`
                        return val
                      }}
                    />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  formatter={(value) => {
                    if (value === 'historical') return 'Historical Index'
                    if (value === 'predicted') return 'Chronos-2 Forecast'
                    if (value === 'upper') return '80% Confidence Range'
                    return value
                  }}
                />

                {/* Historical: solid area with Mantis primary gradient */}
                <Area
                  type="monotone"
                  name="historical"
                  dataKey="historical"
                  stroke="var(--color-mantis-primary, #1677FF)"
                  strokeWidth={2.5}
                  fill="url(#histGradFP)"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--color-mantis-primary, #1677FF)', stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls
                />

                {/* Mantis Confidence band upper bound */}
                {hasForecast && <Area
                  type="monotone"
                  name="upper"
                  dataKey="upper"
                  stroke="var(--color-mantis-purple, #722ED1)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="url(#confBandFP)"
                  dot={false}
                  connectNulls
                />}
                {/* Confidence band lower bound */}
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
                    stroke="var(--color-mantis-slate, #8C8C8C)"
                    strokeDasharray="4 3"
                    label={{
                      value: 'Forecast Start',
                      position: 'insideTopLeft',
                      fill: 'var(--color-text-secondary)',
                      fontSize: 11,
                    }}
                  />
                )}

                <ReferenceLine
                  y={100}
                  stroke="var(--color-text-light)"
                  strokeDasharray="6 4"
                  label={{ value: 'Base=100', position: 'right', fontSize: 10, fill: 'var(--color-text-light)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div style={{
              display: 'flex', gap: '1rem', flexWrap: 'wrap',
              padding: '0.5rem 0.25rem', marginTop: '0.25rem',
              fontSize: '0.7rem', color: 'var(--color-text-secondary)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 20, height: 2.5, background: '#FFE600' }} />
                Historical
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  display: 'inline-block', width: 20, height: 0,
                  borderTop: '2.5px dashed #3b82f6',
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
          </>
        )}
      </ChartCard>

      {/* CPI Impact Note */}
      {forecast?.summary?.cpi_impact_note && (
        <div className="card p-5 animate-fade-in-up" style={{
          borderLeft: '4px solid var(--color-brand-yellow)',
        }}>
          <h3 className="text-sm font-semibold mb-2" style={{color: 'var(--color-text)'}}>
            💡 Illustrative CPI Relevance
          </h3>
          <p className="text-xs" style={{color: 'var(--color-text-secondary)', lineHeight: 1.7}}>
            {forecast.summary.cpi_impact_note}
          </p>
        </div>
      )}

      {/* Forecast Accuracy Tracking */}
      <div className="card p-6 animate-fade-in-up">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{color: 'var(--color-text)'}}>
              🎯 Forecast Accuracy Tracking
            </h3>
            <p className="text-xs sm:text-sm mt-0.5" style={{color: 'var(--color-text-secondary)'}}>
              Out-of-sample backtest evaluations comparing Chronos-2 probabilistic forecasts against observed price indices
            </p>
          </div>
          {accuracy?.logs?.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: 'var(--color-surface, rgba(255,255,255,0.04))', border: '1px solid var(--color-border)' }}>
              {[
                { id: 'evaluated', label: `Evaluated (${accuracy.metrics?.total_evaluated || 0})` },
                { id: 'pending',   label: `Pending (${accuracy.metrics?.total_pending || 0})` },
                { id: 'all',       label: 'All' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAccuracyFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all ${
                    accuracyFilter === tab.id
                      ? 'bg-amber-400 text-black font-bold shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prominent Evidence Numbers — Projector-Ready Type Scale */}
        {accuracy?.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1" style={{color: 'var(--color-text-secondary)'}}>Evaluated</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
                {accuracy.metrics.total_evaluated}
              </p>
              <p className="text-[11px] mt-1" style={{color: 'var(--color-text-light)'}}>Historical dates verified</p>
            </div>
            <div className="stat-card">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1" style={{color: 'var(--color-text-secondary)'}}>Pending</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums">
                {accuracy.metrics.total_pending}
              </p>
              <p className="text-[11px] mt-1" style={{color: 'var(--color-text-light)'}}>Upcoming forecast dates</p>
            </div>
            <div className="stat-card">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1" style={{color: 'var(--color-text-secondary)'}}>MAPE</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
                {accuracy.metrics.mean_absolute_pct_error != null ? `${accuracy.metrics.mean_absolute_pct_error}%` : '—'}
              </p>
              <p className="text-[11px] mt-1 text-emerald-500/80">Mean Abs % Error (Real)</p>
            </div>
            <div className="stat-card">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1" style={{color: 'var(--color-text-secondary)'}}>Interval Hit Rate</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
                {accuracy.metrics.interval_hit_rate_pct != null ? `${accuracy.metrics.interval_hit_rate_pct}%` : '—'}
              </p>
              <p className="text-[11px] mt-1 text-emerald-500/80">80% CI Coverage</p>
            </div>
          </div>
        )}

        {/* Visual "Predicted vs. Actual" Plot (compelling for live jury & projector) */}
        {(() => {
          const accuracyPoints = (accuracy?.logs || [])
            .filter(l => l.actual_index != null)
            .slice()
            .sort((a, b) => new Date(a.forecast_date) - new Date(b.forecast_date))
            .map(l => ({
              date: formatDate(l.forecast_date),
              actual: parseFloat(l.actual_index),
              predicted: parseFloat(l.predicted_index),
            }))

          if (accuracyPoints.length < 2) return null

          return (
            <div className="mb-6 p-4 rounded-xl border border-[var(--color-border)]" style={{ background: 'var(--color-bg)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                  Out-of-Sample Tracking: Actual vs. Predicted Curve
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--color-text)' }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Actual Index
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-amber-400">
                    <span className="w-2.5 h-0.5 bg-amber-400" /> Chronos-2 Predicted
                  </span>
                </div>
              </div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={accuracyPoints} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="var(--color-text-light)" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} stroke="var(--color-text-light)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                    />
                    <Line type="monotone" dataKey="actual" name="Actual Index" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10b981' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="predicted" name="Predicted Index" stroke="#F5A623" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: '#F5A623' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* Table View with Generous Spacing and Projector Readability */}
        {(() => {
          const visibleLogs = (accuracy?.logs || []).filter(log => {
            if (accuracyFilter === 'evaluated') return log.actual_index != null
            if (accuracyFilter === 'pending') return log.actual_index == null
            return true
          })

          if (visibleLogs.length === 0) {
            return (
              <div className="text-center py-8 text-sm" style={{color: 'var(--color-text-secondary)'}}>
                No records match the current filter.
              </div>
            )
          }

          return (
            <div style={{overflowX: 'auto'}}>
              <table style={{width: '100%', fontSize: '0.9375rem', borderCollapse: 'separate', borderSpacing: 0}} className="tabular-nums">
                <thead>
                  <tr style={{borderBottom: '2px solid var(--color-border)'}}>
                    <th style={{padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Forecast Date</th>
                    <th style={{padding: '12px 16px', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Predicted Index</th>
                    <th style={{padding: '12px 16px', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Actual Index</th>
                    <th style={{padding: '12px 16px', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Error %</th>
                    <th style={{padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>80% CI Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.slice(0, 25).map((log, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: i % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                      }}
                      className="hover:bg-white/[0.04] transition-colors"
                    >
                      <td style={{padding: '14px 16px', color: 'var(--color-text)', fontWeight: 500}}>
                        {log.forecast_date}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-secondary)', fontWeight: 500}}>
                        {parseFloat(log.predicted_index).toFixed(1)}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: log.actual_index ? 700 : 400, color: log.actual_index ? 'var(--color-text)' : 'var(--color-text-light)'}}>
                        {log.actual_index ? parseFloat(log.actual_index).toFixed(1) : '—'}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right'}}>
                        {log.error_pct != null ? (
                          <span
                            className="px-2.5 py-1 rounded-md text-xs sm:text-sm font-mono font-semibold"
                            style={{
                              background: log.error_pct > 5 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                              color: log.error_pct > 5 ? '#ef4444' : '#10b981',
                              border: `1px solid ${log.error_pct > 5 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                            }}
                          >
                            {log.error_pct}%
                          </span>
                        ) : (
                          <span style={{color: 'var(--color-text-light)'}}>—</span>
                        )}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'center'}}>
                        {log.within_interval === true ? (
                          <span className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-md" style={{ color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                            ✓ Within CI
                          </span>
                        ) : log.within_interval === false ? (
                          <span className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-md" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                            ✕ Out of CI
                          </span>
                        ) : (
                          <span className="text-xs sm:text-sm px-2.5 py-1 rounded-md" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface, rgba(255,255,255,0.04))', border: '1px solid var(--color-border)' }}>
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
