import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import CustomizeDashboardModal from './CustomizeDashboardModal'

const roles = [
  {
    id: 'economist',
    label: 'Economist / Statistician',
    icon: '📊',
    description: 'Focus on index construction methodology, base-period selection, CPI-alignment framing, and data export for external statistical work.',
    emphasis: ['National index charts', 'Base-period controls', 'CSV/JSON export', 'CPI framing'],
  },
  {
    id: 'regulator',
    label: 'Regulator / Policy Analyst',
    icon: '🔍',
    description: 'Focus on anomaly detection, dynamic-pricing pattern detection, and flagged fare anomalies by route and carrier.',
    emphasis: ['Anomaly detection', 'Flagged fares', 'Carrier analysis', 'Pattern detection'],
  },
  {
    id: 'researcher',
    label: 'Researcher / Analyst',
    icon: '🔬',
    description: 'Focus on raw and cleaned dataset access, model performance metrics, forecast accuracy tracking, and API documentation.',
    emphasis: ['Dataset access', 'Model metrics', 'Forecast accuracy', 'API documentation'],
  },
  {
    id: 'custom',
    label: 'Custom Dashboard',
    icon: '⚙️',
    description: 'Select exactly which panels and widgets you want to see. Perfect for users with specific focus areas.',
    emphasis: ['Tailored views', 'Select specific widgets', 'Focus purely on what matters'],
  },
]

export default function RoleSwitcher({ compact = false }) {
  const { profile, updateProfile, role: currentRole } = useAuth()
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleRoleChange = async (roleId) => {
    if (roleId === currentRole || saving) return
    setSaving(true)
    try {
      await updateProfile({ role: roleId })
    } catch (err) {
      console.error('Role update failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => handleRoleChange(r.id)}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.375rem 0.75rem', borderRadius: '8px',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
              border: currentRole === r.id ? '2px solid var(--color-brand-yellow)' : '2px solid var(--color-border)',
              background: currentRole === r.id ? 'rgba(255,230,0,0.1)' : 'transparent',
              color: currentRole === r.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
              opacity: saving ? 0.5 : 1,
            }}
          >
            <span>{r.icon}</span>
            {r.label.split('/')[0].trim()}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
        Stakeholder Role
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', margin: 0 }}>
        Your role determines which dashboard widgets are shown first. All data remains accessible regardless of role.
      </p>
      {roles.map(r => (
        <button
          key={r.id}
          onClick={() => handleRoleChange(r.id)}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            padding: '1rem', borderRadius: '12px', cursor: 'pointer',
            textAlign: 'left', transition: 'all 0.2s',
            border: currentRole === r.id ? '2px solid var(--color-brand-yellow)' : '2px solid var(--color-border)',
            background: currentRole === r.id ? 'rgba(255,230,0,0.06)' : 'var(--color-bg-card)',
            color: 'var(--color-text)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: '1.5rem', marginTop: '2px' }}>{r.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {r.description}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '8px' }}>
              {r.emphasis.map(e => (
                <span key={e} style={{
                  fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
                  background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}>
                  {e}
                </span>
              ))}
            </div>
          </div>
          {currentRole === r.id && r.id !== 'custom' && (
            <span style={{ color: 'var(--color-brand-yellow)', fontWeight: 700, fontSize: '1.2rem' }}>✓</span>
          )}
          {currentRole === r.id && r.id === 'custom' && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
              style={{
                background: 'var(--color-brand-yellow)', color: '#000', border: 'none', padding: '0.4rem 0.8rem',
                borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', zIndex: 10
              }}
            >
              Configure
            </button>
          )}
        </button>
      ))}
      <CustomizeDashboardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
