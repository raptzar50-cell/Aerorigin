import { useState, useEffect } from 'react'
import { fetchQualityReport, fetchModelVersions, fetchDataProvenance } from '../api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import DataProvenanceBadge, { ProvenanceSummary } from '../components/DataProvenanceBadge'

const formatINR = (val) => {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(val)
}

const FLAG_STYLES = {
  price_outlier: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)', label: 'Price Outlier' },
  statistical_outlier: { bg: 'var(--color-warning-soft)', color: 'var(--color-warning)', label: 'Statistical Outlier' },
  pyod_anomaly: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: 'PyOD Anomaly' },
  pyod_clean: { bg: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', label: 'PyOD Clean' },
}

const formatPct = (val) => val != null ? `${(val * 100).toFixed(1)}%` : '-'

export default function DataQuality() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterFlag, setFilterFlag] = useState('all')
  const [filterRoute, setFilterRoute] = useState('all')
  const [modelVersions, setModelVersions] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [provenanceData, setProvenanceData] = useState(null)

  useEffect(() => {
    fetchQualityReport()
      .then(data => {
        setReport(data)
        setLoading(false)
      })
      .catch(err => { console.error(err); setLoading(false) })

    fetchModelVersions()
      .then(data => {
        setModelVersions(data)
        setModelsLoading(false)
      })
      .catch(err => { console.error(err); setModelsLoading(false) })

    fetchDataProvenance()
      .then(setProvenanceData)
      .catch(console.error)
  }, [])

  if (loading) return <LoadingSpinner />

  const summary = report?.summary || {}
  const records = report?.flagged_records || []

  // Get unique routes for filter
  const uniqueRoutes = [...new Set(records.map(r => r.route))].sort()

  // Apply filters
  const filtered = records.filter(r => {
    if (filterFlag !== 'all' && r.flag_type !== filterFlag) return false
    if (filterRoute !== 'all' && r.route !== filterRoute) return false
    return true
  })

  // Freshness indicator
  const freshness = summary.data_freshness_hours
  const isFresh = freshness != null && freshness < 24
  const isStale = freshness != null && freshness >= 24

  // Prepare model performance chart data (ordered by version ascending)
  const chartData = [...modelVersions]
    .sort((a, b) => a.version - b.version)
    .map(m => ({
      version: `v${m.version}`,
      recall: m.metrics?.recall != null ? +(m.metrics.recall * 100).toFixed(1) : null,
      records: m.record_count,
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Data Quality &amp; Anomaly Screening</h1>
        <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
          Audit screening logs, verify PyOD anomaly detection rates, and inspect data freshness
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Records"
          value={summary.total_records?.toLocaleString()}
          delay={0}
          icon={
            <svg className="w-4 h-4" style={{color: 'var(--color-success)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          }
        />
        <StatCard
          title="Flagged Records"
          value={summary.total_flagged?.toLocaleString()}
          change={summary.flagged_percentage ? -summary.flagged_percentage : null}
          changeLabel="of total"
          delay={80}
        />
        <StatCard
          title="Price Outliers"
          value={summary.price_outlier_count?.toLocaleString()}
          delay={160}
          icon={
            <svg className="w-4 h-4" style={{color: 'var(--color-danger)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          title="Statistical Outliers"
          value={summary.statistical_outlier_count?.toLocaleString()}
          delay={240}
          icon={
            <svg className="w-4 h-4" style={{color: 'var(--color-warning)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Data Freshness Banner */}
      <div
        className="card p-4 flex items-center gap-4 animate-fade-in-up"
        style={{
          animationDelay: '300ms',
          borderLeft: `4px solid ${isFresh ? 'var(--color-success)' : isStale ? 'var(--color-danger)' : 'var(--color-warning)'}`,
        }}
      >
        <div className={`w-3 h-3 rounded-full ${isFresh ? 'animate-pulse' : ''}`}
             style={{background: isFresh ? 'var(--color-success)' : isStale ? 'var(--color-danger)' : 'var(--color-warning)'}} />
        <div>
          <p className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>
            Data Freshness: {isFresh ? 'Fresh' : isStale ? 'Stale' : 'Unknown'}
          </p>
          <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>
            {summary.last_scrape_at
              ? `Last data received: ${new Date(summary.last_scrape_at).toLocaleString('en-IN')} (${freshness?.toFixed(1)}h ago)`
              : 'No scrape data available'
            }
          </p>
        </div>
      </div>

      {/* Data Provenance Section */}
      {provenanceData && (
        <div className="card p-5 animate-fade-in-up" style={{animationDelay: '350ms'}}>
          <h3 className="text-sm font-semibold mb-3" style={{color: 'var(--color-text)'}}>
            📋 Data Source Provenance
          </h3>
          <p className="text-xs mb-3" style={{color: 'var(--color-text-secondary)'}}>
            Transparency: all data sources are explicitly labeled. The system never silently presents fixture data as live-scraped data.
          </p>
          <ProvenanceSummary provenance={provenanceData.fare_data} />
          {provenanceData.government_data?.length > 0 && (
            <div style={{marginTop: '1rem'}}>
              <h4 className="text-xs font-semibold mb-2" style={{color: 'var(--color-text-secondary)'}}>Government Data Sources</h4>
              <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                {provenanceData.government_data.map(gs => (
                  <div key={gs.source} style={{
                    padding: '0.5rem 0.75rem', borderRadius: '8px',
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                    fontSize: '0.7rem',
                  }}>
                    <div style={{fontWeight: 600, color: 'var(--color-text)'}}>{gs.source_label}</div>
                    <div style={{color: 'var(--color-text-secondary)'}}>
                      {gs.record_count} records
                      {gs.is_fixture && <DataProvenanceBadge provenance="fixture_fallback" size="sm" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Model Performance Section */}
      {/* ============================================================ */}
      <div className="card animate-fade-in-up" style={{animationDelay: '340ms'}}>
        <div className="px-6 py-4" style={{borderBottom: '1px solid var(--color-border)'}}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{color: 'var(--color-text)'}}>
                <span style={{marginRight: '8px'}}>🧠</span>
                Anomaly Detector Performance
              </h3>
              <p className="text-xs mt-1" style={{color: 'var(--color-text-secondary)'}}>
                Model versioning &amp; accuracy trend over time
              </p>
            </div>
            {modelVersions.length > 0 && (() => {
              const active = modelVersions.find(m => m.is_active)
              return active ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{background: 'var(--color-success)'}} />
                  <span className="text-xs font-semibold px-3 py-1 rounded-full"
                        style={{background: 'var(--color-success-soft, rgba(16,185,129,0.1))', color: 'var(--color-success)'}}>
                    Active: v{active.version}
                  </span>
                </div>
              ) : null
            })()}
          </div>
        </div>

        {modelsLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : modelVersions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{color: 'var(--color-text-light)'}}>
              No trained models yet. Run <code style={{
                background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px',
                fontFamily: 'monospace', fontSize: '0.8em'
              }}>python manage.py train_anomaly_detector</code> to train the first model.
            </p>
          </div>
        ) : (
          <>
            {/* Performance Chart */}
            {chartData.length > 1 && (
              <div className="px-6 py-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="version" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                           tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
                        borderRadius: '8px', fontSize: '12px', color: 'var(--color-text)',
                      }}
                      formatter={(value) => [`${value}%`]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="recall" stroke="#10b981" strokeWidth={2}
                          dot={{ r: 4 }} activeDot={{ r: 6 }} name="Anomaly Recall" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Versions Table */}
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Trained At</th>
                    <th>Records</th>
                    <th>Recall</th>
                    <th>Algorithm</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {modelVersions.map(m => (
                    <tr key={m.version} style={m.is_active ? {background: 'var(--color-success-soft, rgba(16,185,129,0.05))'} : {}}>
                      <td>
                        <span className="font-semibold text-sm">v{m.version}</span>
                      </td>
                      <td className="text-sm">
                        {new Date(m.trained_at).toLocaleString('en-IN', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="text-sm font-medium">
                        {m.record_count?.toLocaleString()}
                      </td>
                      <td>
                        <span className="font-semibold text-sm" style={{color: '#10b981'}}>
                          {formatPct(m.metrics?.recall)}
                        </span>
                      </td>
                      <td className="text-sm font-medium">
                        PyOD ECOD
                      </td>
                      <td>
                        {m.is_active ? (
                          <span className="badge" style={{
                            background: 'var(--color-success-soft, rgba(16,185,129,0.1))',
                            color: 'var(--color-success)',
                          }}>
                            ● Active
                          </span>
                        ) : (
                          <span className="text-xs" style={{color: 'var(--color-text-light)'}}>
                            Retired
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Filters + Table */}
      <div className="card animate-fade-in-up" style={{animationDelay: '380ms'}}>
        {/* Filters */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{borderBottom: '1px solid var(--color-border)'}}>
          <span className="text-xs font-semibold uppercase" style={{color: 'var(--color-text-secondary)'}}>
            Filters
          </span>

          <select
            value={filterFlag}
            onChange={(e) => setFilterFlag(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          >
            <option value="all">All Flag Types</option>
            <option value="price_outlier">Price Outlier</option>
            <option value="statistical_outlier">Statistical Outlier</option>
            <option value="pyod_anomaly">PyOD Anomaly</option>
            <option value="pyod_clean">PyOD Clean</option>
          </select>

          <select
            value={filterRoute}
            onChange={(e) => setFilterRoute(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          >
            <option value="all">All Routes</option>
            {uniqueRoutes.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <span className="text-xs ml-auto" style={{color: 'var(--color-text-light)'}}>
            Showing {filtered.length} of {records.length} flagged records
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Date</th>
                <th>Fare</th>
                <th>Source</th>
                <th>Provenance</th>
                <th>Flag Type</th>
                <th>Deviation</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{color: 'var(--color-text-light)'}}>
                    No flagged records match the current filters
                  </td>
                </tr>
              ) : (
                filtered.map(record => {
                  const flagStyle = FLAG_STYLES[record.flag_type] || {}
                  // Derive direction label for plain-language explanation
                  const directionLabel = record.magnitude != null
                    ? (record.total_fare > 0 ? 'above' : 'below')
                    : null
                  // Plain-language explanation of the anomaly
                  const isPyOD = record.flag_type === 'pyod_anomaly'
                  return (
                    <tr key={record.id}>
                      <td>
                        <span className="font-semibold text-sm">{record.route}</span>
                      </td>
                      <td className="text-sm">
                        {new Date(record.departure_date).toLocaleDateString('en-IN', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </td>
                      <td className="font-medium">{formatINR(record.total_fare)}</td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-md"
                              style={{background: 'var(--color-bg)', color: 'var(--color-text-secondary)'}}>
                          {record.source}
                        </span>
                      </td>
                      <td>
                        <DataProvenanceBadge provenance={record.provenance || 'unknown'} size="sm" />
                      </td>
                      <td>
                        <span className="badge" style={{background: flagStyle.bg, color: flagStyle.color}}>
                          {flagStyle.label || record.flag_type}
                        </span>
                      </td>
                      <td>
                        {record.magnitude != null ? (
                          <div>
                            <span className="font-semibold text-sm" style={{
                              color: record.magnitude > 30 ? 'var(--color-danger)' : 'var(--color-warning)'
                            }}>
                              {record.magnitude.toFixed(1)}% {directionLabel} avg
                            </span>
                            {isPyOD && (
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                                PyOD (ECOD) anomaly detector
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-light)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
