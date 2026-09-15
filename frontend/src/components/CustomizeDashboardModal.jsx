import { useState, useEffect } from 'react'
import { fetchRolePreferences, updateRolePreferences } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const WIDGETS = [
  { id: 'stats', label: 'Headline Stats', desc: 'National Index, Routes Tracked, Observations' },
  { id: 'index_chart', label: 'National Airfare Price Index', desc: 'Main chart showing historical price index' },
  { id: 'provenance', label: 'Data Provenance Audit', desc: 'Summary of data sources (Live vs Govt)' },
  { id: 'anomaly_summary', label: 'Anomaly Detection Overview', desc: 'Flagged fare records & anomalies' },
  { id: 'model_info', label: 'Model & Data Overview', desc: 'Algorithm specifications and version history' },
  { id: 'forecast_preview', label: 'Index Forecast Preview', desc: 'Summary of Chronos-2 future projections' },
  { id: 'routes', label: 'Routes Overview', desc: 'Route-by-route breakdown table' },
]

export default function CustomizeDashboardModal({ isOpen, onClose }) {
  const { updateProfile } = useAuth()
  const [selections, setSelections] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetchRolePreferences().then(data => {
        if (data && data.custom_panels) {
          setSelections(data.custom_panels)
        }
        setLoading(false)
      }).catch(err => {
        console.error('Failed to load preferences', err)
        setLoading(false)
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleToggle = (id) => {
    setSelections(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateRolePreferences({ role: 'custom', custom_panels: selections })
      // Trigger a re-fetch of the profile in the app to immediately apply changes
      await updateProfile({ role: 'custom', dashboard_preferences: { custom_panels: selections } })
      onClose()
    } catch (err) {
      console.error('Failed to save preferences', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card" style={{
        background: 'var(--color-bg-card)',
        padding: '2rem',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        position: 'relative'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.25rem', right: '1.25rem',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)'
        }}>
          ✕
        </button>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--color-text)' }}>Customize Your Dashboard</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Select the panels you want to see on your Custom dashboard.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading preferences...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {WIDGETS.map(widget => (
              <label key={widget.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                cursor: 'pointer', padding: '0.5rem', borderRadius: '8px',
                background: 'var(--color-bg)', border: '1px solid var(--color-border)'
              }}>
                <input
                  type="checkbox"
                  checked={selections.includes(widget.id)}
                  onChange={() => handleToggle(widget.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>{widget.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{widget.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button onClick={onClose} style={{
            padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text)', cursor: 'pointer'
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none',
            background: 'var(--color-brand-yellow)', color: '#000', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer'
          }}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
