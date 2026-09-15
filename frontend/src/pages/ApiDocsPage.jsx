import { useState } from 'react'

export default function ApiDocsPage() {
  const baseUrl = window.location.origin
  const [copiedKey, setCopiedKey] = useState(null)

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const endpoints = [
    {
      category: 'Index & Routes',
      items: [
        { method: 'GET', path: '/api/routes/', desc: 'List all tracked routes with latest index values and observation counts.', auth: false },
        { method: 'GET', path: '/api/index/', desc: 'Price index time series. Supports route and period filters.', auth: false, params: 'route (optional), period=daily|weekly|monthly' },
        { method: 'GET', path: '/api/stats/', desc: 'Headline dashboard statistics including data provenance breakdown.', auth: false },
      ],
    },
    {
      category: 'Forecasting',
      items: [
        { method: 'GET', path: '/api/index-forecast/', desc: 'Chronos-2 price index forecast with 80% prediction intervals and CPI impact notes.', auth: false, params: 'route (optional)' },
        { method: 'GET', path: '/api/forecast-accuracy/', desc: 'Forecast accuracy tracking — predicted vs actual index values with MAE/MAPE metrics.', auth: false, params: 'route (optional)' },
        { method: 'GET', path: '/api/predictions/', desc: 'Legacy fare predictions (Chronos-2 raw fare forecasts).', auth: false, params: 'route (optional)' },
      ],
    },
    {
      category: 'Data Quality & Anomalies',
      items: [
        { method: 'GET', path: '/api/quality-report/', desc: 'Anomaly/flagged records summary with provenance info. Used by regulators.', auth: false },
        { method: 'GET', path: '/api/model-versions/', desc: 'Anomaly detector model versions with training metrics.', auth: false },
        { method: 'GET', path: '/api/trends/lead-time/', desc: 'Average fare bucketed by booking lead time.', auth: false, params: 'route (optional)' },
      ],
    },
    {
      category: 'Export',
      items: [
        { method: 'GET', path: '/api/export/index/', desc: 'Download price index data as CSV or JSON for external analysis.', auth: false, params: 'route, period, format=csv|json, start_date, end_date' },
        { method: 'GET', path: '/api/export/fares/', desc: 'Download cleaned fare records as CSV or JSON.', auth: false, params: 'route, format=csv|json, start_date, end_date' },
      ],
    },
    {
      category: 'Data Provenance',
      items: [
        { method: 'GET', path: '/api/data-provenance/', desc: 'Detailed breakdown of data sources (live, published, fixture) and record counts.', auth: false },
      ],
    },
    {
      category: 'Live Search & Real-Time Airfares',
      items: [
        { method: 'GET', path: '/api/live-search/', desc: 'On-demand live flight fare search powered by Google Flights (SerpAPI multi-key pool with automated failover) with CPI deal benchmarking and dynamic database indexing.', auth: false, params: 'origin=DEL, destination=BOM, date=YYYY-MM-DD, cabin=ECONOMY, sort=price|duration|departure' },
        { method: 'GET', path: '/api/airports/', desc: 'Search and autocomplete major Indian airports with IATA codes, cities, and hub metadata.', auth: false, params: 'q (query string, e.g. "del" or "mumbai")' },
      ],
    },
    {
      category: 'Live Flight Operations (AviationStack)',
      items: [
        { method: 'GET', path: '/api/flights/live/', desc: 'Real-time airborne flight counts and recent operations across major Indian hub airports.', auth: false },
        { method: 'GET', path: '/api/flights/route/', desc: 'Live flight schedules, aircraft registrations, delays, and statuses for a specific route.', auth: false, params: 'origin=DEL, destination=BOM, date=YYYY-MM-DD' },
        { method: 'GET', path: '/api/flights/info/', desc: 'Real-time tracking lookup for an individual flight by flight number.', auth: false, params: 'flight_number=6E-302' },
      ],
    },
    {
      category: 'Authentication',
      items: [
        { method: 'POST', path: '/api/auth/sync-profile/', desc: 'Sync Firebase user with Django profile. Called after Firebase login.', auth: true },
        { method: 'GET', path: '/api/auth/profile/', desc: 'Get current user profile and stakeholder role.', auth: true },
        { method: 'PATCH', path: '/api/auth/profile/', desc: 'Update role, display_name, organization, or dashboard_preferences.', auth: true },
        { method: 'GET', path: '/api/auth/roles/', desc: 'List available stakeholder roles with descriptions.', auth: false },
      ],
    },
  ]

  const codeExamples = [
    {
      lang: 'Python',
      code: `import requests
import pandas as pd

# Fetch national daily index
resp = requests.get("${baseUrl}/api/index/?period=daily")
df = pd.DataFrame(resp.json())

# Download as CSV
import urllib.request
urllib.request.urlretrieve(
    "${baseUrl}/api/export/index/?format=csv&period=daily",
    "aerogin_index.csv"
)
df = pd.read_csv("aerogin_index.csv")
print(df.describe())`,
    },
    {
      lang: 'R',
      code: `library(jsonlite)
library(httr)

# Fetch index data
resp <- GET("${baseUrl}/api/index/?period=daily")
data <- fromJSON(content(resp, "text"))
str(data)

# Download CSV
download.file(
  "${baseUrl}/api/export/index/?format=csv&period=daily",
  "aerogin_index.csv"
)
df <- read.csv("aerogin_index.csv")
summary(df)`,
    },
    {
      lang: 'curl',
      code: `# Fetch national index
curl "${baseUrl}/api/index/?period=daily"

# Download index CSV
curl -o index.csv "${baseUrl}/api/export/index/?format=csv"

# Fetch forecast with confidence intervals
curl "${baseUrl}/api/index-forecast/?route=DEL-BOM"

# Authenticated request (Firebase token)
curl -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \\
  "${baseUrl}/api/auth/profile/"`,
    },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{color: 'var(--color-text)'}}>
          📚 API Documentation
        </h1>
        <p className="text-sm mt-1.5" style={{color: 'var(--color-text-secondary)'}}>
          RESTful API for programmatic access to airfare price index data, Chronos-2 forecasts, and quality monitoring
        </p>
      </div>

      {/* Base URL & Auth Card with One-Click Copy */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--color-border)]" style={{ background: 'var(--color-bg)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{color: 'var(--color-text-secondary)'}}>Base API Endpoint</span>
            <code className="text-sm sm:text-base font-mono font-bold px-3 py-1 rounded-lg" style={{
              background: 'var(--color-surface, rgba(255,255,255,0.06))',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}>
              {baseUrl}/api
            </code>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(`${baseUrl}/api`, 'base-url')}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all"
            style={{
              background: copiedKey === 'base-url' ? 'rgba(16,185,129,0.15)' : 'var(--color-brand-yellow)',
              color: copiedKey === 'base-url' ? '#10b981' : '#000',
              border: copiedKey === 'base-url' ? '1px solid rgba(16,185,129,0.3)' : 'none',
            }}
          >
            {copiedKey === 'base-url' ? '✓ Copied URL' : '📋 Copy Base URL'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--color-border)]" style={{ background: 'var(--color-bg)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{color: 'var(--color-text-secondary)'}}>Authorization Header</span>
            <code className="text-xs sm:text-sm font-mono font-medium px-3 py-1 rounded-lg text-emerald-400" style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              Authorization: Bearer &lt;FIREBASE_ID_TOKEN&gt;
            </code>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('Authorization: Bearer <FIREBASE_ID_TOKEN>', 'auth-header')}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all text-gray-300 hover:text-white hover:bg-white/[0.06] border border-[var(--color-border)]"
          >
            {copiedKey === 'auth-header' ? '✓ Copied' : '📋 Copy Header'}
          </button>
        </div>
      </div>

      {/* Endpoints Sections */}
      {endpoints.map(cat => (
        <div key={cat.category} className="card p-6 animate-fade-in-up">
          <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2" style={{color: 'var(--color-text)'}}>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {cat.category}
          </h3>
          <div className="flex flex-col gap-3">
            {cat.items.map(ep => (
              <div key={ep.path} className="p-4 rounded-xl border border-[var(--color-border)] transition-colors hover:border-white/20" style={{
                background: 'var(--color-bg)',
              }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono" style={{
                      background: ep.method === 'GET' ? 'rgba(16,185,129,0.15)' : ep.method === 'POST' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                      color: ep.method === 'GET' ? '#10b981' : ep.method === 'POST' ? '#3b82f6' : '#f59e0b',
                      border: `1px solid ${ep.method === 'GET' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    }}>
                      {ep.method}
                    </span>
                    <code className="text-sm sm:text-base font-mono font-bold" style={{ color: 'var(--color-text)' }}>
                      {ep.path}
                    </code>
                    {ep.auth && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        AUTH REQUIRED
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${baseUrl}${ep.path}`, ep.path)}
                    className="text-xs font-semibold px-2.5 py-1 rounded text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all border border-transparent hover:border-[var(--color-border)]"
                    title="Copy full endpoint path"
                  >
                    {copiedKey === ep.path ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs sm:text-sm mt-1" style={{color: 'var(--color-text-secondary)', lineHeight: 1.5}}>
                  {ep.desc}
                </p>
                {ep.params && (
                  <div className="mt-2 text-xs font-mono p-2 rounded-lg border border-[var(--color-border)]" style={{ background: 'var(--color-surface, rgba(255,255,255,0.02))', color: 'var(--color-text-secondary)' }}>
                    <strong className="text-gray-300">Parameters:</strong> {ep.params}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Code examples with high-contrast monospace blocks */}
      <div className="card p-6 animate-fade-in-up">
        <h3 className="text-base sm:text-lg font-bold mb-4" style={{color: 'var(--color-text)'}}>
          💻 Code Examples
        </h3>
        <div className="flex flex-col gap-4">
          {codeExamples.map(ex => (
            <div key={ex.lang} className="rounded-xl overflow-hidden border border-[var(--color-border)]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]" style={{ background: 'var(--color-bg)' }}>
                <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--color-text)' }}>{ex.lang}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(ex.code, ex.lang)}
                  className="text-xs font-semibold px-2.5 py-1 rounded text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all"
                >
                  {copiedKey === ex.lang ? '✓ Copied Code' : '📋 Copy'}
                </button>
              </div>
              <pre className="p-4 m-0 text-xs sm:text-sm font-mono overflow-auto leading-relaxed" style={{
                background: 'var(--color-bg-elevated, #141413)',
                color: 'var(--color-text)',
              }}>
                {ex.code}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture note */}
      <div className="card p-6" style={{borderLeft: '4px solid var(--color-brand-yellow)'}}>
        <h3 className="text-base font-bold mb-3" style={{color: 'var(--color-text)'}}>
          🏗️ Architecture & Pipeline Overview
        </h3>
        <div className="text-xs sm:text-sm space-y-1.5" style={{color: 'var(--color-text-secondary)', lineHeight: 1.6}}>
          <p><strong className="text-white">Auth:</strong> Firebase Authentication (email/password + TOTP MFA) with backend token verification via <code>firebase-admin</code></p>
          <p><strong className="text-white">Data:</strong> SQLite (development) with direct schema support for PostgreSQL production deployment</p>
          <p><strong className="text-white">Anomaly Detection:</strong> PyOD (ECOD algorithm) with out-of-sample quality flag classification</p>
          <p><strong className="text-white">Forecasting:</strong> Amazon Chronos-2 probabilistic foundation time-series model with statistical trend fallback</p>
        </div>
      </div>
    </div>
  )
}
