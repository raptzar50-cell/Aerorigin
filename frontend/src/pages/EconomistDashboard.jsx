import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import MantisChartTooltip from '../components/MantisChartTooltip'
import { fetchStats, fetchIndex, fetchRoutes, fetchModelVersions, exportIndex } from '../api/client'
import ChartCard from '../components/ChartCard'
import PeriodToggle from '../components/PeriodToggle'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Role colour tokens ──────────────────────────────────────────────────────
const RC  = '#F5A623'             // amber
const RCS = 'rgba(245,166,35,0.10)'
const RCB = 'rgba(245,166,35,0.25)'

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
const fmtPct  = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—'

// ── Methodology expandable card ─────────────────────────────────────────────
function MethodologyPanel() {
  const [open, setOpen] = useState(true)
  const items = [
    {
      icon: '🧮', title: 'Formula',
      value: 'Index = (Period Avg. Fare ÷ Base Period Avg. Fare) × 100',
      detail: 'A fixed-base Laspeyres-style price index. Each period\'s anomaly-screened average fare is expressed relative to the base period mean, yielding a CPI-comparable series.',
    },
    {
      icon: '📅', title: 'Base Period',
      value: 'Base = 100.0 at the first observation in the dataset',
      detail: 'An index value of 108.3 means fares are 8.3% higher than at the reference date. The base date is shown inline in the headline above.',
    },
    {
      icon: '🛡️', title: 'Anomaly Screening',
      value: 'PyOD ECOD removes outliers before any aggregation',
      detail: 'Records flagged as price_outlier, statistical_outlier, or pyod_anomaly are excluded. Only pyod_clean records enter the period average, ensuring spikes do not contaminate the index.',
    },
    {
      icon: '🗄️', title: 'Data Sources',
      value: 'Live OTA APIs + DGCA government publications',
      detail: 'MakeMyTrip, Amadeus, Kiwi, Google Flights (via APIs) and DGCA published reports. Every record carries a provenance tag (live / published / fixture) — full lineage is traceable.',
    },
  ]
  return (
    <div className="adminkit-card animate-fade-in-up" style={{ borderLeft: `4px solid ${RC}`, animationDelay: '80ms' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📐</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>Index Methodology</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: RCS, color: RC, border: `1px solid ${RCB}` }}>
              STATISTICIAN VIEW
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 1.5rem' }}>
            How this index is constructed, screened, and made trustworthy
          </p>
        </div>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: 'var(--color-text-secondary)', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
            {items.map(item => (
              <div key={item.title} style={{ padding: '1rem', borderRadius: '12px', background: RCS, border: `1px solid ${RCB}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>{item.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text)' }}>{item.title}</span>
                </div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: RC, margin: '0 0 0.35rem' }}>{item.value}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function EconomistDashboard() {
  const [stats, setStats]               = useState(null)
  const [indexData, setIndexData]       = useState([])
  const [modelVersions, setModelVersions] = useState([])
  const [period, setPeriod]             = useState('daily')
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([fetchStats(), fetchRoutes(), fetchModelVersions()])
      .then(([s, , m]) => { setStats(s); setModelVersions(m) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchIndex({ period })
      .then(data => { setIndexData(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const provenance   = stats?.data_provenance
  const currentIndex = stats ? parseFloat(stats.current_index) : null
  const activeModel  = modelVersions.find(m => m.is_active)

  const baseDateStr = indexData.length > 0
    ? new Date(indexData[0].index_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const provenancePills = provenance && provenance.total > 0
    ? [
        { key: 'live_scrape',         label: 'Live Scraped',   color: '#10b981', icon: '🟢' },
        { key: 'government_published', label: 'Govt Published', color: '#3b82f6', icon: '🏛️' },
        { key: 'fixture_fallback',    label: 'Sample/Fixture', color: '#f59e0b', icon: '⚠️' },
        { key: 'synthetic_seed',      label: 'Synthetic',      color: '#8b5cf6', icon: '🔬' },
      ]
        .filter(p => (provenance[p.key] || 0) > 0)
        .map(p => ({
          ...p,
          count: provenance[p.key] || 0,
          pct:   ((provenance[p.key] || 0) / provenance.total * 100).toFixed(1),
        }))
    : []

  return (
    <div className="space-y-6">

      {/* ── Role Hero ──────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up" style={{
        borderRadius: '20px', padding: '2rem',
        background: `linear-gradient(135deg, rgba(245,166,35,0.15) 0%, rgba(245,166,35,0.05) 60%, transparent 100%)`,
        border: `1px solid ${RCB}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: `radial-gradient(circle, ${RC}18, transparent 70%)`, pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', position: 'relative' }}>
          <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Economist / Statistician Dashboard
              </h1>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: RC, color: '#1D1D1B', letterSpacing: '0.05em' }}>
                ECONOMIST
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Index construction methodology, data provenance audit, and export tools for external statistical work
            </p>
          </div>
        </div>

        {/* Headline index value with base-period inline */}
        <div style={{
          marginTop: '1.5rem', padding: '1.25rem 1.5rem', borderRadius: '14px',
          background: 'rgba(0,0,0,0.04)', border: `1px solid ${RCB}`,
          display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: RC, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              National Price Index
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '2.75rem', fontWeight: 900, color: 'var(--color-text)', lineHeight: 1.1 }}>
                {currentIndex != null ? currentIndex.toFixed(1) : '--'}
              </span>
              {stats?.index_change_7d != null && (
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: stats.index_change_7d > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {stats.index_change_7d > 0 ? '▲' : '▼'} {Math.abs(stats.index_change_7d)}% (7d)
                </span>
              )}
            </div>
            {baseDateStr && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Base: <strong style={{ color: 'var(--color-text)' }}>100.0</strong> on {baseDateStr}
                {currentIndex != null && (
                  <span style={{ marginLeft: '0.5rem', color: currentIndex > 100 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    — fares are {Math.abs(currentIndex - 100).toFixed(1)}% {currentIndex > 100 ? 'above' : 'below'} baseline
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: '30d Change', value: stats?.index_change_30d != null ? `${stats.index_change_30d > 0 ? '+' : ''}${stats.index_change_30d}%` : '--', color: stats?.index_change_30d > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
              { label: 'Routes',      value: stats?.total_routes || '--', color: 'var(--color-text)' },
              { label: 'Observations', value: stats?.total_observations?.toLocaleString() || '--', color: 'var(--color-text)' },
            ].map(kpi => (
              <div key={kpi.label}>
                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: kpi.color, marginTop: '0.2rem' }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Methodology Panel ─────────────────────────────────────────── */}
      <MethodologyPanel />

      {/* ── Index Chart with large, prominent export CTAs ─────────────── */}
      <ChartCard
        title="National Price Index — Historical Trend"
        subtitle={`CPI-style fixed-base index · ${period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'} granularity · Base = 100`}
        delay={160}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <PeriodToggle value={period} onChange={setPeriod} />
            <button
              id="economist-export-csv"
              onClick={() => exportIndex({ format: 'csv', period })}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px', fontSize: '0.8rem',
                fontWeight: 700, cursor: 'pointer', border: 'none',
                background: RC, color: '#1D1D1B',
                boxShadow: `0 2px 10px ${RC}40`, transition: 'all 0.15s',
              }}
            >
              ⬇ Export CSV
            </button>
            <button
              id="economist-export-json"
              onClick={() => exportIndex({ format: 'json', period })}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px', fontSize: '0.8rem',
                fontWeight: 700, cursor: 'pointer',
                border: `2px solid ${RC}`, background: 'transparent', color: RC,
                transition: 'all 0.15s',
              }}
            >
              ⬇ Export JSON
            </button>
          </div>
        }
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={indexData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="econAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RC} stopOpacity={0.28}/>
                  <stop offset="95%" stopColor={RC} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="index_date" tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <Tooltip content={<MantisChartTooltip />} />
              <Area type="monotone" dataKey="index_value" stroke={RC} strokeWidth={2.5}
                fill="url(#econAreaGrad)" dot={false}
                activeDot={{ r: 5, fill: RC, stroke: 'var(--color-brand-dark)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Data Provenance — large aggregate pills ────────────────────── */}
      {provenancePills.length > 0 && (
        <div className="adminkit-card p-6 animate-fade-in-up" style={{ borderLeft: `4px solid ${RC}`, animationDelay: '220ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                📋 Data Provenance Audit
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                Composition of {provenance.total?.toLocaleString()} records — verify before citing in statistical work
              </p>
            </div>
            <Link to="/dashboard/quality" style={{ fontSize: '0.72rem', fontWeight: 600, color: RC, textDecoration: 'none' }}>
              Full Audit →
            </Link>
          </div>
          {/* Big percentage pills */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${provenancePills.length}, 1fr)`, gap: '1rem', marginBottom: '1rem' }}>
            {provenancePills.map(p => (
              <div key={p.key} style={{ padding: '1.25rem', borderRadius: '14px', textAlign: 'center', background: `${p.color}0D`, border: `1px solid ${p.color}30` }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{p.icon}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: p.color, lineHeight: 1 }}>{p.pct}%</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text)', marginTop: '0.35rem' }}>{p.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>{p.count.toLocaleString()} records</div>
              </div>
            ))}
          </div>
          {/* Stacked progress bar */}
          <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
            {provenancePills.map(p => (
              <div key={p.key} style={{ width: `${p.pct}%`, background: p.color, transition: 'width 0.6s ease' }} title={`${p.label}: ${p.pct}%`} />
            ))}
          </div>
        </div>
      )}

      {/* ── Model Quality — "Why You Can Trust This Index" ─────────────── */}
      <div className="adminkit-card animate-fade-in-up" style={{ borderLeft: `4px solid ${RC}`, animationDelay: '280ms' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
              🔬 Why You Can Trust This Index
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
              Anomaly detector performance — evidence of data quality rigor applied before index computation
            </p>
          </div>
          {activeModel && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.2)' }}>
              ● v{activeModel.version} Active
            </span>
          )}
        </div>
        <div style={{ padding: '1.5rem' }}>
          {activeModel?.metrics ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Anomaly Recall', value: fmtPct(activeModel.metrics.recall), desc: 'Of true anomalies, fraction correctly identified', color: '#10b981' },
                  { label: 'Records Screened', value: (activeModel.record_count || stats?.total_observations || '—')?.toLocaleString(), desc: 'Observations audited before index computation', color: '#6366f1' },
                  { label: 'Screening Model', value: 'PyOD ECOD', desc: 'Empirical cumulative distribution outlier screening', color: '#f59e0b' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '1.1rem', borderRadius: '12px', textAlign: 'center', background: `${m.color}0D`, border: `1px solid ${m.color}25` }}>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginTop: '0.25rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>{m.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0.875rem 1rem', borderRadius: '10px', background: RCS, border: `1px solid ${RCB}`, fontSize: '0.72rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                <strong style={{ color: RC }}>Interpretation for statistical use:</strong> Records flagged by the PyOD ECOD anomaly detector
                are excluded from the period average before index computation. High sensitivity and recall ensure genuine price spikes
                aren't silently included in the average. The index you see reflects only validated, anomaly-screened fare observations.
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              No trained model yet. Run <code>python manage.py train_anomaly_detector</code> to generate evaluation metrics.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
