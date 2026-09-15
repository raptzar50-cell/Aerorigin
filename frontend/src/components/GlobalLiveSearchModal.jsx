import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchLiveFares, fetchFlightInfo } from '../api/client'
import AirportSelector, { POPULAR_AIRPORTS } from './AirportSelector'

export default function GlobalLiveSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('fares') // 'fares' | 'flight'
  const [origin, setOrigin] = useState('DEL')
  const [destination, setDestination] = useState('BOM')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })
  const [flightNumber, setFlightNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const modalRef = useRef(null)

  // Listen for ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFareSearch = async (e) => {
    e?.preventDefault?.()
    if (!origin || !destination) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await searchLiveFares({ origin, destination, date })
      setResults({ type: 'fares', data })
    } catch (err) {
      setError(err.response?.data?.error || 'Live fare search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFlightLookup = async (e) => {
    e?.preventDefault?.()
    if (!flightNumber.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await fetchFlightInfo(flightNumber.trim())
      setResults({ type: 'flight', data })
    } catch (err) {
      setError(err.response?.data?.error || `No active flight found for ${flightNumber}.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSwap = () => {
    const tmp = origin
    setOrigin(destination)
    setDestination(tmp)
  }

  const handleViewFullResults = () => {
    if (activeTab === 'fares') {
      navigate(`/live-flights?origin=${origin}&destination=${destination}&date=${date}`)
    } else {
      navigate(`/live-flights?flight_number=${encodeURIComponent(flightNumber)}`)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header with Search Mode Tabs */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab('fares'); setResults(null); setError('') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'fares' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                background: activeTab === 'fares' ? 'var(--color-brand-yellow)' : 'transparent',
                color: activeTab === 'fares' ? '#000' : 'var(--color-text)',
              }}
            >
              <span>✈️</span> Live Flight Fares
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('flight'); setResults(null); setError('') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'flight' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                background: activeTab === 'flight' ? 'var(--color-brand-yellow)' : 'transparent',
                color: activeTab === 'flight' ? '#000' : 'var(--color-text)',
              }}
            >
              <span>📡</span> Flight Tracker
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold opacity-60 hover:opacity-100 hover:bg-white/10 transition-all"
            style={{ color: 'var(--color-text)' }}
          >
            ✕
          </button>
        </div>

        {/* Input Form */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
          {activeTab === 'fares' ? (
            <form onSubmit={handleFareSearch} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <AirportSelector
                  label="From"
                  value={origin}
                  onChange={setOrigin}
                  excludeCode={destination}
                />

                <button
                  type="button"
                  onClick={handleSwap}
                  className="mt-5 p-2 rounded-xl border hover:opacity-80 transition-all self-center"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-brand-yellow)' }}
                  title="Swap Origin & Destination"
                >
                  ⇄
                </button>

                <AirportSelector
                  label="To"
                  value={destination}
                  onChange={setDestination}
                  excludeCode={origin}
                />

                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-semibold mb-1 block uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                    Departure
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border outline-none font-medium"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {/* Quick Date Presets */}
                <div className="flex items-center gap-1">
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: '+3 Days', days: 3 },
                    { label: '+7 Days', days: 7 },
                    { label: '+14 Days', days: 14 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() + preset.days)
                        setDate(d.toISOString().split('T')[0])
                      }}
                      className="px-2 py-1 rounded text-[11px] font-medium border hover:opacity-90 transition-all"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                  style={{
                    background: 'var(--color-brand-yellow)',
                    color: '#000',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Searching Google Flights...
                    </>
                  ) : (
                    <>
                      <span>🔍</span> Search Real-Time Fares
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFlightLookup} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold mb-1 block uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                  Flight Number (IATA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AI7695, 6E329, QP1407, UK812"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                  className="w-full text-sm p-3 rounded-xl border outline-none font-mono font-bold uppercase"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !flightNumber.trim()}
                className="px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                style={{
                  background: 'var(--color-brand-yellow)',
                  color: '#000',
                }}
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Checking Radar...
                  </>
                ) : (
                  <>
                    <span>📡</span> Track Flight
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[420px]">
          {error && (
            <div className="p-4 rounded-xl border mb-3 flex items-center gap-3"
                 style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
              <span>⚠️</span>
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          {!loading && !results && !error && (
            <div className="py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-2xl mb-2">⚡</p>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                {activeTab === 'fares' ? 'Search 100% Real-Time Flight Fares' : 'Live Flight Radar Tracking'}
              </p>
              <p className="text-xs max-w-sm mx-auto">
                {activeTab === 'fares'
                  ? 'Queries Google Flights instantly across airlines with price benchmarks and deal alerts.'
                  : 'Track live status, delays, terminal and gate assignments across Indian airspace.'}
              </p>
            </div>
          )}

          {/* Fare Results List */}
          {results?.type === 'fares' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                    {results.data.total_results} Flights Found for {results.data.route}
                  </span>
                  {results.data.summary?.historical_route_avg && (
                    <span className="text-[11px] ml-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Route Avg: ₹{Math.round(results.data.summary.historical_route_avg).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleViewFullResults}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: 'var(--color-brand-yellow)' }}
                >
                  Open in Live Flights →
                </button>
              </div>

              {results.data.flights.slice(0, 6).map((flight, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border flex items-center justify-between hover:border-yellow-500/40 transition-all"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs"
                         style={{ background: 'var(--color-surface)', color: 'var(--color-brand-yellow)' }}>
                      ✈️
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                          {flight.airline}
                        </span>
                        {flight.flight_number && (
                          <span className="text-[10px] font-mono opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                            {flight.flight_number}
                          </span>
                        )}
                        {flight.deal_tag && flight.deal_tag !== 'Standard Fare' && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            flight.deal_type === 'deal' || flight.deal_type === 'best_price'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {flight.deal_tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        {flight.departure_time ? flight.departure_time.split(' ')[1] || flight.departure_time : '--:--'} →{' '}
                        {flight.arrival_time ? flight.arrival_time.split(' ')[1] || flight.arrival_time : '--:--'}{' '}
                        • {Math.floor(flight.duration_minutes / 60)}h {flight.duration_minutes % 60}m{' '}
                        • {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-bold" style={{ color: 'var(--color-brand-yellow)' }}>
                      ₹{Math.round(flight.total_price).toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-light)' }}>
                      Total fare
                    </span>
                  </div>
                </div>
              ))}

              {results.data.flights.length > 6 && (
                <button
                  onClick={handleViewFullResults}
                  className="w-full py-2.5 rounded-xl border text-center text-xs font-bold hover:opacity-90 transition-all"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  View All {results.data.total_results} Flights & Filters →
                </button>
              )}
            </div>
          )}

          {/* Single Flight Tracking Result */}
          {results?.type === 'flight' && (
            <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold font-mono" style={{ color: 'var(--color-text)' }}>
                    {results.data.flight_number}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {results.data.airline}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase"
                      style={{
                        background: results.data.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 166, 35, 0.2)',
                        color: results.data.status === 'active' ? '#10b981' : 'var(--color-brand-yellow)',
                      }}>
                  ● {results.data.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-text-secondary)' }}>Origin</span>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-brand-yellow)' }}>{results.data.origin || '---'}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text)' }}>
                    {results.data.scheduled_departure ? new Date(results.data.scheduled_departure).toLocaleTimeString() : '-'}
                  </p>
                  {results.data.terminal && (
                    <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Terminal {results.data.terminal}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-text-secondary)' }}>Destination</span>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-success, #10b981)' }}>{results.data.destination || '---'}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text)' }}>
                    {results.data.scheduled_arrival ? new Date(results.data.scheduled_arrival).toLocaleTimeString() : '-'}
                  </p>
                  {results.data.gate && (
                    <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Gate {results.data.gate}</p>
                  )}
                </div>
              </div>

              {results.data.delay_minutes > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs">
                  ⏱ Delay reported: {results.data.delay_minutes} minutes
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex items-center justify-between text-[11px]"
             style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          <span>Powered by SerpAPI Google Flights & AviationStack</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded border text-[10px]">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
