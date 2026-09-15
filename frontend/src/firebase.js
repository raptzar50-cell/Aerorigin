/**
 * Firebase client configuration.
 *
 * This module initializes the Firebase client SDK for authentication.
 * The actual auth flows (sign in, sign up, TOTP MFA enrollment) use
 * Firebase Authentication — this replaces the earlier custom JWT + OTP system.
 *
 * SETUP: Replace the firebaseConfig values below with your Firebase project's
 * actual config from Firebase Console → Project Settings → General → Your Apps.
 */

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth'

// Firebase project configuration
// TODO: Replace with your Firebase project config values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSy-placeholder',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'aerogin-sih.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'aerogin-sih',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'aerogin-sih.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:placeholder',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

/**
 * Check if Firebase is properly configured (not using placeholder values).
 */
export function isFirebaseConfigured() {
  return !firebaseConfig.apiKey.includes('placeholder')
}

/**
 * Sign up with email and password.
 * Returns the Firebase UserCredential.
 */
export async function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}

/**
 * Sign in with email and password.
 * If the user has TOTP MFA enrolled, this will throw a
 * MultiFactorError that the caller must handle.
 */
export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  return firebaseSignOut(auth)
}

/**
 * Send password reset email.
 */
export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email)
}

/**
 * Sign in with Google.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account'
  })
  return signInWithPopup(auth, provider)
}

export const authReady = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    resolve(user)
    unsubscribe()
  })
})

/**
 * Get the current user's Firebase ID token.
 * This is sent to the Django backend as a Bearer token.
 */
export async function getIdToken() {
  await authReady
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

/**
 * Start TOTP MFA enrollment.
 * Returns the TotpSecret which contains the QR code URI.
 */
export async function startTOTPEnrollment() {
  const user = auth.currentUser
  if (!user) throw new Error('No authenticated user')

  const session = await multiFactor(user).getSession()
  const totpSecret = await TotpMultiFactorGenerator.generateSecret(session)
  return totpSecret
}

/**
 * Finalize TOTP MFA enrollment with a verification code.
 */
export async function finalizeTOTPEnrollment(totpSecret, verificationCode) {
  const user = auth.currentUser
  if (!user) throw new Error('No authenticated user')

  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    totpSecret,
    verificationCode
  )
  await multiFactor(user).enroll(assertion, 'TOTP Authenticator')
}

/**
 * Verify TOTP code during MFA sign-in.
 * Called when sign-in throws a MultiFactorError.
 */
export async function verifyTOTPSignIn(resolver, verificationCode) {
  const hints = resolver.hints
  const totpHint = hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)

  if (!totpHint) {
    throw new Error('No TOTP factor found for this user')
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    totpHint.uid,
    verificationCode
  )
  return resolver.resolveSignIn(assertion)
}

/**
 * Check if the current user has MFA enrolled.
 */
export function hasMFAEnrolled() {
  const user = auth.currentUser
  if (!user) return false
  return multiFactor(user).enrolledFactors.length > 0
}

/**
 * Generate a development bypass token for testing without Firebase.
 * ONLY used when Firebase is not configured.
 */
export function generateDevToken(uid, email) {
  const payload = JSON.stringify({ uid, email })
  return btoa(payload)
}

export { onAuthStateChanged, getMultiFactorResolver }
export default app
