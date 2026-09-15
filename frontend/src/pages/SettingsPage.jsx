import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { fetchRoutes } from '../api/client'
import RoleSwitcher from '../components/RoleSwitcher'
import {
  hasMFAEnrolled,
  startTOTPEnrollment,
  finalizeTOTPEnrollment,
  isFirebaseConfigured,
} from '../firebase'

export default function SettingsPage() {
  const { profile, isAuthenticated, updateProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [availableRoutes, setAvailableRoutes] = useState([])
  const [displayName, setDisplayName] = useState('')
  const [organization, setOrganization] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // MFA state
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [mfaStep, setMfaStep] = useState(null) // null | 'qr' | 'verify'
  const [totpSecret, setTotpSecret] = useState(null)
  const [qrUri, setQrUri] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  useEffect(() => {
    fetchRoutes().then(setAvailableRoutes).catch(console.error)
  }, [])

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setOrganization(profile.organization || '')
    }
    if (isFirebaseConfigured()) {
      setMfaEnrolled(hasMFAEnrolled())
    }
  }, [profile])

  if (!isAuthenticated) {
    return (
      <div className="card p-8 text-center animate-fade-in-up">
        <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-light)" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="text-lg font-semibold mb-2" style={{color: 'var(--color-text)'}}>Sign in required</h3>
        <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>
          Please sign in to manage your profile and settings.
        </p>
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await updateProfile({
        display_name: displayName,
        organization,
        dashboard_preferences: { theme },
      })
      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleStartMFA = async () => {
    setMfaLoading(true)
    try {
      const secret = await startTOTPEnrollment()
      setTotpSecret(secret)
      const uri = secret.generateQrCodeUrl(profile.email, 'Aerogin')
      setQrUri(uri)
      setMfaStep('qr')
    } catch (err) {
      setMessage(`MFA setup failed: ${err.message}`)
    } finally {
      setMfaLoading(false)
    }
  }

  const handleFinalizeMFA = async () => {
    setMfaLoading(true)
    try {
      await finalizeTOTPEnrollment(totpSecret, totpCode)
      setMfaEnrolled(true)
      setMfaStep(null)
      setTotpCode('')
      setMessage('MFA enabled successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(`MFA verification failed: ${err.message}`)
    } finally {
      setMfaLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '10px',
    fontSize: '0.85rem', border: '1px solid var(--color-border)',
    background: 'var(--color-bg)', color: 'var(--color-text)',
    outline: 'none', transition: 'border-color 0.2s',
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Settings &amp; Preferences</h1>
        <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
          Manage your account profile, stakeholder role perspective, and security credentials
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm animate-fade-in-up`} style={{
          background: message.includes('success') || message.includes('enabled') ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
          color: message.includes('success') || message.includes('enabled') ? 'var(--color-success)' : 'var(--color-danger)',
        }}>
          {message}
        </div>
      )}

      {/* Account Info */}
      <div className="card p-6 animate-fade-in-up">
        <h3 className="section-title mb-4">Account</h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
               style={{background: 'var(--color-brand-yellow)', color: 'var(--color-brand-dark)'}}>
            {profile?.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium" style={{color: 'var(--color-text)'}}>{profile?.email}</p>
            <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>
              {profile?.role_label} · Firebase Auth
              {mfaEnrolled && <span style={{color: 'var(--color-success)'}}> · 🔐 MFA Enabled</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium" style={{color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.4rem'}}>
              Display Name
            </label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle} placeholder="Dr. Sharma" />
          </div>
          <div>
            <label className="text-xs font-medium" style={{color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.4rem'}}>
              Organization
            </label>
            <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)}
              style={inputStyle} placeholder="MoSPI / DGCA / IIT Delhi" />
          </div>
        </div>
      </div>

      {/* Stakeholder Role */}
      <div className="card p-6 animate-fade-in-up" style={{animationDelay: '80ms'}}>
        <RoleSwitcher />
      </div>

      {/* MFA Settings */}
      <div className="card p-6 animate-fade-in-up" style={{animationDelay: '120ms'}}>
        <h3 className="text-sm font-semibold mb-4" style={{color: 'var(--color-text)'}}>
          🔐 Two-Factor Authentication (TOTP MFA)
        </h3>
        {mfaEnrolled ? (
          <div style={{
            padding: '1rem', borderRadius: '10px',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <p className="text-sm font-medium" style={{color: 'var(--color-success)'}}>
              ✅ TOTP MFA is enabled
            </p>
            <p className="text-xs mt-1" style={{color: 'var(--color-text-secondary)'}}>
              Your account is protected with TOTP-based multi-factor authentication (RFC 6238).
            </p>
          </div>
        ) : mfaStep === 'qr' ? (
          <div>
            <p className="text-xs mb-3" style={{color: 'var(--color-text-secondary)'}}>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            {qrUri && (
              <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                  alt="TOTP QR Code" width={200} height={200}
                  style={{ borderRadius: '12px', border: '2px solid var(--color-border)' }}
                />
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <label className="text-xs font-medium" style={{color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.4rem'}}>
                Enter 6-digit code from your app
              </label>
              <input type="text" value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem'}}
                placeholder="000000" maxLength={6} />
            </div>
            <button onClick={handleFinalizeMFA} className="btn-primary" disabled={mfaLoading || totpCode.length < 6}
              style={{ width: '100%', marginTop: '1rem' }}>
              {mfaLoading ? 'Verifying…' : 'Verify & Enable MFA'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs mb-3" style={{color: 'var(--color-text-secondary)'}}>
              Add an extra layer of security with TOTP-based multi-factor authentication.
              Use any authenticator app (Google Authenticator, Authy, etc.)
            </p>
            {isFirebaseConfigured() ? (
              <button onClick={handleStartMFA} className="btn-primary" disabled={mfaLoading}>
                {mfaLoading ? 'Setting up…' : 'Set Up TOTP MFA'}
              </button>
            ) : (
              <p className="text-xs" style={{color: 'var(--color-text-light)', fontStyle: 'italic'}}>
                MFA enrollment requires Firebase to be configured. Currently in dev bypass mode.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="card p-6 animate-fade-in-up" style={{animationDelay: '160ms'}}>
        <h3 className="text-sm font-semibold mb-4" style={{color: 'var(--color-text)'}}>Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{color: 'var(--color-text)'}}>Dark Mode</p>
            <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>
              Toggle between light and dark themes
            </p>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end animate-fade-in-up" style={{animationDelay: '240ms'}}>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
