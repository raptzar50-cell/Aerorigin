import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import MantisChartTooltip from '../components/MantisChartTooltip'
import { fetchQualityReport, fetchStats, fetchRoutes, fetchIndex, exportFares } from '../api/client'
import DataProvenanceBadge from '../components/DataProvenanceBadge'
import ChartCard from '../components/ChartCard'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Role colour tokens ──────────────────────────────────────────────────────
const RC  = '#00A5B5'             // teal
const RCS = 'rgba(0,165,181,0.10)'
const RCB = 'rgba(0,165,181,0.25)'

const SOURCE_COLORS = ['#E5245A', '#00A5B5', '#F5A623', '#8B5CF6', '#10b981']

const FLAG_STYLES = {
  price_outlier:      { bg: 'var(--color-danger-soft)',          color: 'var(--color-danger)',           label: 'Price Outlier' },
  statistical_outlier:{ bg: 'var(--color-warning-soft)',         color: 'var(--color-warning)',          label: 'Statistical' },
  pyod_anomaly:       { bg: 'rgba(139,92,246,0.12)',             color: '#8b5cf6',                       label: 'PyOD Anomaly' },
  pyod_clean:         { bg: 'rgba(16,185,129,0.1)',              color: 'var(--color-success)',           label: 'PyOD Clean' },
}

const fmtINR  = (v) => v != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v) : '—'
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })

// ── Severity badge helper ───────────────────────────────────────────────────
function SeverityBar({ high, moderate, low }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {[
        { label: 'High confidence', count: high,     desc: '>30% deviation from route avg', color: 'var(--color-danger)',          bg: 'var(--color-danger-soft)' },
        { label: 'Moderate',        count: moderate, desc: '15–30% deviation',               color: 'var(--color-warning)',          bg: 'var(--color-warning-soft)' },
        { label: 'Low confidence',  count: low,      desc: '<15% deviation',                 color: 'var(--color-text-secondary)',   bg: 'var(--color-bg)' },
      ].map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', borderRadius: '8px', background: s.bg, border: `1px solid ${s.color}20` }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, minWidth: '2.5rem' }}>{s.count}</span>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{s.label}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>{s.desc}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function RegulatorDashboard() {
  const [report,              setReport]              = useState(null)
  const [stats,               setStats]               = useState(null)
  const [routes,              setRoutes]              = useState([])
  const [indexData,           setIndexData]           = useState([])
  const [loading,             setLoading]             = useState(true)
  const [sortBy,              setSortBy]              = useState('magnitude') // 'magnitude' | 'date'
  const [filterRoute,         setFilterRoute]         = useState('all')
  const [patternRoute,        setPatternRoute]        = useState('')

  useEffect(() => {
    Promise.all([fetchQualityReport(), fetchStats(), fetchRoutes()])
      .then(([r, s, rts]) => {
        setReport(r); setStats(s); setRoutes(rts)
        if (rts.length > 0) setPatternRoute(rts[0].route)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetchIndex({ period: 'daily' })
      .then(d => setIndexData(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [])

  if (loading) return <LoadingSpinner />

  const summary = report?.summary || {}
  const records = report?.flagged_records || []
  const anomalyRecords = records.filter(r => r.flag_type !== 'pyod_clean')

  // Severity buckets
  const highConf = anomalyRecords.filter(r => r.magnitude != null && r.magnitude > 30)
  const moderate = anomalyRecords.filter(r => r.magnitude != null && r.magnitude >= 15 && r.magnitude <= 30)
  const lowConf  = anomalyRecords.filter(r => r.magnitude != null && r.magnitude < 15)

  // Filtered + sorted anomaly feed
  const filtered = anomalyRecords
    .filter(r => filterRoute === 'all' || r.route === filterRoute)
    .sort((a, b) => sortBy === 'magnitude'
      ? (b.magnitude || 0) - (a.magnitude || 0)
      : new Date(b.departure_date) - new Date(a.departure_date)
    )

  // Dynamic pricing pattern — avg fare per source for flagged records on selected route
  const sourceMap = {}
  records
    .filter(r => r.route === patternRoute)
    .forEach(r => {
      if (!sourceMap[r.source]) sourceMap[r.source] = []
      sourceMap[r.source].push(parseFloat(r.total_fare))
    })
  const sourcePattern = Object.entries(sourceMap)
    .map(([src, fares]) => ({
      source:   src.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      avg_fare: Math.round(fares.reduce((a, b) => a + b, 0) / fares.length),
      count:    fares.length,
    }))
    .sort((a, b) => b.avg_fare - a.avg_fare)

  const uniqueRoutes = [...new Set(records.map(r => r.route))].sort()

  return (
    <div className="space-y-6">

      {/* ── Role Hero ──────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up" style={{
        borderRadius: '20px', padding: '2rem',
        background: `linear-gradient(135deg, rgba(0,165,181,0.15) 0%, rgba(0,165,181,0.05) 60%, transparent 100%)`,
        border: `1px solid ${RCB}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${RC}18, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', position: 'relative' }}>
          <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>🔍</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Regulator / Policy Analyst Dashboard
              </h1>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: RC, color: '#fff', letterSpacing: '0.05em' }}>
                REGULATOR
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Market anomaly detection, pricing pattern oversight, and flagged fare review
            </p>
          </div>
        </div>

        {/* Anomaly Headline — primary KPI, leads the page */}
        <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Big counter */}
          <div style={{ padding: '1.25rem 2rem', borderRadius: '16px', background: `${RC}18`, border: `2px solid ${RC}40`, textAlign: 'center', minWidth: '160px' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: RC, lineHeight: 1 }}>{anomalyRecords.length}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Anomalies Flagged
            </div>
            {summary.last_scrape_at && (
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-light)', marginTop: '0.3rem' }}>
                As of {new Date(summary.last_scrape_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>
          {/* Severity breakdown */}
          <SeverityBar high={highConf.length} moderate={moderate.length} low={lowConf.length} />
        </div>
      </div>

      {/* ── Anomaly Feed — dominant table ─────────────────────────────── */}
      <div className="adminkit-card animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                ⚡ Anomaly Feed
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                {filtered.length} records · sorted by {sortBy === 'magnitude' ? 'deviation magnitude ↓' : 'most recent ↓'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                <option value="all">All Routes</option>
                {uniqueRoutes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={() => setSortBy(s => s === 'magnitude' ? 'date' : 'magnitude')}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, border: `1px solid ${RCB}`, background: RCS, color: RC, cursor: 'pointer' }}
              >
                Sort: {sortBy === 'magnitude' ? '↕ Magnitude' : '📅 Date'}
              </button>
              <button
                id="regulator-export-anomaly"
                onClick={() => exportFares({ format: 'csv', route: filterRoute !== 'all' ? filterRoute : undefined })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.375rem 0.875rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: RC, color: '#fff', boxShadow: `0 2px 6px ${RC}40` }}
              >
                ⬇ Export Anomaly Report
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Date</th>
                <th>Fare</th>
                <th>Source</th>
                <th>Provenance</th>
                <th>Deviation</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-light)' }}>
                    No anomalies match the current filter.
                  </td>
                </tr>
              ) : filtered.map(rec => {
                const fs     = FLAG_STYLES[rec.flag_type] || {}
                const severe = rec.magnitude > 30
                return (
                  <tr key={rec.id} style={severe ? { background: 'var(--color-danger-soft)' } : {}}>
                    <td><span style={{ fontWeight: 600 }}>{rec.route}</span></td>
                    <td>{new Date(rec.departure_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td style={{ fontWeight: 600 }}>{fmtINR(rec.total_fare)}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                        {rec.source?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td><DataProvenanceBadge provenance={rec.provenance || 'unknown'} size="sm" /></td>
                    <td>
                      {rec.magnitude != null ? (
                        <span style={{ fontWeight: 700, color: severe ? 'var(--color-danger)' : rec.magnitude > 15 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                          {rec.magnitude.toFixed(1)}% {rec.total_fare > 0 ? '↑' : '↓'}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className="badge" style={{ background: fs.bg, color: fs.color }}>
                        {fs.label || rec.flag_type}
                      </span>
                    </td>
                    <td>
                      <Link to={`/dashboard/routes/${rec.route}`} style={{ fontSize: '0.8125rem', color: RC, fontWeight: 600, textDecoration: 'none' }}>
                        🔍 Review →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Dynamic Pricing Pattern — source variation per route ───────── */}
      <ChartCard
        title="Source-Level Pricing Pattern"
        subtitle={`Average fare across data sources for flagged records — spot carrier-specific behaviour`}
        delay={200}
        actions={
          <select
            value={patternRoute} onChange={e => setPatternRoute(e.target.value)}
            style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          >
            {routes.map(r => <option key={r.route} value={r.route}>{r.route}</option>)}
          </select>
        }
      >
        {sourcePattern.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
            No flagged records for this route. Select a different route or check data ingestion.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sourcePattern} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="source" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
                <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
                <Tooltip content={<MantisChartTooltip />} cursor={{ fill: 'rgba(0,165,181,0.05)' }} />
                <Bar dataKey="avg_fare" radius={[8, 8, 0, 0]} barSize={52}>
                  {sourcePattern.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', margin: '0.5rem 0.25rem 0', lineHeight: 1.5 }}>
              ⚠️ Based on flagged records only. Large inter-source fare differences may indicate dynamic pricing strategies or data quality issues worth investigating.
            </p>
          </>
        )}
      </ChartCard>

      {/* ── Index Chart — SECONDARY / Market Context ───────────────────── */}
      <ChartCard title="Market Context — National Price Index (last 30 days)" subtitle="Broad index trend — secondary reference" delay={300}>
        {indexData.length === 0 ? <LoadingSpinner /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={indexData.slice(-30)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="regAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RC} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={RC} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="index_date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <Tooltip content={<MantisChartTooltip />} />
              <Area type="monotone" dataKey="index_value" stroke={RC} strokeWidth={1.5} fill="url(#regAreaGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Quick Links ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }} className="animate-fade-in-up">
        {[
          { to: '/dashboard/quality',  icon: '🛡️', label: 'Full Anomaly Report',   desc: 'Complete flagged record database with all filters' },
          { to: '/dashboard/compare',  icon: '📊', label: 'Compare Routes',         desc: 'Side-by-side index comparison across routes' },
          { to: '/dashboard/forecast', icon: '📈', label: 'Price Forecast',          desc: 'Chronos-2 probabilistic index forecasts' },
        ].map(link => (
          <Link key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
            <div className="adminkit-card p-4" style={{ borderTop: `3px solid ${RC}` }}>
              <span style={{ fontSize: '1.3rem' }}>{link.icon}</span>
              <p style={{ margin: '0.5rem 0 0.25rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--color-text)' }}>{link.label}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
