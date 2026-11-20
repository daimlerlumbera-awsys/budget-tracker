<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineOptions({ name: 'RegisterView' })

const router = useRouter()
const auth   = useAuthStore()

const email    = ref('')
const password = ref('')
const confirm  = ref('')

const emailError = computed(() => {
  if (!email.value) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'Enter a valid email address.'
  return ''
})
const passwordError = computed(() => {
  if (!password.value) return 'Password is required.'
  if (password.value.length < 6) return 'Password must be at least 6 characters.'
  return ''
})
const confirmError = computed(() => {
  if (!confirm.value) return 'Please confirm your password.'
  if (confirm.value !== password.value) return 'Passwords do not match.'
  return ''
})
const formValid = computed(() => !emailError.value && !passwordError.value && !confirmError.value)

const submitted = ref(false)

async function handleSubmit() {
  submitted.value = true
  if (!formValid.value) return

  await auth.signUp(email.value, password.value)

  // emailPending: Supabase email confirmation is enabled — no session yet
  if (auth.emailPending || auth.error) return

  // Immediate session (email confirmation disabled)
  router.push({ name: 'overview' })
}
</script>

<template>
  <div class="min-h-screen bg-bg flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Heading -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-semibold text-text">Create an account</h1>
        <p class="mt-1 text-sm text-text-muted">Start tracking your budget today</p>
      </div>

      <!-- Email confirmation pending -->
      <div v-if="auth.emailPending" class="bg-surface border border-border rounded-xl shadow-md p-6 text-center">
        <p class="text-sm font-medium text-text mb-1">Check your inbox</p>
        <p class="text-sm text-text-muted">
          We sent a confirmation link to <span class="font-medium text-text">{{ email }}</span>.
          Click it to activate your account.
        </p>
        <router-link
          to="/login"
          class="mt-4 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Back to sign in
        </router-link>
      </div>

      <!-- Registration form -->
      <div v-else class="bg-surface border border-border rounded-xl shadow-md p-6">
        <form novalidate @submit.prevent="handleSubmit">

          <!-- Auth error -->
          <div v-if="auth.error" class="mb-4 rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
            {{ auth.error }}
          </div>

          <!-- Email -->
          <div class="mb-4">
            <label for="email" class="block mb-1 text-sm font-medium text-text">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="w-full rounded-md border px-3 py-2 text-sm text-text bg-surface placeholder:text-text-subtle outline-none transition-colors"
              :class="submitted && emailError ? 'border-danger-400 focus:border-danger-500' : 'border-border focus:border-primary-500'"
            />
            <p v-if="submitted && emailError" class="mt-1 text-xs text-danger-600">{{ emailError }}</p>
          </div>

          <!-- Password -->
          <div class="mb-4">
            <label for="password" class="block mb-1 text-sm font-medium text-text">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full rounded-md border px-3 py-2 text-sm text-text bg-surface placeholder:text-text-subtle outline-none transition-colors"
              :class="submitted && passwordError ? 'border-danger-400 focus:border-danger-500' : 'border-border focus:border-primary-500'"
            />
            <p v-if="submitted && passwordError" class="mt-1 text-xs text-danger-600">{{ passwordError }}</p>
          </div>

          <!-- Confirm password -->
          <div class="mb-6">
            <label for="confirm" class="block mb-1 text-sm font-medium text-text">Confirm password</label>
            <input
              id="confirm"
              v-model="confirm"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full rounded-md border px-3 py-2 text-sm text-text bg-surface placeholder:text-text-subtle outline-none transition-colors"
              :class="submitted && confirmError ? 'border-danger-400 focus:border-danger-500' : 'border-border focus:border-primary-500'"
            />
            <p v-if="submitted && confirmError" class="mt-1 text-xs text-danger-600">{{ confirmError }}</p>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            class="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="auth.loading || (submitted && !formValid)"
          >
            {{ auth.loading ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
      </div>

      <!-- Login link -->
      <p class="mt-4 text-center text-sm text-text-muted">
        Already have an account?
        <router-link to="/login" class="font-medium text-primary-600 hover:text-primary-700">Sign in</router-link>
      </p>

    </div>
  </div>
</template>
