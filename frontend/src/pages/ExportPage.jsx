import { useState, useEffect } from 'react'
import { fetchRoutes, exportIndex, exportFares, fetchIndex } from '../api/client'

export default function ExportPage() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState('')
  const [period, setPeriod] = useState('daily')
  const [format, setFormat] = useState('csv')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportType, setExportType] = useState('index')
  const [preview, setPreview] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    fetchRoutes().then(setRoutes).catch(console.error)
  }, [])

  useEffect(() => {
    if (exportType === 'index') {
      setLoadingPreview(true)
      fetchIndex({ route: selectedRoute || undefined, period })
        .then(data => {
          setPreview(data.slice(0, 10))
          setLoadingPreview(false)
        })
        .catch(() => setLoadingPreview(false))
    }
  }, [exportType, selectedRoute, period])

  const handleExport = () => {
    const params = { format }
    if (selectedRoute) params.route = selectedRoute
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate

    if (exportType === 'index') {
      params.period = period
      exportIndex(params)
    } else {
      exportFares(params)
    }
  }

  const inputStyle = {
    padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
    color: 'var(--color-text)', width: '100%',
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{color: 'var(--color-text)'}}>
          📤 Data Export
        </h1>
        <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
          Export price index time series and cleaned fare observations for external statistical analysis (Excel, Stata, R, Python)
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-base sm:text-lg font-bold mb-4" style={{color: 'var(--color-text)'}}>
          Export Parameters
        </h2>

        {/* Export Type Toggle */}
        <div className="mb-5">
          <label className="text-xs sm:text-sm font-semibold uppercase tracking-wider block mb-2" style={{color: 'var(--color-text-secondary)'}}>
            Export Dataset
          </label>
          <div className="flex gap-2">
            {[
              { id: 'index', label: '📈 Price Index Data', desc: 'Normalized price index series by route/period' },
              { id: 'fares', label: '✈️ Cleaned Fare Observations', desc: 'Individual screened flight fares with quality flags' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setExportType(t.id)}
                className="flex-1 p-3.5 rounded-xl text-left border transition-all"
                style={{
                  border: exportType === t.id ? '2px solid var(--color-brand-yellow)' : '1px solid var(--color-border)',
                  background: exportType === t.id ? 'rgba(255,230,0,0.08)' : 'var(--color-bg)',
                  color: 'var(--color-text)',
                }}
              >
                <div className="text-sm font-bold">{t.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{color: 'var(--color-text-secondary)'}}>
              Route
            </label>
            <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)} style={inputStyle}>
              <option value="">All Routes (National Aggregate)</option>
              {routes.map(r => (
                <option key={r.route} value={r.route}>{r.route} ({r.origin_name} → {r.destination_name})</option>
              ))}
            </select>
          </div>

          {exportType === 'index' && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{color: 'var(--color-text-secondary)'}}>
                Aggregation Period
              </label>
              <select value={period} onChange={e => setPeriod(e.target.value)} style={inputStyle}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{color: 'var(--color-text-secondary)'}}>
              From Date
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{color: 'var(--color-text-secondary)'}}>
              To Date
            </label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{color: 'var(--color-text-secondary)'}}>
              Export Format
            </label>
            <div className="flex gap-2">
              {[{ id: 'csv', label: 'CSV (Spreadsheet/R/Stata)' }, { id: 'json', label: 'JSON (API/Python)' }].map(f => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)} className="flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all" style={{
                  border: format === f.id ? '2px solid var(--color-brand-yellow)' : '1px solid var(--color-border)',
                  background: format === f.id ? 'rgba(255,230,0,0.08)' : 'var(--color-bg)',
                  color: 'var(--color-text)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleExport} className="btn-primary mt-6 w-full py-3 text-sm font-bold shadow-lg">
          📥 Download {exportType === 'index' ? 'Index' : 'Fare'} Data as {format.toUpperCase()}
        </button>
      </div>

      {/* Preview table with 15px font & 14px row padding */}
      {exportType === 'index' && preview.length > 0 && (
        <div className="card p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold" style={{color: 'var(--color-text)'}}>
              Preview (first 10 observations)
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              10 of {preview.length} rows previewed
            </span>
          </div>
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', fontSize: '0.9375rem', borderCollapse: 'separate', borderSpacing: 0}} className="tabular-nums">
              <thead>
                <tr style={{borderBottom: '2px solid var(--color-border)'}}>
                  <th style={{padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Date</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Route</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Index Value</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Avg Fare</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Sample Size</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'}}>Period</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: i % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                    }}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <td style={{padding: '14px 16px', color: 'var(--color-text)', fontWeight: 500}}>{row.index_date}</td>
                    <td style={{padding: '14px 16px', color: 'var(--color-text)'}}>{row.route || 'National'}</td>
                    <td style={{padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)'}}>{parseFloat(row.index_value).toFixed(2)}</td>
                    <td style={{padding: '14px 16px', textAlign: 'right', color: 'var(--color-text)'}}>₹{parseFloat(row.avg_fare).toLocaleString()}</td>
                    <td style={{padding: '14px 16px', textAlign: 'right', color: 'var(--color-text-secondary)'}}>{row.sample_size}</td>
                    <td style={{padding: '14px 16px', color: 'var(--color-text-secondary)', textTransform: 'capitalize'}}>{row.period_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs sm:text-sm mt-3.5" style={{color: 'var(--color-text-secondary)'}}>
            The full export will contain all matching historical records. CSV includes a <code>base_period_note</code> column.
          </p>
        </div>
      )}

      {/* Methodology note */}
      <div className="card p-5" style={{ borderLeft: '4px solid var(--color-brand-yellow)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{color: 'var(--color-text)'}}>
          📋 Index Methodology Note
        </h3>
        <div className="text-xs" style={{color: 'var(--color-text-secondary)', lineHeight: 1.8}}>
          <p><strong>Base Period:</strong> Index = 100 is set at the average fare during the base period for each route.</p>
          <p><strong>Computation:</strong> Daily index = (current period average fare / base period average fare) × 100</p>
          <p><strong>Aggregation:</strong> National aggregate is the weighted average across all monitored routes.</p>
          <p><strong>Data Sources:</strong> Live OTA scraping, Amadeus API, SerpApi Google Flights. Government data from DGCA/MoSPI is cross-referenced but stored separately.</p>
        </div>
      </div>
    </div>
  )
}
