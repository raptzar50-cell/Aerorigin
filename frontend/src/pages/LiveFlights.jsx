import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchLiveFares, fetchFlightInfo, fetchFlightsForRoute, fetchLiveAirportsTraffic } from '../api/client'
import AirportSelector, { POPULAR_AIRPORTS } from '../components/AirportSelector'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  active: 'Active / En Route',
  en_route: 'En Route',
  landed: 'Landed',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
}

const STATUS_ICONS = {
  scheduled: '🕐',
  active: '✈️',
  en_route: '✈️',
  landed: '✅',
  delayed: '⚠️',
  cancelled: '❌',
}

const formatTime = (iso) => {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return typeof iso === 'string' && iso.includes(' ') ? iso.split(' ')[1] : String(iso)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return String(iso || '-')
  }
}

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return typeof iso === 'string' ? iso.split(' ')[0] : String(iso)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return String(iso || '')
  }
}

/* ============================================================================
   FARE SEARCH CARD (Google Flights Live Quotes)
   ============================================================================ */
function LiveFareCard({ flight }) {
  if (!flight) return null

  const isDeal = flight.deal_type === 'deal' || flight.deal_type === 'best_price'
  const isPeak = flight.deal_type === 'peak'

  const departureStr = typeof flight.departure_time === 'string' ? flight.departure_time : ''
  const arrivalStr = typeof flight.arrival_time === 'string' ? flight.arrival_time : ''

  const depTime = departureStr.includes(' ') ? departureStr.split(' ')[1] : (departureStr || '--:--')
  const depDate = departureStr.includes(' ') ? departureStr.split(' ')[0] : 'Departure'
  const arrTime = arrivalStr.includes(' ') ? arrivalStr.split(' ')[1] : (arrivalStr || '--:--')
  const arrDate = arrivalStr.includes(' ') ? arrivalStr.split(' ')[0] : 'Arrival'

  const baseFare = Number(flight.fare_base) || (Number(flight.total_price) * 0.85) || 0
  const taxesFare = Number(flight.taxes) || (Number(flight.total_price) - baseFare) || 0
  const totalFare = Number(flight.total_price) || 0

  return (
    <div className="card p-5 animate-fade-in-up hover:border-yellow-500/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm"
               style={{ background: 'var(--color-bg)', color: 'var(--color-brand-yellow)' }}>
            ✈️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
                {flight.airline}
              </h4>
              {flight.flight_number && (
                <span className="text-xs font-mono px-2 py-0.5 rounded border opacity-80"
                      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                  {flight.flight_number}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {flight.cabin_class || 'Economy'} • Verified Live Quote
            </p>
          </div>
        </div>

        {flight.deal_tag && flight.deal_tag !== 'Standard Fare' && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            isDeal
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : isPeak
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {flight.deal_tag}
          </span>
        )}
      </div>

      {/* Flight Timeline */}
      <div className="flex items-center justify-between my-4 p-3.5 rounded-xl border"
           style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <div className="text-left">
          <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-brand-yellow)' }}>
            {depTime}
          </p>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {depDate}
          </p>
        </div>

        <div className="flex-1 px-4 text-center">
          <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            {flight.duration_minutes
              ? `${Math.floor(flight.duration_minutes / 60)}h ${flight.duration_minutes % 60}m`
              : 'Direct'}
          </p>
          <div className="relative flex items-center justify-center">
            <div className="h-0.5 w-full bg-border" style={{ background: 'var(--color-border)' }} />
            <span className="absolute px-2 text-xs font-bold rounded-full text-[10px]"
                  style={{
                    background: 'var(--color-surface)',
                    color: flight.stops === 0 ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)',
                  }}>
              {flight.stops === 0 ? 'Non-Stop' : `${flight.stops} Stop`}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-success, #10b981)' }}>
            {arrTime}
          </p>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {arrDate}
          </p>
        </div>
      </div>

      {/* Pricing & Split Breakdown */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>
          <span>Base: ₹{Math.round(baseFare).toLocaleString('en-IN')}</span>
          <span className="mx-1.5">•</span>
          <span>Taxes: ₹{Math.round(taxesFare).toLocaleString('en-IN')}</span>
        </div>

        <div className="text-right">
          <span className="text-2xl font-black" style={{ color: 'var(--color-brand-yellow)' }}>
            ₹{Math.round(totalFare).toLocaleString('en-IN')}
          </span>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Total per passenger
          </p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   RADAR FLIGHT CARD (AviationStack Live Flights)
   ============================================================================ */
function FlightRadarCard({ flight }) {
  const statusKey = (flight.status || 'scheduled').toLowerCase()
  return (
    <div className="card p-5 animate-fade-in-up">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold font-mono" style={{ color: 'var(--color-text)' }}>
              {flight.flight_number}
            </span>
            <span className={`badge status-${statusKey}`}>
              {STATUS_ICONS[statusKey] || '✈️'} {STATUS_LABELS[statusKey] || flight.status}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {flight.airline}
          </p>
        </div>
        {flight.aircraft_type && (
          <span className="text-xs px-2 py-1 rounded-lg font-mono"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
            {flight.aircraft_type}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-yellow)' }}>{flight.origin}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {flight.terminal && `Terminal ${flight.terminal}`}
          </p>
          {flight.gate && (
            <p className="text-xs" style={{ color: 'var(--color-text-light)' }}>Gate {flight.gate}</p>
          )}
        </div>

        <div className="flex-1 relative px-4">
          <div className="h-px w-full" style={{ background: 'var(--color-border)' }} />
          <svg className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
               viewBox="0 0 24 24" fill="var(--color-brand-yellow)" stroke="none">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-success, #10b981)' }}>{flight.destination}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-3 rounded-xl" style={{ background: 'var(--color-bg)' }}>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Departure</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {formatTime(flight.scheduled_departure)}
          </p>
          {flight.actual_departure && flight.actual_departure !== flight.scheduled_departure && (
            <p className="text-xs" style={{ color: 'var(--color-warning, #f59e0b)' }}>
              Actual: {formatTime(flight.actual_departure)}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--color-text-light)' }}>
            {formatDate(flight.scheduled_departure)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Arrival</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {formatTime(flight.scheduled_arrival)}
          </p>
          {flight.actual_arrival && flight.actual_arrival !== flight.scheduled_arrival && (
            <p className="text-xs" style={{ color: 'var(--color-warning, #f59e0b)' }}>
              Actual: {formatTime(flight.actual_arrival)}
            </p>
          )}
        </div>
      </div>

      {flight.delay_minutes > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="badge badge-warning">
            ⏱ {flight.delay_minutes} min delay
          </span>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   MAIN LIVE FLIGHTS PAGE
   ============================================================================ */
export default function LiveFlights() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialOrigin = searchParams.get('origin') || 'DEL'
  const initialDest = searchParams.get('destination') || 'BOM'
  const initialDate = searchParams.get('date') || (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })()
  const initialFlight = searchParams.get('flight_number') || ''

  // Mode: 'fares' (Google Flights live prices) vs 'radar' (AviationStack status)
  const [activeTab, setActiveTab] = useState(initialFlight ? 'radar' : 'fares')
  const [radarSubMode, setRadarSubMode] = useState(initialFlight ? 'flight' : 'route')

  // Search parameters
  const [origin, setOrigin] = useState(initialOrigin)
  const [destination, setDestination] = useState(initialDest)
  const [date, setDate] = useState(initialDate)
  const [cabin, setCabin] = useState('ECONOMY')
  const [flightNumber, setFlightNumber] = useState(initialFlight)

  // Filter & sorting states for fares
  const [selectedAirlines, setSelectedAirlines] = useState([])
  const [directOnly, setDirectOnly] = useState(false)
  const [sortBy, setSortBy] = useState('price') // 'price' | 'duration' | 'departure'

  // Results & network states
  const [fareResults, setFareResults] = useState(null)
  const [radarResults, setRadarResults] = useState(null)
  const [trafficData, setTrafficData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load live hub traffic for airspace overview
  useEffect(() => {
    fetchLiveAirportsTraffic()
      .then(setTrafficData)
      .catch(console.error)
  }, [])

  const autoSearchedRef = useRef(false)

  // Auto-search if navigated with parameters (runs only once on mount)
  useEffect(() => {
    if (autoSearchedRef.current) return
    autoSearchedRef.current = true

    if (initialFlight) {
      setActiveTab('radar')
      setRadarSubMode('flight')
      handleRadarSearch(null, initialFlight)
    } else if (initialOrigin && initialDest) {
      handleFareSearch(null, initialOrigin, initialDest, initialDate, false)
    }
  }, [])

  // Execute Live Fare Search (Google Flights)
  const handleFareSearch = async (e, orig = origin, dest = destination, dt = date, updateUrl = true) => {
    e?.preventDefault?.()
    if (!orig || !dest) return
    setError('')
    setLoading(true)
    setFareResults(null)

    try {
      const data = await searchLiveFares({
        origin: orig,
        destination: dest,
        date: dt,
        cabin,
        sort: sortBy,
      })
      setFareResults(data)
      if (updateUrl) {
        setSearchParams({ origin: orig, destination: dest, date: dt })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Live fare search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Execute Live Flight Radar Search (AviationStack)
  const handleRadarSearch = async (e, fNum = flightNumber) => {
    e?.preventDefault?.()
    setError('')
    setLoading(true)
    setRadarResults(null)

    try {
      if (radarSubMode === 'flight' || fNum) {
        const queryNum = (fNum || flightNumber).trim()
        if (!queryNum) return
        const data = await fetchFlightInfo(queryNum)
        setRadarResults([data])
        setSearchParams({ flight_number: queryNum })
      } else {
        const data = await fetchFlightsForRoute(origin, destination, date || undefined)
        setRadarResults(data)
        setSearchParams({ origin, destination, date })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Flight tracker search failed. Please check the flight number or route.')
    } finally {
      setLoading(false)
    }
  }

  const handleSwapAirports = () => {
    const temp = origin
    setOrigin(destination)
    setDestination(temp)
  }

  // Extract unique airlines from fare results for filter chips
  const availableAirlines = useMemo(() => {
    if (!fareResults?.flights || !Array.isArray(fareResults.flights)) return []
    const set = new Set(fareResults.flights.map(f => f?.airline).filter(Boolean))
    return Array.from(set)
  }, [fareResults])

  // Filtered & sorted live flights
  const displayedFlights = useMemo(() => {
    if (!fareResults?.flights || !Array.isArray(fareResults.flights)) return []
    let list = fareResults.flights.filter(Boolean)

    if (selectedAirlines.length > 0) {
      list = list.filter(f => selectedAirlines.includes(f.airline))
    }

    if (directOnly) {
      list = list.filter(f => f.stops === 0)
    }

    if (sortBy === 'price') {
      list.sort((a, b) => (Number(a.total_price) || 0) - (Number(b.total_price) || 0))
    } else if (sortBy === 'duration') {
      list.sort((a, b) => (Number(a.duration_minutes) || 9999) - (Number(b.duration_minutes) || 9999))
    } else if (sortBy === 'departure') {
      list.sort((a, b) => String(a.departure_time || '').localeCompare(String(b.departure_time || '')))
    }

    return list
  }, [fareResults, selectedAirlines, directOnly, sortBy])

  const toggleAirlineFilter = (airline) => {
    setSelectedAirlines(prev =>
      prev.includes(airline) ? prev.filter(a => a !== airline) : [...prev, airline]
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Mode Toggle */}
      <div className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--color-brand-yellow)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Live Airfare & Flight Intelligence Search
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                100% REAL DATA
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Real-time Google Flights prices via SerpAPI Multi-Key Pool & AviationStack Live Radar.
            </p>
          </div>

          {/* Primary View Mode Toggle */}
          <div className="period-toggle">
            <button
              className={activeTab === 'fares' ? 'active' : ''}
              onClick={() => { setActiveTab('fares'); setError(''); }}
            >
              <span>✈️</span> Live Flight Fares
            </button>
            <button
              className={activeTab === 'radar' ? 'active' : ''}
              onClick={() => { setActiveTab('radar'); setError(''); }}
            >
              <span>📡</span> Airspace Tracker
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          TAB 1: LIVE FARE SEARCH (GOOGLE FLIGHTS)
          ==================================================================== */}
      {activeTab === 'fares' && (
        <div className="space-y-6">
          {/* Search Inputs Card */}
          <div className="card p-6">
            <form onSubmit={handleFareSearch} className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <AirportSelector
                  label="Origin Airport"
                  value={origin}
                  onChange={setOrigin}
                  excludeCode={destination}
                />

                <button
                  type="button"
                  onClick={handleSwapAirports}
                  className="p-3 rounded-xl border hover:opacity-80 transition-all self-end mb-0.5"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-brand-yellow)' }}
                  title="Swap Origin and Destination"
                >
                  ⇄
                </button>

                <AirportSelector
                  label="Destination Airport"
                  value={destination}
                  onChange={setDestination}
                  excludeCode={origin}
                />

                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-semibold mb-1 block uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                    Departure Date
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
                    required
                  />
                </div>

                <div className="w-[140px]">
                  <label className="text-xs font-semibold mb-1 block uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                    Cabin Class
                  </label>
                  <select
                    value={cabin}
                    onChange={(e) => setCabin(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border outline-none font-medium"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="ECONOMY">Economy</option>
                    <option value="PREMIUM_ECONOMY">Prem. Economy</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all self-end"
                  style={{
                    background: 'var(--color-brand-yellow)',
                    color: '#000',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Searching Live Fares...
                    </>
                  ) : (
                    <>
                      <span>🔍</span> Search Live Fares
                    </>
                  )}
                </button>
              </div>

              {/* Quick Date Presets & Popular Indian Corridors */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Departure:
                  </span>
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: '+3 Days', days: 3 },
                    { label: '+7 Days', days: 7 },
                    { label: '+14 Days', days: 14 },
                    { label: '+21 Days', days: 21 },
                    { label: '+30 Days', days: 30 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() + preset.days)
                        setDate(d.toISOString().split('T')[0])
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border hover:opacity-90 transition-all"
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

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Quick Routes:
                  </span>
                  {[
                    { o: 'DEL', d: 'BOM' },
                    { o: 'BLR', d: 'DEL' },
                    { o: 'BOM', d: 'BLR' },
                    { o: 'DEL', d: 'GOI' },
                    { o: 'HYD', d: 'BOM' },
                  ].map(rt => (
                    <button
                      key={`${rt.o}-${rt.d}`}
                      type="button"
                      onClick={() => {
                        setOrigin(rt.o)
                        setDestination(rt.d)
                        handleFareSearch(null, rt.o, rt.d, date)
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-bold border hover:border-yellow-500/50 transition-all"
                      style={{
                        background: origin === rt.o && destination === rt.d ? 'rgba(245, 166, 35, 0.2)' : 'var(--color-surface)',
                        borderColor: origin === rt.o && destination === rt.d ? 'var(--color-brand-yellow)' : 'var(--color-border)',
                        color: origin === rt.o && destination === rt.d ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {rt.o}→{rt.d}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2"
                   style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                <span>⚠️</span> {error}
              </div>
            )}
          </div>

          {/* Loading state */}
          {loading && <LoadingSpinner />}

          {/* Results Area */}
          {!loading && fareResults && (
            <div className="space-y-4">
              {/* Intelligence Summary Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Lowest Fare</span>
                  <p className="text-2xl font-black mt-1" style={{ color: 'var(--color-brand-yellow)' }}>
                    ₹{Math.round(fareResults.summary?.min_price || 0).toLocaleString('en-IN')}
                  </p>
                  <span className="text-[11px] text-emerald-400 font-semibold">Best Available Quote</span>
                </div>

                <div className="card p-4">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Average Market Fare</span>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                    ₹{Math.round(fareResults.summary?.avg_price || 0).toLocaleString('en-IN')}
                  </p>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                    Across {fareResults.total_results} flight options
                  </span>
                </div>

                <div className="card p-4">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Historical Route CPI</span>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                    {fareResults.summary?.historical_route_avg
                      ? `₹${Math.round(fareResults.summary.historical_route_avg).toLocaleString('en-IN')}`
                      : 'Benchmarking...'}
                  </p>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-light)' }}>
                    Government CPI Baseline
                  </span>
                </div>

                <div className="card p-4">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data Provenance</span>
                  <p className="text-base font-bold mt-2 text-emerald-400 flex items-center gap-1">
                    <span>✓</span> Verified Live Scraping
                  </p>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {fareResults.cached ? 'Serving cached snapshot (5m)' : `Scraped in ${fareResults.latency_ms}ms`}
                  </span>
                </div>
              </div>

              {/* Filter and Sort Toolbar */}
              <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
                {/* Airline Filter Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold mr-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Airlines:
                  </span>
                  {availableAirlines.map(airline => {
                    const active = selectedAirlines.includes(airline)
                    return (
                      <button
                        key={airline}
                        onClick={() => toggleAirlineFilter(airline)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                        style={{
                          background: active ? 'var(--color-brand-yellow)' : 'var(--color-surface)',
                          borderColor: active ? 'var(--color-brand-yellow)' : 'var(--color-border)',
                          color: active ? '#000' : 'var(--color-text)',
                        }}
                      >
                        {airline}
                      </button>
                    )
                  })}
                  {selectedAirlines.length > 0 && (
                    <button
                      onClick={() => setSelectedAirlines([])}
                      className="text-xs font-semibold ml-2 underline"
                      style={{ color: 'var(--color-brand-yellow)' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Direct Only & Sorting */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text)' }}>
                    <input
                      type="checkbox"
                      checked={directOnly}
                      onChange={(e) => setDirectOnly(e.target.checked)}
                      className="rounded accent-yellow-500"
                    />
                    Direct Flights Only
                  </label>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-xs p-1.5 rounded-lg border outline-none"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <option value="price">Lowest Price</option>
                      <option value="duration">Shortest Duration</option>
                      <option value="departure">Earliest Departure</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Flights Grid */}
              {displayedFlights.length === 0 ? (
                <div className="card p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                  No flights match the current filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {displayedFlights.map((flight, idx) => (
                    <LiveFareCard key={`${flight.flight_number}-${idx}`} flight={flight} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: RADAR & FLIGHT TRACKER (AVIATIONSTACK)
          ==================================================================== */}
      {activeTab === 'radar' && (
        <div className="space-y-6">
          {/* Tracker Search Form */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Live Aircraft & Airspace Tracker
            </h3>

            <div className="period-toggle mb-4">
              <button
                className={radarSubMode === 'flight' ? 'active' : ''}
                onClick={() => setRadarSubMode('flight')}
              >
                By Flight Number
              </button>
              <button
                className={radarSubMode === 'route' ? 'active' : ''}
                onClick={() => setRadarSubMode('route')}
              >
                By Route
              </button>
            </div>

            <form onSubmit={handleRadarSearch} className="flex flex-wrap items-end gap-3">
              {radarSubMode === 'flight' ? (
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-semibold mb-1 block uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                    Flight Number
                  </label>
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    className="w-full text-sm p-3 rounded-xl border outline-none font-mono font-bold"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="e.g. AI7695, 6E329, QP1407"
                    required
                  />
                </div>
              ) : (
                <>
                  <AirportSelector
                    label="Origin"
                    value={origin}
                    onChange={setOrigin}
                    excludeCode={destination}
                  />
                  <AirportSelector
                    label="Destination"
                    value={destination}
                    onChange={setDestination}
                    excludeCode={origin}
                  />
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                style={{
                  background: 'var(--color-brand-yellow)',
                  color: '#000',
                }}
              >
                {loading ? 'Searching Radar...' : 'Track Flight Status'}
              </button>
            </form>

            {error && (
              <div className="mt-3 p-3 rounded-xl text-xs font-medium border"
                   style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                {error}
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && <LoadingSpinner />}

          {/* Results */}
          {radarResults && radarResults.length === 0 && (
            <div className="card p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              No active or scheduled flights found matching this query.
            </div>
          )}

          {radarResults && radarResults.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                {radarResults.length} Live Flight{radarResults.length !== 1 ? 's' : ''} Reported
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {radarResults.map((f, idx) => (
                  <FlightRadarCard key={`${f.flight_number}-${idx}`} flight={f} />
                ))}
              </div>
            </div>
          )}

          {/* Hub Airspace Overview Board */}
          {trafficData?.activeAirports && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    Major Hub Airspace Activity (AviationStack)
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Live monitored departures across primary metro airports
                  </p>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-brand-yellow)' }}>
                  {trafficData.totalFlights} Total Tracked Flights
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {trafficData.activeAirports.map(hub => (
                  <div
                    key={hub.code}
                    className="p-3.5 rounded-xl border text-center cursor-pointer hover:border-yellow-500/50 transition-all"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    onClick={() => {
                      setOrigin(hub.code)
                      setDestination(hub.code === 'DEL' ? 'BOM' : 'DEL')
                      setActiveTab('fares')
                      handleFareSearch(null, hub.code, hub.code === 'DEL' ? 'BOM' : 'DEL', date)
                    }}
                  >
                    <span className="font-mono text-base font-bold" style={{ color: 'var(--color-brand-yellow)' }}>
                      {hub.code}
                    </span>
                    <p className="text-xs font-semibold truncate mt-0.5" style={{ color: 'var(--color-text)' }}>
                      {hub.city}
                    </p>
                    <p className="text-[11px] mt-1 font-bold text-emerald-400">
                      {hub.flightCount} Departures
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
