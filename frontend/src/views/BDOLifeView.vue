<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, FileText, RefreshCw, ShieldCheck, Upload, Wallet } from 'lucide-vue-next'
import { useBdoLifeStore, type BdoLifeSubmission } from '../stores/bdoLife'

const store = useBdoLifeStore()
const amount = ref<number | null>(null)
const proofFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const formError = ref<string | null>(null)
const proofUrlById = ref<Record<string, string>>({})
const proofLoadingId = ref<string | null>(null)
const DUPLICATE_SUBMISSION_MESSAGE = "You have already deposited for this month's BDO Life."

function singaporeMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  if (!year || !month) return ''
  return `${year}-${month}`
}

const currentMonthKey = singaporeMonthKey(new Date())
const hasCurrentMonthSubmission = computed(() =>
  store.submissions.some(submission => submission.deposit_month.slice(0, 7) === currentMonthKey),
)

onMounted(() => {
  void store.loadSubmissions()
})

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function onProofFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  proofFile.value = input.files?.[0] ?? null
  formError.value = null
}

async function submitDeposit(): Promise<void> {
  formError.value = null
  const depositAmount = amount.value
  const selectedProof = proofFile.value
  if (depositAmount === null || !Number.isFinite(depositAmount) || depositAmount <= 0) {
    formError.value = 'Enter a deposit amount greater than zero.'
    return
  }
  if (!selectedProof) {
    formError.value = 'Select your proof-of-deposit file.'
    return
  }

  const result = await store.submitDeposit(depositAmount, selectedProof)
  if (!result.success) return

  amount.value = null
  proofFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function acknowledgmentLabel(submission: BdoLifeSubmission): string {
  return submission.acknowledged_at
    ? `Acknowledged ${formatTimestamp(submission.acknowledged_at)}`
    : 'Not yet acknowledged'
}

async function loadProof(submission: BdoLifeSubmission): Promise<void> {
  proofLoadingId.value = submission.id
  const result = await store.createProofSignedUrl(submission.proof_path)
  if (result.success) {
    proofUrlById.value[submission.id] = result.url
  }
  proofLoadingId.value = null
}

async function acknowledge(submission: BdoLifeSubmission): Promise<void> {
  await store.acknowledgeSubmission(submission.id)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-text">BDO Life</h1>
        <p class="mt-1 text-sm text-text-muted">
          Record your monthly BDO Life deposit and keep its proof of deposit on file.
        </p>
      </div>
      <div class="flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
        <ShieldCheck :size="14" aria-hidden="true" />
        BDO Life submissions only
      </div>
    </div>

    <div
      v-if="store.error"
      class="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
      role="alert"
    >
      {{ store.error }}
    </div>
    <div
      v-if="formError"
      class="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
      role="alert"
    >
      {{ formError }}
    </div>
    <div
      v-if="store.success"
      class="rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-700"
      role="status"
    >
      {{ store.success }}
    </div>
    <div
      v-if="store.cleanupError"
      class="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800"
      role="status"
    >
      The uploaded proof could not be cleaned up after the failed submission: {{ store.cleanupError }}
    </div>

    <section
      v-if="store.isAdmin === null"
      class="rounded-xl border border-border bg-surface p-6 shadow-sm"
      aria-live="polite"
    >
      <div v-if="store.loading || store.adminLoading" class="flex items-center gap-3 text-sm text-text-muted" role="status">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" aria-hidden="true" />
        Loading BDO Life submissions…
      </div>
      <div v-else class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-text-muted">BDO Life access could not be loaded.</p>
        <button
          class="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="store.loadSubmissions()"
        >
          <RefreshCw :size="14" aria-hidden="true" />
          Retry
        </button>
      </div>
    </section>

    <template v-else-if="store.isAdmin">
      <section class="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-text">All BDO Life submissions</h2>
            <p class="mt-1 text-xs text-text-muted">
              Acknowledgment confirms the proof was seen; it is not an approval or rejection.
            </p>
          </div>
          <span class="text-xs text-text-muted">
            {{ store.submissions.length }} submission{{ store.submissions.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div v-if="store.loading" class="py-10 text-center text-sm text-text-muted" role="status">
          Loading submissions…
        </div>
        <div v-else-if="store.submissions.length === 0" class="rounded-lg bg-surface-alt px-4 py-10 text-center">
          <FileText :size="22" class="mx-auto mb-2 text-text-subtle" aria-hidden="true" />
          <p class="text-sm font-medium text-text">No BDO Life submissions yet</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-sm">
            <thead>
              <tr class="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-3">User</th>
                <th class="px-4 py-3 text-right">Amount</th>
                <th class="px-4 py-3">Submitted</th>
                <th class="px-4 py-3">Acknowledgment</th>
                <th class="px-4 py-3">Proof</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="submission in store.submissions" :key="submission.id" class="hover:bg-surface-alt">
                <td class="max-w-56 truncate px-4 py-3 font-mono text-xs text-text-muted" :title="submission.user_id">
                  {{ submission.user_id }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                  {{ formatAmount(submission.amount) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-text-muted">
                  <time :datetime="submission.submitted_at" :title="submission.submitted_at">
                    {{ formatTimestamp(submission.submitted_at) }}
                  </time>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1.5 text-xs"
                    :class="submission.acknowledged_at ? 'font-medium text-secondary-700' : 'text-text-muted'"
                  >
                    <Check v-if="submission.acknowledged_at" :size="13" aria-hidden="true" />
                    {{ acknowledgmentLabel(submission) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <a
                    v-if="proofUrlById[submission.id]"
                    :href="proofUrlById[submission.id]"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    Open proof
                  </a>
                  <button
                    v-else
                    class="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    :disabled="proofLoadingId === submission.id"
                    @click="loadProof(submission)"
                  >
                    <span v-if="proofLoadingId === submission.id">Preparing…</span>
                    <template v-else>
                      <Upload :size="13" aria-hidden="true" />
                      View proof
                    </template>
                  </button>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!!submission.acknowledged_at || store.acknowledgingId === submission.id"
                    @click="acknowledge(submission)"
                  >
                    {{ store.acknowledgingId === submission.id ? 'Recording…' : 'Okay, I see the proof.' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div class="mb-5 flex items-center gap-3">
          <div class="rounded-lg bg-primary-50 p-2.5 text-primary-700">
            <Wallet :size="20" aria-hidden="true" />
          </div>
          <div>
            <h2 class="text-base font-semibold text-text">Submit a deposit</h2>
            <p class="text-xs text-text-muted">One submission is allowed per Singapore calendar month.</p>
          </div>
        </div>

        <div
          v-if="hasCurrentMonthSubmission"
          class="mb-5 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800"
          role="status"
        >
          {{ DUPLICATE_SUBMISSION_MESSAGE }}
        </div>

        <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="submitDeposit">
          <div>
            <label for="bdo-amount" class="mb-1.5 block text-sm font-medium text-text">Deposit amount (PHP)</label>
            <input
              id="bdo-amount"
              v-model.number="amount"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              placeholder="Enter any amount greater than zero"
              class="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-400"
              :disabled="hasCurrentMonthSubmission || store.submitting"
              required
            />
          </div>
          <div>
            <label for="bdo-proof" class="mb-1.5 block text-sm font-medium text-text">Proof of deposit</label>
            <input
              id="bdo-proof"
              ref="fileInput"
              type="file"
              required
              class="block w-full rounded-lg border border-border bg-bg text-sm text-text file:mr-3 file:border-0 file:bg-surface-alt file:px-3 file:py-2.5 file:font-medium file:text-text-muted"
              :disabled="hasCurrentMonthSubmission || store.submitting"
              @change="onProofFileChange"
            />
            <p v-if="proofFile" class="mt-1.5 truncate text-xs text-text-muted">
              Selected: {{ proofFile.name }}
            </p>
          </div>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="hasCurrentMonthSubmission || store.submitting || store.loading"
            >
              <span v-if="store.submitting" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
              <Upload v-else :size="15" aria-hidden="true" />
              {{ store.submitting ? 'Submitting…' : 'Submit deposit' }}
            </button>
          </div>
        </form>
      </section>

      <section class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-text">Your submission history</h2>
            <p class="mt-1 text-xs text-text-muted">Submission and acknowledgment times are shown in Singapore time.</p>
          </div>
          <span class="text-xs text-text-muted">
            {{ store.submissions.length }} submission{{ store.submissions.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div v-if="store.loading" class="px-5 py-10 text-center text-sm text-text-muted" role="status">
          Loading your submissions…
        </div>
        <div v-else-if="store.submissions.length === 0" class="px-5 py-12 text-center">
          <FileText :size="22" class="mx-auto mb-2 text-text-subtle" aria-hidden="true" />
          <p class="text-sm font-medium text-text">No deposits submitted yet</p>
        </div>
        <div v-else class="divide-y divide-border">
          <article
            v-for="submission in store.submissions"
            :key="submission.id"
            class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-semibold text-text">{{ formatAmount(submission.amount) }}</p>
              <p class="mt-1 text-xs text-text-muted">
                Submitted
                <time :datetime="submission.submitted_at" :title="submission.submitted_at">
                  {{ formatTimestamp(submission.submitted_at) }}
                </time>
              </p>
            </div>
            <div class="flex items-start gap-2 text-xs">
              <Check v-if="submission.acknowledged_at" :size="14" class="mt-0.5 text-secondary-600" aria-hidden="true" />
              <span v-else class="mt-1 h-2 w-2 rounded-full bg-neutral-300" aria-hidden="true" />
              <span :class="submission.acknowledged_at ? 'text-secondary-700' : 'text-text-muted'">
                <span class="font-medium">{{ submission.acknowledged_at ? 'Acknowledged' : 'Not yet acknowledged' }}</span>
                <span v-if="submission.acknowledged_at" class="mt-0.5 block">
                  <time :datetime="submission.acknowledged_at" :title="submission.acknowledged_at">
                    {{ formatTimestamp(submission.acknowledged_at) }}
                  </time>
                </span>
              </span>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>