/**
 * RegisterPage — Legacy redirect.
 * Registration is now handled by the AuthModal accessible from the GlobalNavbar.
 * This page redirects to the dashboard.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/dashboard') }, [navigate])
  return null
}
