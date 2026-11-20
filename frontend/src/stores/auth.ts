import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import type { Session, User, AuthError, Subscription } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user          = ref<User | null>(null)
  const session       = ref<Session | null>(null)
  const loading       = ref(false)
  const initialized   = ref(false)
  const emailPending  = ref(false)
  const error         = ref<string | null>(null)

  let _initPromise: Promise<void> | null = null
  let _subscription: Subscription | null = null

  function _setError(e: AuthError | Error | unknown) {
    if (e && typeof e === 'object' && 'message' in e) {
      error.value = (e as { message: string }).message
    } else {
      error.value = 'An unexpected error occurred.'
    }
  }

  function initAuth(): Promise<void> {
    if (_initPromise) return _initPromise

    // Capture the token at the start of this init attempt.
    // If dispose() is called before the promise resolves, the captured promise
    // will no longer match _initPromise, so stale callbacks become no-ops.
    const promise: Promise<void> = supabase.auth.getSession().then(({ data, error: err }) => {
      if (_initPromise !== promise) return  // disposed mid-flight

      if (err) {
        _setError(err)
      } else {
        session.value = data.session
        user.value    = data.session?.user ?? null
      }

      if (!_subscription) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
          session.value = newSession
          user.value    = newSession?.user ?? null
        })
        _subscription = subscription
      }

      initialized.value = true
    }).catch((e) => {
      if (_initPromise !== promise) return  // disposed mid-flight
      _setError(e)
      initialized.value = true
    })

    _initPromise = promise
    return _initPromise
  }

  async function signUp(email: string, password: string): Promise<void> {
    error.value        = null
    emailPending.value = false
    loading.value      = true
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password })
      if (err) { _setError(err); return }
      // Email confirmation enabled: Supabase returns a user but no session
      if (data.user && !data.session) {
        emailPending.value = true
      }
    } catch (e) {
      _setError(e)
    } finally {
      loading.value = false
    }
  }

  async function signIn(email: string, password: string): Promise<void> {
    error.value   = null
    loading.value = true
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) _setError(err)
    } catch (e) {
      _setError(e)
    } finally {
      loading.value = false
    }
  }

  async function signOut(): Promise<void> {
    error.value   = null
    loading.value = true
    try {
      const { error: err } = await supabase.auth.signOut()
      if (err) {
        _setError(err)
        return
      }
      session.value = null
      user.value    = null
    } catch (e) {
      _setError(e)
    } finally {
      loading.value = false
    }
  }

  function dispose(): void {
    _subscription?.unsubscribe()
    _subscription  = null
    _initPromise   = null
    initialized.value = false
  }

  return { user, session, loading, initialized, emailPending, error, initAuth, signUp, signIn, signOut, dispose }
})
