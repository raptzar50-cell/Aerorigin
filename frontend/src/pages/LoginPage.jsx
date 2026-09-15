/**
 * LoginPage — Legacy redirect.
 * Authentication is now handled by the AuthModal accessible from the GlobalNavbar.
 * This page redirects to the dashboard.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/dashboard') }, [navigate])
  return null
}
