/**
 * DataProvenanceBadge — Reusable badge showing data source type.
 *
 * Props:
 *   provenance: 'live_scrape' | 'government_published' | 'fixture_fallback' | 'synthetic_seed'
 *   showTooltip: boolean (default true)
 *   size: 'sm' | 'md' (default 'sm')
 */
export default function DataProvenanceBadge({ provenance, showTooltip = true, size = 'sm' }) {
  const config = {
    live_scrape: {
      label: 'Live',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      icon: '🟢',
      tooltip: 'Data sourced from live OTA/API scraping (MakeMyTrip, Amadeus, Google Flights, Kiwi)',
    },
    government_published: {
      label: 'Published',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      icon: '🏛️',
      tooltip: 'Data from DGCA or MoSPI published reports',
    },
    fixture_fallback: {
      label: 'Sample',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      icon: '⚠️',
      tooltip: 'Static fixture/sample data used when live sources are unavailable. Clearly labeled, never passed off as live.',
    },
    synthetic_seed: {
      label: 'Synthetic',
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
      icon: '🔬',
      tooltip: 'Synthetically generated data for development/testing',
    },
    unknown: {
      label: 'Unknown',
      color: 'var(--color-text-secondary)',
      bg: 'var(--color-bg-elevated)',
      icon: '❓',
      tooltip: 'Data source not determined',
    },
  }

  const c = config[provenance] || config.unknown
  const fontSize = size === 'sm' ? '0.65rem' : '0.75rem'
  const padding = size === 'sm' ? '2px 6px' : '3px 8px'

  return (
    <span
      title={showTooltip ? c.tooltip : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: '6px',
        color: c.color,
        background: c.bg,
        cursor: showTooltip ? 'help' : 'default',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
    >
      <span style={{ fontSize: size === 'sm' ? '0.6rem' : '0.7rem' }}>{c.icon}</span>
      {c.label}
    </span>
  )
}

/**
 * ProvenanceSummary — Shows aggregate data provenance breakdown.
 */
export function ProvenanceSummary({ provenance }) {
  if (!provenance || provenance.total === 0) return null

  const items = [
    { key: 'live_scrape', label: 'Live Scraped' },
    { key: 'government_published', label: 'Govt Published' },
    { key: 'fixture_fallback', label: 'Fixture/Sample' },
    { key: 'synthetic_seed', label: 'Synthetic' },
  ]

  return (
    <div style={{
      display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
      padding: '0.75rem', borderRadius: '12px',
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-secondary)', width: '100%' }}>
        📋 Data Provenance — {provenance.total?.toLocaleString()} total records
      </div>
      {items.map(({ key, label }) => {
        const count = provenance[key] || 0
        const pct = provenance.total > 0 ? (count / provenance.total * 100).toFixed(1) : 0
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <DataProvenanceBadge provenance={key} showTooltip={false} />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
              {count.toLocaleString()} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}
