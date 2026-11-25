import { onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

const TABLE = 'bdo_life_submissions'
const BUCKET = 'bdo-life-proofs'
const SIGNED_URL_TTL_SECONDS = 60
const DUPLICATE_SUBMISSION_MESSAGE = "You have already deposited for this month's BDO Life."
const SUBMISSION_COLUMNS =
  'id, user_id, amount, proof_path, deposit_month, submitted_at, acknowledged_at, acknowledged_by'

export interface BdoLifeSubmission {
  id: string
  user_id: string
  amount: number
  proof_path: string
  deposit_month: string
  submitted_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
}

export const useBdoLifeStore = defineStore('bdoLife', () => {
  const submissions = ref<BdoLifeSubmission[]>([])
  const isAdmin = ref<boolean | null>(null)
  const ownerId = ref<string | null>(null)
  const loading = ref(false)
  const adminLoading = ref(false)
  const submitting = ref(false)
  const acknowledgingId = ref<string | null>(null)
  const error = ref<string | null>(null)
  const success = ref<string | null>(null)
  const cleanupError = ref<string | null>(null)
  let requestGeneration = 0

  function errorMessage(value: unknown): string {
    if (value && typeof value === 'object' && 'message' in value) {
      return String((value as { message: unknown }).message)
    }
    return value instanceof Error ? value.message : 'An unexpected error occurred.'
  }

  async function authenticatedUserId(): Promise<string> {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!data.user) {
      clearState()
      const message = 'You must be signed in to access BDO Life.'
      error.value = message
      throw new Error(message)
    }
    return data.user.id
  }

  function clearState(): void {
    requestGeneration++
    submissions.value = []
    isAdmin.value = null
    ownerId.value = null
    loading.value = false
    adminLoading.value = false
    submitting.value = false
    acknowledgingId.value = null
    error.value = null
    success.value = null
    cleanupError.value = null
  }

  function useOwner(userId: string): void {
    if (ownerId.value && ownerId.value !== userId) clearState()
    ownerId.value = userId
  }

  async function verifyCurrentUser(userId: string): Promise<void> {
    if (await authenticatedUserId() !== userId) {
      clearState()
      throw new Error('The authenticated user changed; the BDO Life response was discarded.')
    }
  }

  async function resolveAdmin(userId: string): Promise<boolean> {
    adminLoading.value = true
    isAdmin.value = null
    try {
      const { data, error: rpcError } = await supabase.rpc('is_bdo_life_admin')
      if (rpcError) throw rpcError
      if (typeof data !== 'boolean') {
        throw new Error('The BDO Life admin check returned an invalid response.')
      }

      await verifyCurrentUser(userId)
      isAdmin.value = data
      return data
    } finally {
      adminLoading.value = false
    }
  }

  async function checkAdmin(): Promise<boolean | null> {
    error.value = null
    success.value = null
    try {
      const userId = await authenticatedUserId()
      useOwner(userId)
      return await resolveAdmin(userId)
    } catch (e) {
      isAdmin.value = null
      error.value = errorMessage(e)
      return null
    }
  }

  async function loadSubmissions(): Promise<void> {
    let generation = ++requestGeneration
    loading.value = true
    error.value = null
    success.value = null

    try {
      const userId = await authenticatedUserId()
      if (ownerId.value && ownerId.value !== userId) {
        clearState()
        ownerId.value = userId
        generation = ++requestGeneration
        loading.value = true
      } else {
        ownerId.value = userId
      }

      const admin = await resolveAdmin(userId)
      if (generation !== requestGeneration) return

      let query = supabase
        .from(TABLE)
        .select(SUBMISSION_COLUMNS)
        .order('submitted_at', { ascending: false })
      if (!admin) query = query.eq('user_id', userId)

      const { data, error: queryError } = await query
        .overrideTypes<BdoLifeSubmission[]>()
      if (generation !== requestGeneration) return
      if (queryError) throw queryError

      await verifyCurrentUser(userId)
      if (generation !== requestGeneration) return
      submissions.value = data ?? []
    } catch (e) {
      if (generation === requestGeneration) error.value = errorMessage(e)
    } finally {
      if (generation === requestGeneration) loading.value = false
    }
  }

  function singaporeMonthFolder(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date)
    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    if (!year || !month) throw new Error('Could not determine the Singapore calendar month.')
    return `${year}-${month}`
  }

  async function removeUploadedProof(path: string): Promise<void> {
    try {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([path])
      if (removeError) cleanupError.value = errorMessage(removeError)
    } catch (e) {
      cleanupError.value = errorMessage(e)
    }
  }

  async function submitDeposit(
    amount: number,
    proofFile: File,
  ): Promise<{ success: true; submission: BdoLifeSubmission } | { success: false; error: string }> {
    error.value = null
    success.value = null
    cleanupError.value = null

    if (!Number.isFinite(amount) || amount <= 0) {
      const message = 'Deposit amount must be greater than zero.'
      error.value = message
      return { success: false, error: message }
    }
    if (!proofFile) {
      const message = 'A proof-of-deposit file is required.'
      error.value = message
      return { success: false, error: message }
    }
    if (submitting.value) {
      const message = 'A BDO Life deposit is already being submitted.'
      error.value = message
      return { success: false, error: message }
    }

    submitting.value = true
    let uploadedPath: string | null = null
    try {
      const userId = await authenticatedUserId()
      useOwner(userId)

      const path = `${userId}/${singaporeMonthFolder(new Date())}/${crypto.randomUUID()}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, proofFile, {
          contentType: proofFile.type || 'application/octet-stream',
          upsert: false,
        })
      if (uploadError) throw uploadError
      uploadedPath = path

      await verifyCurrentUser(userId)
      const { data, error: insertError } = await supabase
        .from(TABLE)
        .insert({ user_id: userId, amount, proof_path: path })
        .select(SUBMISSION_COLUMNS)
        .single()
        .overrideTypes<BdoLifeSubmission>()

      if (insertError) {
        if (insertError.code === '23505') {
          await removeUploadedProof(path)
          uploadedPath = null
          error.value = DUPLICATE_SUBMISSION_MESSAGE
          return { success: false, error: DUPLICATE_SUBMISSION_MESSAGE }
        }
        throw insertError
      }

      uploadedPath = null
      await verifyCurrentUser(userId)
      submissions.value = [
        data,
        ...submissions.value.filter(submission => submission.id !== data.id),
      ]
      success.value = 'Deposit submitted successfully.'
      return { success: true, submission: data }
    } catch (e) {
      if (uploadedPath) await removeUploadedProof(uploadedPath)
      error.value = errorMessage(e)
      return { success: false, error: error.value }
    } finally {
      submitting.value = false
    }
  }

  async function createProofSignedUrl(
    proofPath: string,
  ): Promise<{ success: true; url: string } | { success: false; error: string }> {
    error.value = null
    success.value = null
    try {
      const userId = await authenticatedUserId()
      const { data, error: signedUrlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(proofPath, SIGNED_URL_TTL_SECONDS)
      if (signedUrlError) throw signedUrlError
      if (!data.signedUrl) throw new Error('Supabase did not return a proof URL.')
      await verifyCurrentUser(userId)
      return { success: true, url: data.signedUrl }
    } catch (e) {
      error.value = errorMessage(e)
      return { success: false, error: error.value }
    }
  }

  async function acknowledgeSubmission(
    submissionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    error.value = null
    success.value = null
    if (acknowledgingId.value) {
      const message = 'An acknowledgment is already being recorded.'
      error.value = message
      return { success: false, error: message }
    }

    acknowledgingId.value = submissionId
    try {
      const userId = await authenticatedUserId()
      useOwner(userId)
      if (!await resolveAdmin(userId)) {
        throw new Error('Only BDO Life admins can acknowledge submissions.')
      }

      const { error: rpcError } = await supabase.rpc(
        'acknowledge_bdo_life_submission',
        { submission_id: submissionId },
      )
      if (rpcError) throw rpcError

      await loadSubmissions()
      if (error.value) {
        success.value = 'Acknowledgment recorded, but submissions could not be refreshed.'
      } else {
        success.value = 'Acknowledgment recorded.'
      }
      return { success: true }
    } catch (e) {
      error.value = errorMessage(e)
      return { success: false, error: error.value }
    } finally {
      acknowledgingId.value = null
    }
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const activeUserId = session?.user.id ?? null
    if (ownerId.value && ownerId.value !== activeUserId) clearState()
  })
  onScopeDispose(() => subscription.unsubscribe())

  return {
    submissions,
    isAdmin,
    loading,
    adminLoading,
    submitting,
    acknowledgingId,
    error,
    success,
    cleanupError,
    checkAdmin,
    loadSubmissions,
    submitDeposit,
    createProofSignedUrl,
    acknowledgeSubmission,
  }
})