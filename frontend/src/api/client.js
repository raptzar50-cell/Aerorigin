import axios from 'axios'
import { getIdToken, isFirebaseConfigured } from '../firebase'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Firebase ID token interceptor — attaches the current user's token to requests
api.interceptors.request.use(async (config) => {
  // If header is already set (e.g., by AuthContext), skip
  if (config.headers.Authorization) return config

  if (isFirebaseConfigured()) {
    try {
      const token = await getIdToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // No current user — request will be unauthenticated
    }
  } else {
    // Dev mode — use stored token
    const token = localStorage.getItem('aerogin_firebase_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ---- Fare/Index endpoints ----

export const fetchRoutes = () => api.get('/routes/').then(res => res.data)

export const fetchIndex = (params = {}) =>
  api.get('/index/', { params }).then(res => res.data)

export const fetchLeadTimeTrends = (route) =>
  api.get('/trends/lead-time/', { params: { route } }).then(res => res.data)

export const fetchQualityReport = () =>
  api.get('/quality-report/').then(res => res.data)

export const fetchStats = () =>
  api.get('/stats/').then(res => res.data)

// ---- Auth / Profile endpoints ----

export const syncProfile = (data = {}) =>
  api.post('/auth/sync-profile/', data).then(res => res.data)

export const fetchProfile = () =>
  api.get('/auth/profile/').then(res => res.data)

export const updateProfile = (data) =>
  api.patch('/auth/profile/', data).then(res => res.data)

export const fetchRoles = () =>
  api.get('/auth/roles/').then(res => res.data)

export const fetchRolePreferences = () =>
  api.get('/user/role-preferences/').then(res => res.data)

export const updateRolePreferences = (data) =>
  api.put('/user/role-preferences/', data).then(res => res.data)

// ---- Model Versioning ----

export const fetchModelVersions = () =>
  api.get('/model-versions/').then(res => res.data)

// ---- Predictions (legacy) ----

export const fetchPredictions = (route) =>
  api.get('/predictions/', { params: { route } }).then(res => res.data)

export const fetchPredictionTable = (route, days_ahead = 30) =>
  api.get('/predictions/table/', { params: { route, days_ahead } }).then(res => res.data)

// ---- Index Forecasts (reframed for MoSPI) ----

export const fetchIndexForecast = (route) =>
  api.get('/index-forecast/', { params: route ? { route } : {} }).then(res => res.data)

export const fetchForecastAccuracy = (route) =>
  api.get('/forecast-accuracy/', { params: route ? { route } : {} }).then(res => res.data)

// ---- Export ----

export const exportIndex = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  const link = document.createElement('a')
  link.href = `/api/export/index/?${query}`
  link.setAttribute('download', '')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportFares = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  const link = document.createElement('a')
  link.href = `/api/export/fares/?${query}`
  link.setAttribute('download', '')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ---- Data Provenance ----

export const fetchDataProvenance = () =>
  api.get('/data-provenance/').then(res => res.data)

// ---- Flight Info ----

export const fetchFlightInfo = (flightNumber) =>
  api.get('/flights/info/', { params: { flight_number: flightNumber } }).then(res => res.data)

export const fetchFlightsForRoute = (origin, destination, date) =>
  api.get('/flights/route/', { params: { origin, destination, date } }).then(res => res.data)

export const fetchLiveAirportsTraffic = () =>
  api.get('/flights/live/').then(res => res.data)

// ---- Live Flight & Fare Search ----

export const fetchAirports = (query = '') =>
  api.get('/airports/', { params: query ? { q: query } : {} }).then(res => res.data)

export const searchLiveFares = ({ origin, destination, date, cabin = 'ECONOMY', sort = 'price' }) =>
  api.get('/live-search/', {
    params: { origin, destination, date, cabin, sort },
  }).then(res => res.data)

export default api
