<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineOptions({ name: 'LoginView' })

const router = useRouter()
const auth   = useAuthStore()

const email    = ref('')
const password = ref('')

function clearError() { auth.error = null }

const emailError    = computed(() => {
  if (!email.value) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'Enter a valid email address.'
  return ''
})
const passwordError = computed(() => password.value ? '' : 'Password is required.')
const formValid     = computed(() => !emailError.value && !passwordError.value)

const submitted = ref(false)

async function handleSubmit() {
  submitted.value = true
  if (!formValid.value) return

  await auth.signIn(email.value, password.value)
  if (!auth.error) {
    router.push({ name: 'overview' })
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Heading -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-semibold text-text">Sign in</h1>
        <p class="mt-1 text-sm text-text-muted">Welcome back to Budget Tracker</p>
      </div>

      <!-- Card -->
      <div class="bg-surface border border-border rounded-xl shadow-md p-6">
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
              @input="clearError"
            />
            <p v-if="submitted && emailError" class="mt-1 text-xs text-danger-600">{{ emailError }}</p>
          </div>

          <!-- Password -->
          <div class="mb-6">
            <label for="password" class="block mb-1 text-sm font-medium text-text">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full rounded-md border px-3 py-2 text-sm text-text bg-surface placeholder:text-text-subtle outline-none transition-colors"
              :class="submitted && passwordError ? 'border-danger-400 focus:border-danger-500' : 'border-border focus:border-primary-500'"
              @input="clearError"
            />
            <p v-if="submitted && passwordError" class="mt-1 text-xs text-danger-600">{{ passwordError }}</p>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            class="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="auth.loading"
          >
            {{ auth.loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
      </div>

      <!-- Register link -->
      <p class="mt-4 text-center text-sm text-text-muted">
        Don't have an account?
        <router-link to="/register" class="font-medium text-primary-600 hover:text-primary-700">Create one</router-link>
      </p>

    </div>
  </div>
</template>
