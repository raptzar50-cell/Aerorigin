import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useTheme } from './ThemeContext'
import {
  auth,
  onAuthStateChanged,
  getIdToken,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  isFirebaseConfigured,
  generateDevToken,
  getMultiFactorResolver,
  resetPassword,
  signInWithGoogle
} from '../firebase'
import api from '../api/client'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)        // Firebase user
  const [profile, setProfile] = useState(null)   // Django UserProfile
  const [loading, setLoading] = useState(true)
  const [mfaResolver, setMfaResolver] = useState(null)
  const { syncFromUser } = useTheme()

  // Sync profile with Django backend after Firebase auth
  const syncProfile = useCallback(async (firebaseUser, extraData = {}) => {
    try {
      let token
      if (isFirebaseConfigured()) {
        token = await firebaseUser.getIdToken()
      } else {
        // Dev bypass
        token = generateDevToken(
          firebaseUser.uid || `dev-${firebaseUser.email.replace(/[^a-zA-Z0-9]/g, '')}`,
          firebaseUser.email
        )
      }

      // Set the token for API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem('aerogin_firebase_token', token)

      // Sync with Django backend
      const { data } = await api.post('/auth/sync-profile/', {
        role: extraData.role || undefined,
        display_name: extraData.display_name || undefined,
        organization: extraData.organization || undefined,
      })

      setProfile(data.profile)

      // Sync theme preference
      const theme = data.profile?.dashboard_preferences?.theme
      if (theme) syncFromUser(theme)

      return data.profile
    } catch (err) {
      console.error('Profile sync failed:', err)
      return null
    }
  }, [syncFromUser])

  // Listen for Firebase auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Dev mode — check for stored dev token
      const storedToken = localStorage.getItem('aerogin_firebase_token')
      if (storedToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        // Try to fetch existing profile
        api.get('/auth/profile/')
          .then(({ data }) => {
            setProfile(data)
            setUser({ email: data.email, uid: data.firebase_uid })
          })
          .catch(() => {
            localStorage.removeItem('aerogin_firebase_token')
          })
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        await syncProfile(firebaseUser)
      } else {
        setUser(null)
        setProfile(null)
        delete api.defaults.headers.common['Authorization']
        localStorage.removeItem('aerogin_firebase_token')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    if (!isFirebaseConfigured()) {
      // Dev bypass mode
      const devUser = { uid: `dev-${email.replace(/[^a-zA-Z0-9]/g, '')}`, email }
      const token = generateDevToken(devUser.uid, email)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem('aerogin_firebase_token', token)

      try {
        const { data } = await api.post('/auth/sync-profile/', { role: 'researcher' })
        setUser(devUser)
        setProfile(data.profile)
        return { user: devUser, profile: data.profile }
      } catch (err) {
        console.warn('Backend profile sync failed in dev mode, using local profile fallback:', err)
        const role = email.toLowerCase().includes('admin') ? 'regulator' : 'researcher'
        const fallbackProfile = {
          email,
          role,
          role_label: role === 'regulator' ? 'Regulator/Policy Analyst' : 'Academic Researcher',
          display_name: email.split('@')[0],
          organization: 'MoSPI / Aerogin Dev',
        }
        setUser(devUser)
        setProfile(fallbackProfile)
        return { user: devUser, profile: fallbackProfile }
      }
    }

    try {
      const credential = await signInWithEmail(email, password)
      setUser(credential.user)
      const prof = await syncProfile(credential.user)
      if (!prof) {
        await signOut()
        setUser(null)
        throw new Error('Backend sync failed. Please ensure the Django server is running and configured.')
      }
      return { user: credential.user, profile: prof }
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, error)
        setMfaResolver(resolver)
        throw { code: 'mfa-required', resolver }
      }
      throw error
    }
  }, [syncProfile])

  const signup = useCallback(async (email, password, role = 'researcher', displayName = '', organization = '') => {
    if (!isFirebaseConfigured()) {
      // Dev bypass mode
      const devUser = { uid: `dev-${email.replace(/[^a-zA-Z0-9]/g, '')}`, email }
      const token = generateDevToken(devUser.uid, email)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem('aerogin_firebase_token', token)

      try {
        const { data } = await api.post('/auth/sync-profile/', {
          role,
          display_name: displayName,
          organization,
        })
        setUser(devUser)
        setProfile(data.profile)
        return { user: devUser, profile: data.profile }
      } catch (err) {
        console.warn('Backend sync failed in dev mode signup, using fallback profile:', err)
        const fallbackProfile = {
          email,
          role,
          role_label: role,
          display_name: displayName || email.split('@')[0],
          organization: organization || 'MoSPI / Aerogin Dev',
        }
        setUser(devUser)
        setProfile(fallbackProfile)
        return { user: devUser, profile: fallbackProfile }
      }
    }

    const credential = await signUpWithEmail(email, password)
    setUser(credential.user)
    const prof = await syncProfile(credential.user, {
      role,
      display_name: displayName,
      organization,
    })
    if (!prof) {
      await signOut()
      setUser(null)
      throw new Error('Backend sync failed. Please ensure the Django server is running and configured.')
    }
    return { user: credential.user, profile: prof }
  }, [syncProfile])

  const logout = useCallback(async () => {
    if (isFirebaseConfigured()) {
      await signOut()
    }
    setUser(null)
    setProfile(null)
    setMfaResolver(null)
    delete api.defaults.headers.common['Authorization']
    localStorage.removeItem('aerogin_firebase_token')
  }, [])

  const sendPasswordReset = useCallback(async (email) => {
    if (!isFirebaseConfigured()) {
      throw new Error("Password reset is not available in dev bypass mode.")
    }
    return resetPassword(email)
  }, [])

  const loginWithGoogle = useCallback(async (role = 'researcher') => {
    if (!isFirebaseConfigured()) {
      throw new Error("Google Sign-In is not available in dev bypass mode.")
    }
    try {
      const credential = await signInWithGoogle()
      setUser(credential.user)
      const prof = await syncProfile(credential.user, { role })
      if (!prof) {
        await signOut()
        setUser(null)
        throw new Error('Backend sync failed. Please ensure the Django server is running and Firebase Admin is configured.')
      }
      return { user: credential.user, profile: prof }
    } catch (error) {
      throw error
    }
  }, [syncProfile])

  const updateProfile = useCallback(async (updates) => {
    try {
      const { data } = await api.patch('/auth/profile/', updates)
      setProfile(data)
      return data
    } catch (err) {
      console.error('Profile update failed:', err)
      throw err
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/profile/')
      setProfile(data)
      return data
    } catch {
      return null
    }
  }, [])

  const role = profile?.role || null
  const isAuthenticated = !!(user && profile)

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      role,
      isAuthenticated,
      loading,
      mfaResolver,
      setMfaResolver,
      login,
      signup,
      logout,
      sendPasswordReset,
      loginWithGoogle,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
