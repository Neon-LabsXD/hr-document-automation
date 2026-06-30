import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ApiError, API_BASE_URL, apiRequest, clearAccessToken, getAccessToken, setAccessToken } from '../lib/api'
import { mapBackendCandidateToDocumentRecord } from '../utils/candidateMapper'
import { deleteCandidates as deleteCandidatesRequest, downloadSignedCandidateDocument, getOrganizationProfile, type OrganizationProfile } from '../lib/backend'
import { supabase } from '../lib/supabase'

export type DocumentStatus =
  | 'PENDING_GENERATION'
  | 'DATA_COMPLETED'
  | 'SENT'
  | 'OPENED'
  | 'OTP_VERIFIED'
  | 'SIGNED'
export type UserRole = 'guest' | 'recruiter' | 'super_admin'
export type BusinessPriority =
  | 'Miło mieć (Fajny dodatek)'
  | 'Ważne (Ułatwi codzienne operacje)'
  | 'Krytyczne (Blokuje mój rozwój / Przejście z innego systemu)'
export type FeatureRequestStatus = 'Nowe' | 'W realizacji' | 'Zrobione'

export interface DocumentRecord {
  id: number
  backendId: string
  initials: string
  candidateName: string
  candidateEmail: string
  role: string
  company: string
  contractType: string
  status: DocumentStatus
  lastChange: string
  recruiter: string
  deleted?: boolean
}

export type FormTemplate = string

export interface FormLinkConfig {
  template: FormTemplate
  requireIdScan: boolean
  requireStudentStatus: boolean
  slug: string
  url: string
}

export interface CandidateFormInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  pesel: string
  birthDate: string
  hourlyRate: string
  street: string
  houseNumber: string
  postalCode: string
  city: string
}

export interface AgencyAccess {
  id: number
  name: string
  nip: string
  signatureLimit: number
  usedSignatures: number
  plan: string
  planValidUntil: string
  paymentStatus: 'paid' | 'trial' | 'overdue'
}

export interface AgencyInput {
  name: string
  nip: string
  plan: string
  signatureLimit: number
  planValidUntil: string
  paymentStatus: AgencyAccess['paymentStatus']
}

export interface InviteCode {
  code: string
  createdAt: string
  status: 'aktywny' | 'wykorzystany'
  plan: string
  signatureLimit: number
  usedBy?: string
}

export interface FeatureProposal {
  id: number
  agencyName: string
  contactEmail: string
  featureName: string
  description: string
  priority: BusinessPriority
  status: FeatureRequestStatus
  createdAt: string
}

export interface FeatureProposalInput {
  agencyName: string
  contactEmail: string
  featureName: string
  description: string
  priority: BusinessPriority
}

interface AuthResult {
  ok: boolean
  role?: UserRole
  error?: string
}

interface AuthUser {
  email: string
}

interface AppContextValue {
  role: UserRole
  user: AuthUser | null
  isAuthenticated: boolean
  authReady: boolean
  currentUserEmail: string | null
  organizationProfile: OrganizationProfile | null
  documents: DocumentRecord[]
  centralCandidatesList: DocumentRecord[]
  agencies: AgencyAccess[]
  inviteCodes: InviteCode[]
  featureProposals: FeatureProposal[]
  activeFormLink: FormLinkConfig | null
  login: (email: string, password: string) => Promise<AuthResult>
  registerAgency: (
    agencyName: string,
    fullName: string,
    email: string,
    password: string,
    inviteCode: string,
  ) => Promise<AuthResult>
  logout: () => void
  addAgencyManually: (agency: AgencyInput) => AgencyAccess
  generateFormLink: (config: Omit<FormLinkConfig, 'slug' | 'url'>) => FormLinkConfig
  submitCandidateForm: (data: CandidateFormInput) => DocumentRecord
  updateDocumentStatus: (documentId: number, status: DocumentStatus) => void
  deleteDocuments: (documentIds: number[]) => Promise<void>
  deleteAllDocuments: () => Promise<void>
  updateAgencySignatureLimit: (agencyId: number, signatureLimit: number) => void
  updateAgencyPlan: (agencyId: number, plan: string, signatureLimit: number) => void
  blockAgencyAccess: (agencyId: number) => void
  generateInviteCode: (plan: string, signatureLimit: number) => InviteCode
  deleteInviteCode: (code: string) => void
  addFeatureProposal: (proposal: FeatureProposalInput) => FeatureProposal
  updateFeatureProposalStatus: (proposalId: number, status: FeatureRequestStatus) => void
  fetchCandidates: () => Promise<void>
  fetchOrganizationProfile: () => Promise<void>
}

const initialDocuments: DocumentRecord[] = []
const initialAgencies: AgencyAccess[] = []
const initialInviteCodes: InviteCode[] = []
const initialFeatureProposals: FeatureProposal[] = []

const superAdminEmails = ['admin@aether.pl', 'aetherflowbiznes@gmail.com']
const AUTH_PROFILE_STORAGE_KEY = 'aether_flow_auth_profile'

const AppContext = createContext<AppContextValue | null>(null)

interface StoredAuthProfile {
  email: string
  role: UserRole
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: string
    email: string
  }
}

interface TestAuthResponse {
  user_details: {
    user_id: string
    organization_id: string
    role: string
  }
}

function readStoredAuthProfile(): StoredAuthProfile | null {
  try {
    const rawProfile = window.localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)

    return rawProfile ? (JSON.parse(rawProfile) as StoredAuthProfile) : null
  } catch {
    return null
  }
}

function storeAuthProfile(profile: StoredAuthProfile) {
  window.localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

function clearAuthProfile() {
  window.localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
}

function resolveUserRole(email: string, backendRole?: string): UserRole {
  if (superAdminEmails.includes(email.trim().toLowerCase())) {
    return 'super_admin'
  }

  return backendRole ? 'recruiter' : 'guest'
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }

  return fallback
}

export function AppProvider({ children }: { children: ReactNode }) {
  const storedAuthProfile = getAccessToken() ? readStoredAuthProfile() : null
  const [authReady, setAuthReady] = useState(false)
  const [role, setRole] = useState<UserRole>(storedAuthProfile?.role ?? 'guest')
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(storedAuthProfile?.email ?? null)
  const [organizationProfile, setOrganizationProfile] = useState<OrganizationProfile | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments)
  const candidateStatusRef = useRef<Map<string, DocumentStatus>>(new Map())
  const [agencies, setAgencies] = useState<AgencyAccess[]>(initialAgencies)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>(initialInviteCodes)
  const [featureProposals, setFeatureProposals] = useState<FeatureProposal[]>(initialFeatureProposals)
  const [activeFormLink, setActiveFormLink] = useState<FormLinkConfig | null>(null)

  const centralCandidatesList = useMemo(
    () => documents.filter((document) => !document.deleted),
    [documents],
  )

  const clearAuthState = useCallback(() => {
    clearAccessToken()
    clearAuthProfile()
    setRole('guest')
    setCurrentUserEmail(null)
    setOrganizationProfile(null)
  }, [])

  const syncAuthFromSession = useCallback(async (session: Session | null) => {
    if (!session?.access_token) {
      return false
    }

    const email = session.user.email?.trim() ?? ''

    if (!email) {
      return false
    }

    const normalizedEmail = email.toLowerCase()
    setAccessToken(session.access_token)

    if (superAdminEmails.includes(normalizedEmail)) {
      const nextRole: UserRole = 'super_admin'
      setRole(nextRole)
      setCurrentUserEmail(email)
      storeAuthProfile({ email, role: nextRole })
      return true
    }

    try {
      const testAuthResponse = await apiRequest<TestAuthResponse>('/api/v1/test-auth', {
        auth: true,
      })
      const nextRole = resolveUserRole(email, testAuthResponse.user_details.role)

      setRole(nextRole)
      setCurrentUserEmail(email)
      storeAuthProfile({ email, role: nextRole })

      return true
    } catch {
      const storedProfile = readStoredAuthProfile()

      if (storedProfile?.email.toLowerCase() === normalizedEmail) {
        setRole(storedProfile.role)
        setCurrentUserEmail(storedProfile.email)
        return true
      }

      return false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (session) {
        await syncAuthFromSession(session)
      } else if (!getAccessToken()) {
        clearAuthState()
      }

      if (isMounted) {
        setAuthReady(true)
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        return
      }

      if (event === 'SIGNED_OUT' || !session) {
        if (event === 'SIGNED_OUT') {
          clearAuthState()
        }
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        await syncAuthFromSession(session)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [clearAuthState, syncAuthFromSession])

  const authenticateWithPassword = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const normalizedEmail = email.trim().toLowerCase()

    try {
      const loginResponse = await apiRequest<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: normalizedEmail,
          password,
        },
      })
      setAccessToken(loginResponse.access_token)

      if (loginResponse.refresh_token) {
        await supabase.auth.setSession({
          access_token: loginResponse.access_token,
          refresh_token: loginResponse.refresh_token,
        })
      }

      const isSuperAdmin = superAdminEmails.includes(normalizedEmail)

      if (!isSuperAdmin) {
        const testAuthResponse = await apiRequest<TestAuthResponse>('/api/v1/test-auth', {
          auth: true,
        })
        const nextRole = resolveUserRole(loginResponse.user.email, testAuthResponse.user_details.role)

        setRole(nextRole)
        setCurrentUserEmail(loginResponse.user.email)
        storeAuthProfile({ email: loginResponse.user.email, role: nextRole })

        return { ok: true, role: nextRole }
      }

      const nextRole = resolveUserRole(loginResponse.user.email)

      setRole(nextRole)
      setCurrentUserEmail(loginResponse.user.email)
      storeAuthProfile({ email: loginResponse.user.email, role: nextRole })

      return { ok: true, role: nextRole }
    } catch (error) {
      clearAuthState()
      void supabase.auth.signOut()

      return {
        ok: false,
        error: getAuthErrorMessage(error, 'Nie udało się zalogować. Sprawdź email i hasło.'),
      }
    }
  }, [clearAuthState])

  const fetchCandidates = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? getAccessToken()

    if (!token) {
      return
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/candidates`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new ApiError(
        `Nie udało się pobrać kandydatów (${response.status})`,
        response.status,
      )
    }

    const data = (await response.json()) as { candidates?: Parameters<typeof mapBackendCandidateToDocumentRecord>[0][] }
    const recruiterLabel = currentUserEmail ?? '—'
    const mappedCandidates = (data.candidates ?? []).map((candidate) =>
      mapBackendCandidateToDocumentRecord(candidate, recruiterLabel),
    )

    for (const candidate of mappedCandidates) {
      const previousStatus = candidateStatusRef.current.get(candidate.backendId)
      candidateStatusRef.current.set(candidate.backendId, candidate.status)

      if (
        candidate.status === 'SIGNED' &&
        previousStatus !== undefined &&
        previousStatus !== 'SIGNED' &&
        candidate.backendId
      ) {
        const filename = `filled_${candidate.role}.pdf`

        void downloadSignedCandidateDocument(candidate.backendId, filename).catch((error) => {
          console.error('Nie udało się automatycznie pobrać podpisanego dokumentu:', error)
        })
      }
    }

    setDocuments(mappedCandidates)

    if (role === 'recruiter') {
      try {
        const profile = await getOrganizationProfile()
        setOrganizationProfile(profile)
      } catch (error) {
        console.error('Nie udało się odświeżyć profilu agencji:', error)
      }
    }
  }, [currentUserEmail, role])

  const deleteDocuments = useCallback(
    async (documentIds: number[]) => {
      const backendIds = documents
        .filter((document) => documentIds.includes(document.id) && document.backendId)
        .map((document) => document.backendId)

      if (backendIds.length === 0) {
        return
      }

      await deleteCandidatesRequest({ candidate_ids: backendIds })
      await fetchCandidates()
    },
    [documents, fetchCandidates],
  )

  const deleteAllDocuments = useCallback(async () => {
    await deleteCandidatesRequest({ delete_all: true })
    await fetchCandidates()
  }, [fetchCandidates])

  const fetchOrganizationProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setOrganizationProfile(null)
      return
    }

    try {
      const profile = await getOrganizationProfile()
      setOrganizationProfile(profile)
    } catch (error) {
      console.error('Nie udało się pobrać profilu agencji:', error)
      setOrganizationProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!authReady || role !== 'recruiter') {
      if (role !== 'recruiter') {
        setOrganizationProfile(null)
      }
      return
    }

    void fetchOrganizationProfile()
  }, [authReady, fetchOrganizationProfile, role])

  const user = useMemo<AuthUser | null>(
    () => (currentUserEmail ? { email: currentUserEmail } : null),
    [currentUserEmail],
  )

  const isAuthenticated = role !== 'guest'

  const value = useMemo<AppContextValue>(
    () => ({
      role,
      user,
      isAuthenticated,
      authReady,
      currentUserEmail,
      organizationProfile,
      documents,
      centralCandidatesList,
      agencies,
      inviteCodes,
      featureProposals,
      activeFormLink,
      login: authenticateWithPassword,
      registerAgency: async (agencyName, fullName, email, password, inviteCode) => {
        const normalizedEmail = email.trim().toLowerCase()

        try {
          await apiRequest('/api/v1/auth/register-tenant', {
            method: 'POST',
            body: {
              company_name: agencyName.trim(),
              email: normalizedEmail,
              password,
              full_name: fullName.trim(),
              invite_code: inviteCode.trim().toUpperCase(),
            },
            responseType: 'void',
          })

          return await authenticateWithPassword(normalizedEmail, password)
        } catch (error) {
          return {
            ok: false,
            error: getAuthErrorMessage(error, 'Nie udało się zarejestrować agencji.'),
          }
        }
      },
      logout: () => {
        clearAuthState()
        void supabase.auth.signOut()
        setDocuments([])
      },
      fetchCandidates,
      fetchOrganizationProfile,
      addAgencyManually: (agency) => {
        const nextAgency: AgencyAccess = {
          ...agency,
          id: agencies.length + 1,
          usedSignatures: 0,
        }

        setAgencies((currentAgencies) => [...currentAgencies, nextAgency])

        return nextAgency
      },
      generateFormLink: (config) => {
        const slug =
          config.template === 'Umowa B2B (wersja 2026) + Załączniki'
            ? 'umowa-b2b'
            : 'umowa-zlecenie'
        const nextLink: FormLinkConfig = {
          ...config,
          slug,
          url: `aetherflow.pl/f/${slug}`,
        }

        setActiveFormLink(nextLink)

        return nextLink
      },
      submitCandidateForm: (data) => {
        const candidateName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim()
        const initials = `${data.firstName.trim().charAt(0)}${data.lastName.trim().charAt(0)}`.toUpperCase()
        const contractType: DocumentRecord['contractType'] =
          activeFormLink?.template === 'Umowa B2B (wersja 2026) + Załączniki' ? 'B2B' : 'Umowa zlecenie'
        const nextDocument: DocumentRecord = {
          id: Math.max(0, ...documents.map((currentDocument) => currentDocument.id)) + 1,
          backendId: '',
          initials,
          candidateName,
          candidateEmail: data.email.trim(),
          role: 'Formularz rekrutacyjny',
          company: '',
          contractType,
          status: 'DATA_COMPLETED',
          lastChange: 'przed chwilą',
          recruiter: currentUserEmail ?? '—',
        }

        setDocuments((currentDocuments) => [nextDocument, ...currentDocuments])

        return nextDocument
      },
      updateDocumentStatus: (documentId, status) => {
        setDocuments((currentDocuments) =>
          currentDocuments.map((document) =>
            document.id === documentId
              ? { ...document, status, lastChange: 'przed chwilą' }
              : document,
          ),
        )
      },
      deleteDocuments,
      deleteAllDocuments,
      updateAgencySignatureLimit: (agencyId, signatureLimit) => {
        setAgencies((currentAgencies) =>
          currentAgencies.map((agency) =>
            agency.id === agencyId ? { ...agency, signatureLimit } : agency,
          ),
        )
      },
      updateAgencyPlan: (agencyId, plan, signatureLimit) => {
        setAgencies((currentAgencies) =>
          currentAgencies.map((agency) =>
            agency.id === agencyId
              ? {
                  ...agency,
                  plan,
                  signatureLimit,
                  paymentStatus: plan === 'Start (Testowy)' ? 'trial' : 'paid',
                  planValidUntil: plan === 'Start (Testowy)' ? 'Okres testowy (3 dni)' : 'Do 12.07.2026',
                }
              : agency,
          ),
        )
      },
      blockAgencyAccess: (agencyId) => {
        setAgencies((currentAgencies) =>
          currentAgencies.map((agency) =>
            agency.id === agencyId
              ? {
                  ...agency,
                  paymentStatus: 'overdue',
                  planValidUntil: 'Dostęp zablokowany',
                }
              : agency,
          ),
        )
      },
      generateInviteCode: (plan, signatureLimit) => {
        const nextCode: InviteCode = {
          code: `AETHER-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          createdAt: 'przed chwilą',
          status: 'aktywny',
          plan,
          signatureLimit,
        }

        setInviteCodes((currentCodes) => [nextCode, ...currentCodes])

        return nextCode
      },
      deleteInviteCode: (code) => {
        setInviteCodes((currentCodes) => currentCodes.filter((inviteCode) => inviteCode.code !== code))
      },
      addFeatureProposal: (proposal) => {
        const nextProposal: FeatureProposal = {
          ...proposal,
          id: featureProposals.length + 1,
          status: 'Nowe',
          createdAt: 'przed chwilą',
        }

        setFeatureProposals((currentProposals) => [nextProposal, ...currentProposals])

        return nextProposal
      },
      updateFeatureProposalStatus: (proposalId, status) => {
        setFeatureProposals((currentProposals) =>
          currentProposals.map((proposal) =>
            proposal.id === proposalId ? { ...proposal, status } : proposal,
          ),
        )
      },
    }),
    [
      activeFormLink,
      agencies,
      authReady,
      authenticateWithPassword,
      centralCandidatesList,
      currentUserEmail,
      deleteAllDocuments,
      deleteDocuments,
      documents,
      featureProposals,
      fetchCandidates,
      fetchOrganizationProfile,
      inviteCodes,
      isAuthenticated,
      organizationProfile,
      role,
      user,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider')
  }

  return context
}
