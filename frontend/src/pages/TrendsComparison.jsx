import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { fetchRoutes, fetchIndex } from '../api/client'
import ChartCard from '../components/ChartCard'
import PeriodToggle from '../components/PeriodToggle'
import LoadingSpinner from '../components/LoadingSpinner'
import MantisChartTooltip from '../components/MantisChartTooltip'

// Mantis Multi-Series Line Palette
const ROUTE_COLORS = [
  '#1677FF', '#13C2C2', '#52C41A', '#FAAD14', '#722ED1', '#FF4D4F'
]

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

export default function TrendsComparison() {
  const [routes, setRoutes] = useState([])
  const [selectedRoutes, setSelectedRoutes] = useState([])
  const [chartData, setChartData] = useState([])
  const [period, setPeriod] = useState('daily')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRoutes().then(data => {
      setRoutes(data)
      // Default: first 3 routes
      setSelectedRoutes(data.slice(0, 3).map(r => r.route))
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedRoutes.length === 0) {
      setChartData([])
      return
    }

    setLoading(true)

    Promise.all(
      selectedRoutes.map(route =>
        fetchIndex({ route, period }).then(data => ({ route, data }))
      )
    ).then(results => {
      // Merge into a single dataset keyed by date
      const dateMap = {}
      results.forEach(({ route, data }) => {
        data.forEach(row => {
          if (!dateMap[row.index_date]) {
            dateMap[row.index_date] = { index_date: row.index_date }
          }
          dateMap[row.index_date][route] = parseFloat(row.index_value)
          dateMap[row.index_date][`${route}_fare`] = parseFloat(row.avg_fare)
        })
      })

      const merged = Object.values(dateMap).sort((a, b) => a.index_date.localeCompare(b.index_date))
      setChartData(merged)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [selectedRoutes, period])

  const toggleRoute = (route) => {
    setSelectedRoutes(prev => {
      if (prev.includes(route)) {
        return prev.filter(r => r !== route)
      }
      if (prev.length >= 3) return prev
      return [...prev, route]
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Route Comparison</h1>
        <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
          Side-by-side index trajectories and benchmark statistics across key routes
        </p>
      </div>

      {/* Route Selector */}
      <div className="card p-5 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">
              Select Routes to Compare
            </h3>
            <p className="text-xs sm:text-sm mt-0.5" style={{color: 'var(--color-text-secondary)'}}>
              Choose up to 3 routes for side-by-side comparison
            </p>
          </div>
          <span className="text-xs" style={{color: 'var(--color-text-light)'}}>
            {selectedRoutes.length}/3 selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {routes.map((route, i) => {
            const isSelected = selectedRoutes.includes(route.route)
            const colorIdx = selectedRoutes.indexOf(route.route)

            return (
              <button
                key={route.route}
                onClick={() => toggleRoute(route.route)}
                className="px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                style={{
                  background: isSelected ? ROUTE_COLORS[colorIdx] : 'transparent',
                  color: isSelected ? (colorIdx === 0 ? '#1D1D1B' : '#fff') : 'var(--color-text-secondary)',
                  borderColor: isSelected ? ROUTE_COLORS[colorIdx] : 'var(--color-border)',
                  opacity: !isSelected && selectedRoutes.length >= 3 ? 0.4 : 1,
                }}
                disabled={!isSelected && selectedRoutes.length >= 3}
              >
                {route.route}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comparison Chart */}
      <ChartCard
        title="Index Comparison"
        subtitle={`Comparing ${selectedRoutes.join(', ') || 'no routes selected'}`}
        delay={100}
        actions={<PeriodToggle value={period} onChange={setPeriod} />}
      >
        {loading ? (
          <LoadingSpinner />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm" style={{color: 'var(--color-text-light)'}}>
            Select routes above to see comparison
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="index_date" tickFormatter={formatDate} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} stroke="var(--color-border)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                  borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13,
                  color: 'var(--color-text)',
                }}
                labelFormatter={(l) => new Date(l).toLocaleDateString('en-IN', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
                formatter={(v, name) => [parseFloat(v).toFixed(2), name]}
              />
              <Legend />
              {selectedRoutes.map((route, i) => (
                <Line
                  key={route}
                  type="monotone"
                  dataKey={route}
                  stroke={ROUTE_COLORS[i]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: ROUTE_COLORS[i], stroke: '#1D1D1B', strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Comparison Table */}
      {selectedRoutes.length > 0 && (
        <div className="card animate-fade-in-up overflow-hidden" style={{animationDelay: '200ms'}}>
          <div className="px-6 pt-5 pb-3">
            <h3 className="section-title">
              Route Metrics Comparison
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {selectedRoutes.map((route, i) => (
                    <th key={route}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{background: ROUTE_COLORS[i]}} />
                        {route}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Latest Index</td>
                  {selectedRoutes.map(route => {
                    const r = routes.find(x => x.route === route)
                    return (
                      <td key={route} className="font-semibold">
                        {r?.latest_index ? parseFloat(r.latest_index).toFixed(1) : '-'}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="font-medium">Avg Fare</td>
                  {selectedRoutes.map(route => {
                    const r = routes.find(x => x.route === route)
                    return <td key={route}>{formatINR(r?.avg_fare)}</td>
                  })}
                </tr>
                <tr>
                  <td className="font-medium">Total Observations</td>
                  {selectedRoutes.map(route => {
                    const r = routes.find(x => x.route === route)
                    return <td key={route}>{r?.total_observations?.toLocaleString() || '-'}</td>
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
