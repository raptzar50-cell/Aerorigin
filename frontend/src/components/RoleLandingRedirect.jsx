import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

/**
 * RoleLandingRedirect
 *
 * Redirects `/dashboard` to the appropriate role-specific landing page.
 * Falls back to the Economist dashboard if the role is unrecognised.
 */

const ROLE_ROUTES = {
  economist:  '/dashboard/economist',
  regulator:  '/dashboard/regulator',
  researcher: '/dashboard/researcher',
  custom:     '/dashboard/overview',
}

export default function RoleLandingRedirect() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <LoadingSpinner />
      </div>
    )
  }

  const dest = (profile?.role && ROLE_ROUTES[profile.role]) || '/dashboard/economist'
  return <Navigate to={dest} replace />
}
