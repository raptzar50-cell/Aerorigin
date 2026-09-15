import { useState, useEffect } from 'react'
import { fetchPredictionTable } from '../api/client'
import AirportSelector from './AirportSelector'
import { useAuth } from '../contexts/AuthContext'

export default function PredictionTable() {
  const { role } = useAuth()
  const [origin, setOrigin] = useState('DEL')
  const [destination, setDestination] = useState('BOM')
  const [airline, setAirline] = useState('Vistara')
  const [flightClass, setFlightClass] = useState('Economy')
  const [daysAhead, setDaysAhead] = useState(30)
  
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  
  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' })

  const loadData = async () => {
    if (!origin || !destination || origin === destination) return
    setLoading(true)
    setError(null)
    try {
      const route = `${origin}-${destination}`
      const res = await fetchPredictionTable(route, daysAhead)
      setData(res)
    } catch (err) {
      console.error(err)
      setError('Failed to fetch predictions. Ensure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount and on params change
  useEffect(() => {
    loadData()
  }, [origin, destination, airline, flightClass, daysAhead])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedPredictions = () => {
    if (!data || !data.predictions) return []
    const sorted = [...data.predictions]
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key]
      let bVal = b[sortConfig.key]
      
      if (aVal === null) aVal = sortConfig.direction === 'asc' ? Infinity : -Infinity
      if (bVal === null) bVal = sortConfig.direction === 'asc' ? Infinity : -Infinity
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }

  const renderConfidenceBadge = (confidence) => {
    switch (confidence) {
      case 'high':
        return <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-500 border border-green-500/30">High</span>
      case 'medium':
        return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">Medium</span>
      case 'low':
      default:
        return <span className="px-2 py-1 rounded text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">Low</span>
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Price Predictions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Blended forecast combining historical booking curves with live price observations.
          </p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="p-5 rounded-xl border flex flex-wrap gap-4 items-end"
           style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        
        <div className="flex-1 min-w-[200px]">
          <AirportSelector
            label="Origin"
            value={origin}
            onChange={setOrigin}
            excludeCode={destination}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <AirportSelector
            label="Destination"
            value={destination}
            onChange={setDestination}
            excludeCode={origin}
          />
        </div>
        
        <div className="flex flex-col gap-1 w-[120px]">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Days Ahead</label>
          <select 
            value={daysAhead} 
            onChange={e => setDaysAhead(Number(e.target.value))}
            className="p-3 rounded-xl border outline-none text-sm font-semibold"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1 w-[120px]">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Airline</label>
          <select 
            value={airline} 
            onChange={e => setAirline(e.target.value)}
            className="p-3 rounded-xl border outline-none text-sm font-semibold"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <option value="Vistara">Vistara</option>
            <option value="SpiceJet">SpiceJet</option>
            <option value="AirAsia">AirAsia</option>
            <option value="Indigo">Indigo</option>
            <option value="GO_FIRST">Go First</option>
            <option value="Air_India">Air India</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            Predicted Booking Curve <span className="opacity-60 text-sm ml-2">({origin}-{destination})</span>
          </h3>
          {loading && <div className="animate-spin w-5 h-5 border-2 border-t-transparent border-yellow-500 rounded-full"></div>}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm sm:text-base whitespace-nowrap tabular-nums">
            <thead className="border-b-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
              <tr>
                <th className="py-3.5 px-4 text-xs uppercase font-semibold tracking-wider cursor-pointer select-none hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleSort('date')}>
                  Date {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3.5 px-4 text-xs uppercase font-semibold tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Airline</th>
                <th className="py-3.5 px-4 text-xs uppercase font-semibold tracking-wider cursor-pointer select-none hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleSort('predicted_price')}>
                  Predicted Price {sortConfig.key === 'predicted_price' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3.5 px-4 text-xs uppercase font-semibold tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Based On</th>
                <th className="py-3.5 px-4 text-xs uppercase font-semibold tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {error ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-red-500">{error}</td>
                </tr>
              ) : !data || data.predictions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                    {loading ? 'Loading predictions...' : 'No data available.'}
                  </td>
                </tr>
              ) : (
                sortedPredictions().map((row, idx) => {
                  const isInsufficient = row.based_on === 'insufficient_data'
                  return (
                    <tr key={idx} 
                        style={{ background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent' }}
                        className={`hover:bg-white/[0.04] transition-colors ${isInsufficient ? 'opacity-40 grayscale' : ''}`}
                        title={isInsufficient ? "Not enough historical data for this route." : ""}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs sm:text-sm">{row.date} <span className="opacity-60 ml-1">({row.days_out}d out)</span></td>
                      <td className="py-3.5 px-4 font-semibold">{row.airline}</td>
                      <td className="py-3.5 px-4">
                        {row.predicted_price ? (
                          <span className="font-bold text-base sm:text-lg">₹{row.predicted_price.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs font-mono opacity-50">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs sm:text-sm font-mono capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                        {row.based_on.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderConfidenceBadge(row.confidence)}
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
