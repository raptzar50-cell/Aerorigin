import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import AirportSelector from './AirportSelector'

const POLLING_INTERVAL = 3000

function ElapsedTime({ startedAt }) {
  const [elapsed, setElapsed] = useState(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return <span>Running for {elapsed}s...</span>
}

export default function ScraperPanel() {
  const { role } = useAuth()
  
  const [origin, setOrigin] = useState('DEL')
  const [destination, setDestination] = useState('BOM')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  
  const [jobs, setJobs] = useState([])
  const [expandedJobId, setExpandedJobId] = useState(null)
  const [jobDetails, setJobDetails] = useState({})
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const getFormattedDate = (isoDate) => {
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  }

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/scraper/jobs/')
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
      }
    } catch (err) {
      console.error('Failed to fetch jobs', err)
    }
  }

  useEffect(() => {
    fetchJobs()
    const activeJobs = jobs.some(j => j.status === 'pending' || j.status === 'running')
    if (activeJobs) {
      const interval = setInterval(fetchJobs, POLLING_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [jobs.map(j => j.status).join(',')])

  const handleSwapAirports = () => {
    const temp = origin
    setOrigin(destination)
    setDestination(temp)
  }

  const handleRunLiveScrape = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('http://localhost:8000/api/scraper/trigger/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, date: getFormattedDate(date) })
      })
      if (res.ok) {
        fetchJobs()
      } else {
        alert('Failed to trigger scrape job.')
      }
    } catch (err) {
      console.error(err)
      alert('Error triggering scrape job.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleJobDetails = async (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
      return
    }
    setExpandedJobId(jobId)
    
    // Find job to check status
    const job = jobs.find(j => j.id === jobId)
    if (job && (job.status === 'pending' || job.status === 'running')) {
      // Don't fetch details for running jobs yet
      return
    }

    if (!jobDetails[jobId]) {
      try {
        const res = await fetch(`http://localhost:8000/api/scraper/jobs/${jobId}/`)
        if (res.ok) {
          const data = await res.json()
          setJobDetails(prev => ({ ...prev, [jobId]: data.fares }))
        }
      } catch (err) {
        console.error('Failed to fetch job details', err)
      }
    }
  }

  const handleDeleteJob = async (e, jobId) => {
    if (e) e.stopPropagation()
    setJobs(prev => prev.filter(j => j.id !== jobId))
    if (expandedJobId === jobId) setExpandedJobId(null)

    try {
      const res = await fetch(`http://localhost:8000/api/scraper/jobs/${jobId}/`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        fetchJobs()
      }
    } catch (err) {
      console.error('Failed to delete job', err)
      fetchJobs()
    }
  }

  const handleClearFailedJobs = async () => {
    setJobs(prev => prev.filter(j => j.status !== 'failed' && j.status !== 'blocked'))
    if (jobs.find(j => j.id === expandedJobId && (j.status === 'failed' || j.status === 'blocked'))) {
      setExpandedJobId(null)
    }

    try {
      const res = await fetch('http://localhost:8000/api/scraper/jobs/?status=failed', {
        method: 'DELETE',
      })
      if (!res.ok) {
        fetchJobs()
      }
    } catch (err) {
      console.error('Failed to clear failed jobs', err)
      fetchJobs()
    }
  }

  const handleDeleteFare = async (jobId, fareId) => {
    setJobDetails(prev => ({
      ...prev,
      [jobId]: (prev[jobId] || []).filter(f => f.id !== fareId)
    }))
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, result_count: Math.max(0, (j.result_count || 1) - 1) } : j))

    try {
      await fetch(`http://localhost:8000/api/scraper/fares/${fareId}/`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Failed to delete fare', err)
    }
  }

  const getStatusBadge = (job) => {
    const status = job.status
    if (status === 'running' || status === 'pending') {
      return (
        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold flex items-center gap-2 border border-blue-500/30">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
          <ElapsedTime startedAt={job.started_at} />
        </span>
      )
    }
    
    const badges = {
      success: <span className="px-2 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold">Success</span>,
      empty: <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded text-xs font-semibold">Empty</span>,
      failed: <span className="px-2 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-xs font-semibold">Failed</span>,
      blocked: <span className="px-2 py-1 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded text-xs font-semibold">Blocked</span>,
    }
    return badges[status] || badges['pending']
  }

  if (role !== 'economist' && role !== 'regulator' && role !== 'researcher') {
    return (
      <div className="p-8 text-center text-gray-400">
        You do not have permission to access the Live Scraper.
      </div>
    )
  }

  // Check if a job for the same route and date is currently running
  const formattedDate = getFormattedDate(date)
  const isJobAlreadyRunning = jobs.some(j => 
    j.origin === origin && 
    j.destination === destination && 
    j.travel_date === formattedDate && 
    (j.status === 'pending' || j.status === 'running')
  )
  const disableSubmit = isSubmitting || isJobAlreadyRunning

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--color-brand-yellow)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Live Scraper
          </h2>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Trigger on-demand scraping of current airline fares to verify anomalies and enrich intelligence.
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleRunLiveScrape} className="space-y-4">
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
                Travel Date
              </label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border outline-none font-medium"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
                required
              />
            </div>
            
            <button 
              type="submit" 
              disabled={disableSubmit}
              className="px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all self-end disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-brand-yellow)',
                color: '#000',
              }}
            >
              {disableSubmit ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <span>🔍</span> Run Live Scrape
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Recent Jobs</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              {jobs.length}
            </span>
          </div>
          {jobs.some(j => j.status === 'failed' || j.status === 'blocked') && (
            <button
              type="button"
              onClick={handleClearFailedJobs}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
              title="Delete all failed scrape jobs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Failed ({jobs.filter(j => j.status === 'failed' || j.status === 'blocked').length})
            </button>
          )}
        </div>
        
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            No scrape jobs found. Run your first scrape above.
          </div>
        ) : (
          <div className="divide-y" style={{ divideColor: 'var(--color-border)' }}>
            {jobs.map(job => {
              const isExpanded = expandedJobId === job.id;
              const isRunning = job.status === 'pending' || job.status === 'running';
              const hasError = job.status === 'failed' || job.status === 'blocked';
              
              return (
                <div key={job.id} className="flex flex-col animate-fade-in-up">
                  <div 
                    className="flex flex-wrap items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors gap-3"
                    style={{ background: isExpanded ? 'var(--color-surface)' : 'transparent' }}
                    onClick={() => toggleJobDetails(job.id)}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--color-surface-hover, rgba(255,255,255,0.02))' }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 flex-1">
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-secondary)' }}>#{job.id}</span>
                      <div className="flex flex-col">
                        <span className="text-sm sm:text-base font-bold" style={{ color: 'var(--color-text)' }}>{job.origin} → {job.destination}</span>
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Travel: {job.travel_date}</span>
                      </div>
                      {getStatusBadge(job)}
                      {job.status === 'success' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,165,181,0.12)', color: '#00A5B5', border: '1px solid rgba(0,165,181,0.25)' }}>
                            {job.is_fixture ? 'Sample Data' : 'Live Scraped'}
                          </span>
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{job.result_count} fares</span>
                          {job.completed_at && job.started_at && (
                            <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                              ({Math.max(1, Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000))}s duration)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(job.started_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteJob(e, job.id)}
                        className="w-8 h-8 rounded-lg text-xs transition-all flex items-center justify-center opacity-70 hover:opacity-100 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        title={hasError ? "Delete failed scrape job" : "Delete scrape job"}
                        aria-label="Delete scrape job"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-5 border-t animate-fade-in" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                      {hasError && job.error_message && (
                        <div className="mb-4 p-4 rounded-xl text-xs sm:text-sm font-medium border flex items-start justify-between gap-3"
                             style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                          <div className="flex items-start gap-2">
                            <span className="text-base">⚠️</span>
                            <div>
                              <span className="font-bold block mb-1">Scrape Failed or Blocked</span>
                              <span className="opacity-90">{job.error_message}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteJob(e, job.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center gap-1.5 transition-all shrink-0 self-center"
                            title="Delete this failed record"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Record
                          </button>
                        </div>
                      )}
                      
                      {isRunning ? (
                        // Skeleton Table for Running state
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm sm:text-base">
                            <thead>
                              <tr className="text-xs uppercase tracking-wider border-b font-semibold" style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
                                <th className="py-3 px-3">Airline</th>
                                <th className="py-3 px-3">Flight / Legs</th>
                                <th className="py-3 px-3">Departure</th>
                                <th className="py-3 px-3">Arrival</th>
                                <th className="py-3 px-3 text-right pr-4">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y" style={{ divideColor: 'var(--color-border)' }}>
                              {[...Array(5)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                  <td className="py-3.5 px-3"><div className="h-5 rounded w-28" style={{ background: 'var(--color-surface)' }}></div></td>
                                  <td className="py-3.5 px-3"><div className="h-5 rounded w-20" style={{ background: 'var(--color-surface)' }}></div></td>
                                  <td className="py-3.5 px-3"><div className="h-5 rounded w-16" style={{ background: 'var(--color-surface)' }}></div></td>
                                  <td className="py-3.5 px-3"><div className="h-5 rounded w-16" style={{ background: 'var(--color-surface)' }}></div></td>
                                  <td className="py-3.5 px-3"><div className="h-5 rounded w-24 ml-auto" style={{ background: 'var(--color-surface)' }}></div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        jobDetails[job.id] ? (
                          jobDetails[job.id].length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm sm:text-base tabular-nums border-collapse">
                                <thead>
                                  <tr className="text-xs uppercase tracking-wider border-b-2 font-semibold" style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
                                    <th className="py-3 px-3">Airline</th>
                                    <th className="py-3 px-3">Flight / Legs</th>
                                    <th className="py-3 px-3">Departure</th>
                                    <th className="py-3 px-3">Arrival</th>
                                    <th className="py-3 px-3 text-right pr-4">Fare (INR)</th>
                                    <th className="py-3 px-2 text-right w-10"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {jobDetails[job.id].map((fare, idx) => (
                                    <tr key={fare.id}
                                        style={{
                                          borderBottom: '1px solid var(--color-border)',
                                          background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                                        }}
                                        className="transition-colors hover:bg-white/[0.04]">
                                      <td className="py-3.5 px-3 font-semibold" style={{ color: 'var(--color-text)' }}>{fare.airline}</td>
                                      <td className="py-3.5 px-3">
                                        {fare.flight_code?.includes('/') ? (
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {fare.flight_code.split('/').map((leg, lIdx) => (
                                              <span key={lIdx} className="px-2 py-0.5 rounded text-xs font-mono font-medium border"
                                                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                                                {leg.trim()}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-xs font-mono font-medium border"
                                                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                                            {fare.flight_code || '—'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3.5 px-3 font-medium" style={{ color: 'var(--color-text)' }}>{fare.dep_time || '—'}</td>
                                      <td className="py-3.5 px-3 font-medium" style={{ color: 'var(--color-text)' }}>{fare.arr_time || '—'}</td>
                                      {/* Ordinary Price: Semantic Neutral High-Contrast Color (Not Amber) */}
                                      <td className="py-3.5 px-3 font-bold font-mono text-right pr-4 text-sm sm:text-base" style={{ color: 'var(--color-text)' }}>
                                        ₹{Math.round(fare.price).toLocaleString('en-IN')}
                                      </td>
                                      <td className="py-3.5 px-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteFare(job.id, fare.id)}
                                          className="w-8 h-8 rounded-lg text-xs opacity-60 hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all inline-flex items-center justify-center"
                                          title="Delete fare record"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center text-xs py-4 flex flex-col items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                              <span>No fares retrieved for this route.</span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteJob(e, job.id)}
                                className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete this record
                              </button>
                            </div>
                          )
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}
