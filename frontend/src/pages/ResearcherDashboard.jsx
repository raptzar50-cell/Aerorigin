import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchStats, fetchIndex, fetchRoutes, fetchModelVersions, fetchForecastAccuracy, exportIndex } from '../api/client'
import ChartCard from '../components/ChartCard'
import PeriodToggle from '../components/PeriodToggle'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Role colour tokens ──────────────────────────────────────────────────────
const RC  = '#8B5CF6'             // violet
const RCS = 'rgba(139,92,246,0.10)'
const RCB = 'rgba(139,92,246,0.25)'

const fmtINR  = (v) => v != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v) : '—'
const fmtPct  = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—'

// ── Pagination component ────────────────────────────────────────────────────
function Paginator({ page, total, onPrev, onNext }) {
  const btnBase = {
    padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
    transition: 'opacity 0.15s',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderTop: '1px solid var(--color-border)' }}>
      <button disabled={page === 0} onClick={onPrev} style={{ ...btnBase, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
        ← Prev
      </button>
      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Page {page + 1} / {total}</span>
      <button disabled={page >= total - 1} onClick={onNext} style={{ ...btnBase, cursor: page >= total - 1 ? 'not-allowed' : 'pointer', opacity: page >= total - 1 ? 0.4 : 1 }}>
        Next →
      </button>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ResearcherDashboard() {
  const [stats,         setStats]         = useState(null)
  const [indexData,     setIndexData]     = useState([])
  const [routes,        setRoutes]        = useState([])
  const [modelVersions, setModelVersions] = useState([])
  const [accuracy,      setAccuracy]      = useState(null)
  const [period,        setPeriod]        = useState('daily')
  const [filterRoute,   setFilterRoute]   = useState('')
  const [page,          setPage]          = useState(0)
  const [loading,       setLoading]       = useState(true)
  const PAGE_SIZE = 10

  useEffect(() => {
    Promise.all([fetchStats(), fetchRoutes(), fetchModelVersions(), fetchForecastAccuracy()])
      .then(([s, r, m, a]) => { setStats(s); setRoutes(r); setModelVersions(m); setAccuracy(a) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    setPage(0)
    fetchIndex({ route: filterRoute || undefined, period })
      .then(d => { setIndexData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filterRoute, period])

  const activeModel = modelVersions.find(m => m.is_active)

  // Date range from index data
  const dateRange = indexData.length > 1
    ? `${new Date(indexData[0].index_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(indexData[indexData.length - 1].index_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '—'

  const totalPages = Math.max(1, Math.ceil(indexData.length / PAGE_SIZE))
  // Show most-recent first
  const pageRows = indexData.slice().reverse().slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const MODEL_SPECS = [
    {
      category: 'Anomaly Detection',
      model: 'PyOD — ECOD (Empirical Cumulative Dist.)',
      color: '#6366f1',
      details: [
        'Type: Unsupervised statistical outlier detection',
        'Input: Normalized fare features (route, lead time, source, historical avg)',
        'Output: Binary clean/anomaly flag + anomaly score',
        'Screening: Applied before any period average computation',
      ],
    },
    {
      category: 'Index Forecasting',
      model: 'Amazon Chronos-2 (zero-shot)',
      color: RC,
      details: [
        'Architecture: Transformer-based time series language model',
        'Mode: Zero-shot — no fine-tuning required on domain data',
        'Output: Point forecast + 10th / 90th percentile confidence band',
        'Horizon: Configurable (default 30 days ahead)',
      ],
    },
  ]

  const API_ENDPOINTS = [
    { method: 'GET', path: '/api/index/',          desc: 'Price index time series — params: route, period (daily|weekly|monthly)' },
    { method: 'GET', path: '/api/routes/',         desc: 'All tracked routes with latest stats, avg fares, observation counts' },
    { method: 'GET', path: '/api/quality-report/', desc: 'Anomaly detection summary + flagged records with provenance info' },
    { method: 'GET', path: '/api/index-forecast/', desc: 'Chronos-2 probabilistic forecast — params: route' },
    { method: 'GET', path: '/api/model-versions/', desc: 'Anomaly model version history with recall/screening metrics' },
    { method: 'GET', path: '/api/export/index/',   desc: 'Download index data as CSV/JSON — params: format, period, route' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Role Hero ──────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up" style={{
        borderRadius: '20px', padding: '2rem',
        background: `linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 60%, transparent 100%)`,
        border: `1px solid ${RCB}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${RC}18, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', position: 'relative' }}>
          <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>🔬</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Researcher / Analyst Dashboard
              </h1>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: RC, color: '#fff', letterSpacing: '0.05em' }}>
                RESEARCHER
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Raw data access, model transparency, API documentation, and programmatic export
            </p>
          </div>
        </div>

        {/* Dataset card — Kaggle/HuggingFace style */}
        <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '14px', background: 'rgba(0,0,0,0.04)', border: `1px solid ${RCB}` }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: RC, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
            📊 Dataset Overview — Aerogin Airfare Price Index
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Total Records',  value: stats?.total_observations?.toLocaleString() || '—', icon: '📋' },
              { label: 'Routes Tracked', value: stats?.total_routes || '—',                         icon: '✈️' },
              { label: 'Date Range',     value: dateRange,                                            icon: '📅' },
              { label: 'Last Updated',
                value: stats?.last_updated
                  ? new Date(stats.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '—',
                icon: '🔄' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.icon} {item.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', marginTop: '0.2rem' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              id="researcher-export-csv"
              onClick={() => exportIndex({ format: 'csv', period, route: filterRoute || undefined })}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: RC, color: '#fff', boxShadow: `0 2px 8px ${RC}40` }}
            >
              ⬇ Download Full Dataset (CSV)
            </button>
            <button
              id="researcher-export-json"
              onClick={() => exportIndex({ format: 'json', period, route: filterRoute || undefined })}
              style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', border: `2px solid ${RC}`, background: 'transparent', color: RC }}
            >
              ⬇ JSON Export
            </button>
          </div>
        </div>
      </div>

      {/* ── Raw Data Table ─────────────────────────────────────────────── */}
      <div className="adminkit-card animate-fade-in-up" style={{ borderLeft: `4px solid ${RC}`, animationDelay: '100ms' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                🗃️ Index Time Series — Data Table
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                {indexData.length} records · page {page + 1} of {totalPages} · most recent first
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                <option value="">National Aggregate</option>
                {routes.map(r => <option key={r.route} value={r.route}>{r.route}</option>)}
              </select>
              <PeriodToggle value={period} onChange={setPeriod} />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Route</th>
                    <th>Index Value</th>
                    <th>Avg Fare</th>
                    <th>Sample Size</th>
                    <th>Period</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                        No data yet. Run <code>python manage.py build_index</code>
                      </td>
                    </tr>
                  ) : pageRows.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{row.index_date}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '5px', background: RCS, color: RC }}>
                          {row.route || 'National'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{parseFloat(row.index_value).toFixed(2)}</td>
                      <td>{fmtINR(row.avg_fare)}</td>
                      <td>{row.sample_size?.toLocaleString() || '—'}</td>
                      <td><span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{row.period_type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <Paginator
                page={page} total={totalPages}
                onPrev={() => setPage(p => p - 1)}
                onNext={() => setPage(p => p + 1)}
              />
            )}
          </>
        )}
      </div>

      {/* ── Model Card ─────────────────────────────────────────────────── */}
      <div className="adminkit-card animate-fade-in-up" style={{ borderLeft: `4px solid ${RC}`, animationDelay: '180ms' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
              🤖 Model Card — System Transparency
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
              Algorithm specifications, evaluation metrics, and model version history
            </p>
          </div>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: RCS, color: RC, border: `1px solid ${RCB}` }}>
            RESEARCHER VIEW
          </span>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Algorithm specs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {MODEL_SPECS.map(spec => (
              <div key={spec.category} style={{ padding: '1rem', borderRadius: '12px', background: `${spec.color}0D`, border: `1px solid ${spec.color}25` }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: spec.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {spec.category}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text)', margin: '0.35rem 0 0.6rem' }}>
                  {spec.model}
                </div>
                <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {spec.details.map(d => (
                    <li key={d} style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Active model metrics */}
          {activeModel?.metrics && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
                Active Anomaly Detector — v{activeModel.version} · trained on {activeModel.record_count?.toLocaleString()} records
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Anomaly Recall', value: fmtPct(activeModel.metrics.recall), color: '#10b981' },
                  { label: 'Audited Records', value: activeModel.record_count?.toLocaleString() || '—', color: '#6366f1' },
                  { label: 'Screening Model', value: 'PyOD ECOD', color: '#f59e0b' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '0.875rem', borderRadius: '10px', textAlign: 'center', background: `${m.color}0D`, border: `1px solid ${m.color}25` }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronos-2 accuracy */}
          {accuracy?.metrics && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
                Chronos-2 Forecast Accuracy (out-of-sample)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'MAPE',              value: accuracy.metrics.mean_absolute_pct_error != null ? `${accuracy.metrics.mean_absolute_pct_error}%` : '—', desc: 'Mean Absolute Percentage Error', color: RC },
                  { label: 'Interval Hit Rate', value: accuracy.metrics.interval_hit_rate_pct  != null ? `${accuracy.metrics.interval_hit_rate_pct}%`  : '—', desc: '80% CI coverage rate',            color: '#10b981' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '0.875rem', borderRadius: '10px', background: `${m.color}0D`, border: `1px solid ${m.color}25` }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginTop: '0.2rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '0.1rem' }}>{m.desc}</div>
                  </div>
                ))}
              </div>
              {accuracy.metrics?.note && (
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '0.5rem', lineHeight: 1.5 }}>
                  {accuracy.metrics.note}
                </p>
              )}
            </div>
          )}

          {/* Version history table */}
          {modelVersions.length > 1 && (
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.6rem' }}>
                Model Version History
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Version', 'Trained', 'Records', 'Recall', 'Algorithm', 'Status'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modelVersions.map(m => (
                      <tr key={m.version}>
                        <td style={{ fontWeight: 700, color: RC }}>v{m.version}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>
                          {new Date(m.trained_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>{m.record_count?.toLocaleString()}</td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>{fmtPct(m.metrics?.recall)}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>PyOD ECOD</td>
                        <td>
                          {m.is_active
                            ? <span className="badge" style={{ background: 'var(--color-success-soft, rgba(16,185,129,0.1))', color: 'var(--color-success)' }}>● Active</span>
                            : <span style={{ color: 'var(--color-text-light)' }}>Retired</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── API Documentation Panel ────────────────────────────────────── */}
      <div className="adminkit-card p-6 animate-fade-in-up" style={{ animationDelay: '260ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {'</>  '}API Access — Programmatic Reference
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
              All endpoints are REST JSON — no authentication required in dev mode
            </p>
          </div>
          <Link to="/dashboard/api-docs" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', background: RC, color: '#fff' }}>
            📖 Full API Docs →
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {API_ENDPOINTS.map(ep => (
            <div key={ep.path} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', background: RCS, color: RC, minWidth: '36px', textAlign: 'center', flexShrink: 0 }}>
                {ep.method}
              </span>
              <code style={{ fontSize: '0.75rem', color: RC, fontWeight: 600, flexShrink: 0 }}>{ep.path}</code>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
