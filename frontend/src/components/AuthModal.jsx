import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import {
  startTOTPEnrollment,
  finalizeTOTPEnrollment,
  verifyTOTPSignIn,
  hasMFAEnrolled,
  isFirebaseConfigured,
} from '../firebase'

/**
 * AuthModal — Login/Signup overlay with Firebase Auth + TOTP MFA
 *
 * Flows:
 *   Sign Up:  email+password → role selection → optional TOTP enrollment (QR code)
 *   Sign In:  email+password → if MFA enrolled, TOTP code input → dashboard
 */

// Default route for each role — navigated to immediately after login/signup
const ROLE_DEFAULT_ROUTES = {
  economist:  '/dashboard/economist',
  regulator:  '/dashboard/regulator',
  researcher: '/dashboard/researcher',
}

export default function AuthModal({ isOpen, initialTab = 'login', onClose }) {
  const { login, signup, profile, mfaResolver, setMfaResolver, loginWithGoogle, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const modalRef = useRef(null)

  const [tab, setTab] = useState(initialTab)
  const [step, setStep] = useState('credentials')
  // steps: credentials | role_select | mfa_enroll | mfa_verify | mfa_setup_qr

  // Login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Signup state
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [selectedRole, setSelectedRole] = useState('researcher')
  const [displayName, setDisplayName] = useState('')
  const [organization, setOrganization] = useState('')

  // MFA state
  const [totpCode, setTotpCode] = useState('')
  const [totpSecret, setTotpSecret] = useState(null)
  const [qrUri, setQrUri] = useState('')

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab)
      resetForm()
    }
  }, [isOpen, initialTab])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const resetForm = () => {
    setStep('credentials')
    setEmail(''); setPassword('')
    setRegEmail(''); setRegPassword(''); setRegConfirm('')
    setSelectedRole('researcher')
    setDisplayName(''); setOrganization('')
    setTotpCode(''); setTotpSecret(null); setQrUri('')
    setError(''); setMessage(''); setLoading(false)
    setMfaResolver?.(null)
  }

  const handleClose = () => { resetForm(); onClose() }

  // ---- Login ----
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const result = await login(email, password)
      // Navigate to role-appropriate default view
      const role = result?.profile?.role
      const dest = (role && ROLE_DEFAULT_ROUTES[role]) || '/dashboard'
      handleClose()
      navigate(dest)
    } catch (err) {
      if (err?.code === 'mfa-required') {
        setStep('mfa_verify')
      } else {
        const errorMsg = err?.response?.data?.error || err?.message || 'Sign in failed. Please try again.'
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  // ---- Google Login ----
  const handleGoogleLogin = async (e) => {
    if (e) e.preventDefault()
    console.log("Google Login clicked")
    setError(''); setMessage(''); setLoading(true)
    try {
      if (!loginWithGoogle) {
        throw new Error("Google login is not properly initialized. Try refreshing the page.")
      }
      console.log("Calling loginWithGoogle...")
      const result = await loginWithGoogle()
      console.log("Google login successful:", result)
      const role = result?.profile?.role
      const dest = (role && ROLE_DEFAULT_ROUTES[role]) || '/dashboard'
      handleClose()
      navigate(dest)
    } catch (err) {
      console.error("Google sign-in error:", err)
      setError(err?.message || 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Forgot Password ----
  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.')
      return
    }
    setError(''); setMessage(''); setLoading(true)
    try {
      await sendPasswordReset(email)
      setMessage('Password reset email sent. Please check your inbox.')
    } catch (err) {
      setError(err?.message || 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  // ---- MFA Verify (during login) ----
  const handleMFAVerify = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mfaResolver) {
        await verifyTOTPSignIn(mfaResolver, totpCode)
      }
      // AuthContext's onAuthStateChanged fires after MFA success and syncs the profile.
      // Read role from context (already populated) with a /dashboard fallback.
      const role = profile?.role
      const dest = (role && ROLE_DEFAULT_ROUTES[role]) || '/dashboard'
      handleClose()
      navigate(dest)
    } catch (err) {
      setError(err?.message || 'TOTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Signup ----
  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.')
      return
    }
    setStep('role_select')
  }

  const handleRoleConfirm = async () => {
    setError(''); setLoading(true)
    try {
      const result = await signup(regEmail, regPassword, selectedRole, displayName, organization)
      // Offer MFA enrollment
      if (isFirebaseConfigured()) {
        setStep('mfa_enroll')
      } else {
        const dest = ROLE_DEFAULT_ROUTES[selectedRole] || '/dashboard'
        handleClose()
        navigate(dest)
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.')
      setStep('credentials')
    } finally {
      setLoading(false)
    }
  }

  // ---- MFA Enrollment ----
  const handleStartMFAEnroll = async () => {
    setError(''); setLoading(true)
    try {
      const secret = await startTOTPEnrollment()
      setTotpSecret(secret)
      const uri = secret.generateQrCodeUrl(regEmail || email, 'Aerogin')
      setQrUri(uri)
      setStep('mfa_setup_qr')
    } catch (err) {
      setError(err?.message || 'MFA enrollment failed. You can set this up later.')
    } finally {
      setLoading(false)
    }
  }

  const handleFinalizeMFA = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await finalizeTOTPEnrollment(totpSecret, totpCode)
      handleClose()
    } catch (err) {
      setError(err?.message || 'TOTP verification failed. Check your code.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const roles = [
    {
      id: 'economist',
      label: 'Economist / Statistician',
      icon: '📊',
      desc: 'Index methodology, CPI alignment, data export',
    },
    {
      id: 'regulator',
      label: 'Regulator / Policy Analyst',
      icon: '🔍',
      desc: 'Anomaly detection, pricing pattern analysis',
    },
    {
      id: 'researcher',
      label: 'Researcher / Analyst',
      icon: '🔬',
      desc: 'Raw data, model metrics, API access',
    },
  ]

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div
        className="auth-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="auth-modal__close" onClick={handleClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo */}
        <div className="auth-modal__logo">
          <div className="gn__logo-icon" style={{ width: 40, height: 40 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1D1D1B" stroke="none">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
        </div>

        {/* Tab switcher — only for credentials step */}
        {step === 'credentials' && (
          <div className="auth-modal__tabs">
            <button
              className={`auth-modal__tab ${tab === 'login' ? 'auth-modal__tab--active' : ''}`}
              onClick={() => { setTab('login'); setError(''); setMessage('') }}
            >
              Sign In
            </button>
            <button
              className={`auth-modal__tab ${tab === 'signup' ? 'auth-modal__tab--active' : ''}`}
              onClick={() => { setTab('signup'); setError(''); setMessage('') }}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && <div className="auth-modal__error">{error}</div>}
        {message && <div className="auth-modal__success" style={{ color: 'green', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center', padding: '0.5rem', background: 'rgba(0,255,0,0.1)', borderRadius: '8px' }}>{message}</div>}

        {/* ---- LOGIN FORM ---- */}
        {tab === 'login' && step === 'credentials' && (
          <form onSubmit={handleLogin} className="auth-modal__form">
            <h2 className="auth-modal__title">Welcome back</h2>
            <p className="auth-modal__subtitle">Sign in to your Aerogin stakeholder account</p>
            <div className="auth-modal__field">
              <label className="auth-modal__label">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="auth-modal__input" placeholder="you@gov.in" required autoFocus />
            </div>
            <div className="auth-modal__field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="auth-modal__label" style={{ marginBottom: 0 }}>Password</label>
                <button type="button" onClick={handleForgotPassword} style={{ fontSize: '0.75rem', color: 'var(--color-brand-yellow)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Forgot Password?
                </button>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="auth-modal__input" placeholder="••••••••" required minLength={8} style={{ marginTop: '0.25rem' }} />
            </div>
            <button type="submit" className="btn-primary auth-modal__submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ---- OR Divider & Google Login (rendered if we are in login step) ---- */}
        {tab === 'login' && step === 'credentials' && (
          <div className="auth-modal__form" style={{ paddingTop: 0, marginTop: '-1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
              <hr style={{ flex: 1, borderColor: 'var(--color-border)', margin: 0 }} />
              <span style={{ padding: '0 0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OR</span>
              <hr style={{ flex: 1, borderColor: 'var(--color-border)', margin: 0 }} />
            </div>
            
            <button type="button" onClick={handleGoogleLogin} disabled={loading} style={{
              width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.9rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer',
              transition: 'background 0.2s'
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>

            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: '0.75rem', textAlign: 'center' }}>
              🔐 Secured with Firebase Authentication + TOTP MFA
            </p>
          </div>
        )}

        {/* ---- MFA VERIFY (login) ---- */}
        {step === 'mfa_verify' && (
          <form onSubmit={handleMFAVerify} className="auth-modal__form">
            <h2 className="auth-modal__title">🔐 Two-Factor Authentication</h2>
            <p className="auth-modal__subtitle">Enter the 6-digit code from your authenticator app</p>
            <div className="auth-modal__field">
              <label className="auth-modal__label">TOTP Code</label>
              <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="auth-modal__input" style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                placeholder="000000" maxLength={6} autoFocus />
            </div>
            <button type="submit" className="btn-primary auth-modal__submit" disabled={loading || totpCode.length < 6}>
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <button type="button" className="auth-modal__back" onClick={() => { setStep('credentials'); setTotpCode('') }}>
              ← Back
            </button>
          </form>
        )}

        {/* ---- SIGNUP FORM ---- */}
        {tab === 'signup' && step === 'credentials' && (
          <form onSubmit={handleSignup} className="auth-modal__form">
            <h2 className="auth-modal__title">Create stakeholder account</h2>
            <p className="auth-modal__subtitle">Register as a MoSPI/DGCA stakeholder</p>
            <div className="auth-modal__field">
              <label className="auth-modal__label">Email</label>
              <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                className="auth-modal__input" placeholder="you@gov.in" required autoFocus />
            </div>
            <div className="auth-modal__field">
              <label className="auth-modal__label">Password</label>
              <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                className="auth-modal__input" placeholder="Min. 8 characters" required minLength={8} />
            </div>
            <div className="auth-modal__field">
              <label className="auth-modal__label">Confirm Password</label>
              <input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)}
                className="auth-modal__input" placeholder="••••••••" required minLength={8} />
            </div>
            <button type="submit" className="btn-primary auth-modal__submit" disabled={loading}>
              Next: Select Your Role →
            </button>
          </form>
        )}

        {/* ---- ROLE SELECTION ---- */}
        {step === 'role_select' && (
          <div className="auth-modal__form">
            <h2 className="auth-modal__title">Select Your Role</h2>
            <p className="auth-modal__subtitle">This determines your default dashboard view (you can change it later)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
              {roles.map(r => (
                <button key={r.id} type="button"
                  onClick={() => setSelectedRole(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.875rem 1rem', borderRadius: '12px', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.2s',
                    border: selectedRole === r.id ? '2px solid var(--color-brand-yellow)' : '2px solid var(--color-border)',
                    background: selectedRole === r.id ? 'rgba(255,230,0,0.08)' : 'var(--color-bg-card)',
                    color: 'var(--color-text)',
                  }}>
                  <span style={{ fontSize: '1.5rem' }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{r.desc}</div>
                  </div>
                  {selectedRole === r.id && (
                    <span style={{ marginLeft: 'auto', color: 'var(--color-brand-yellow)', fontWeight: 700 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="auth-modal__field" style={{ marginTop: '0.5rem' }}>
              <label className="auth-modal__label">Display Name (optional)</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="auth-modal__input" placeholder="Dr. Sharma" />
            </div>
            <div className="auth-modal__field">
              <label className="auth-modal__label">Organization (optional)</label>
              <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)}
                className="auth-modal__input" placeholder="MoSPI / DGCA / IIT Delhi" />
            </div>
            <button className="btn-primary auth-modal__submit" onClick={handleRoleConfirm} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <button type="button" className="auth-modal__back" onClick={() => setStep('credentials')}>
              ← Back
            </button>
          </div>
        )}

        {/* ---- MFA ENROLLMENT OFFER ---- */}
        {step === 'mfa_enroll' && (
          <div className="auth-modal__form">
            <h2 className="auth-modal__title">🔐 Enable Two-Factor Auth</h2>
            <p className="auth-modal__subtitle">
              Add TOTP-based MFA for enhanced security. Use Google Authenticator, Authy, or any TOTP app.
            </p>
            <div style={{
              background: 'rgba(255,230,0,0.08)', borderRadius: '12px',
              padding: '1rem', margin: '1rem 0', fontSize: '0.8rem',
              color: 'var(--color-text-secondary)',
            }}>
              <strong>Why MFA?</strong> Government stakeholder accounts handle sensitive statistical data.
              TOTP-based MFA (IETF RFC 6238) provides an additional layer of security beyond passwords.
            </div>
            <button className="btn-primary auth-modal__submit" onClick={handleStartMFAEnroll} disabled={loading}>
              {loading ? 'Setting up…' : 'Set Up TOTP MFA'}
            </button>
            <button type="button" className="auth-modal__back" onClick={handleClose}
              style={{ color: 'var(--color-text-secondary)' }}>
              Skip for now
            </button>
          </div>
        )}

        {/* ---- MFA QR CODE SETUP ---- */}
        {step === 'mfa_setup_qr' && (
          <form onSubmit={handleFinalizeMFA} className="auth-modal__form">
            <h2 className="auth-modal__title">Scan QR Code</h2>
            <p className="auth-modal__subtitle">Scan this QR code with your authenticator app, then enter the 6-digit code below.</p>
            {qrUri && (
              <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                  alt="TOTP QR Code"
                  style={{ borderRadius: '12px', border: '2px solid var(--color-border)' }}
                  width={200} height={200}
                />
              </div>
            )}
            <div className="auth-modal__field">
              <label className="auth-modal__label">Verification Code</label>
              <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="auth-modal__input" style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                placeholder="000000" maxLength={6} autoFocus />
            </div>
            <button type="submit" className="btn-primary auth-modal__submit" disabled={loading || totpCode.length < 6}>
              {loading ? 'Verifying…' : 'Verify & Enable MFA'}
            </button>
            <button type="button" className="auth-modal__back" onClick={handleClose}>
              Skip for now
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
