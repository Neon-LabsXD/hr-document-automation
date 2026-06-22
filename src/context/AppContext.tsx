import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ApiError, apiRequest, clearAccessToken, getAccessToken, setAccessToken } from '../lib/api'

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
  initials: string
  candidateName: string
  candidateEmail: string
  role: string
  company: string
  contractType: 'B2B' | 'Umowa zlecenie' | 'Umowa o pracę'
  status: DocumentStatus
  lastChange: string
  recruiter: string
  deleted?: boolean
}

export type FormTemplate =
  | 'Umowa Zlecenie + Oświadczenie'
  | 'Umowa B2B (wersja 2026) + Załączniki'

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

interface AppContextValue {
  role: UserRole
  currentUserEmail: string | null
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
  softDeleteDocument: (documentId: number) => void
  updateAgencySignatureLimit: (agencyId: number, signatureLimit: number) => void
  updateAgencyPlan: (agencyId: number, plan: string, signatureLimit: number) => void
  blockAgencyAccess: (agencyId: number) => void
  generateInviteCode: (plan: string, signatureLimit: number) => InviteCode
  deleteInviteCode: (code: string) => void
  addFeatureProposal: (proposal: FeatureProposalInput) => FeatureProposal
  updateFeatureProposalStatus: (proposalId: number, status: FeatureRequestStatus) => void
}

const initialDocuments: DocumentRecord[] = [
  {
    id: 1,
    initials: 'JS',
    candidateName: 'Jan Kowalski',
    candidateEmail: 'jan.kowalski@gmail.com',
    role: 'Senior IT Specialist',
    company: 'Luminex Jobcontrol',
    contractType: 'B2B',
    status: 'SIGNED',
    lastChange: '18 min temu',
    recruiter: 'Anna Kowalska',
  },
  {
    id: 2,
    initials: 'AN',
    candidateName: 'Anna Nowak',
    candidateEmail: 'anna.nowak@outlook.com',
    role: 'Product Designer',
    company: 'Luminex & Finnco',
    contractType: 'Umowa zlecenie',
    status: 'OTP_VERIFIED',
    lastChange: '2 godz. temu',
    recruiter: 'Anna Kowalska',
  },
  {
    id: 3,
    initials: 'PW',
    candidateName: 'Piotr Wiśniewski',
    candidateEmail: 'p.wisniewski@gmail.com',
    role: 'Dev-Ops Engineer',
    company: 'Ametrix 82A',
    contractType: 'B2B',
    status: 'OPENED',
    lastChange: '3 godz. temu',
    recruiter: 'Tomasz Nowak',
  },
  {
    id: 4,
    initials: 'KW',
    candidateName: 'Katarzyna Wójcik',
    candidateEmail: 'k.wojcik@proton.me',
    role: 'Marketing Lead',
    company: 'Luminex Zasoby',
    contractType: 'Umowa o pracę',
    status: 'SENT',
    lastChange: '3 godz. temu',
    recruiter: 'Tomasz Nowak',
  },
  {
    id: 5,
    initials: 'TL',
    candidateName: 'Tomasz Lewandowski',
    candidateEmail: 't.lewandowski@mail.com',
    role: 'Finance Analyst',
    company: 'Luminex & Finnco',
    contractType: 'Umowa zlecenie',
    status: 'SIGNED',
    lastChange: '19 godz. temu',
    recruiter: 'Janusz Cygan',
  },
  {
    id: 6,
    initials: 'MZ',
    candidateName: 'Magdalena Zielińska',
    candidateEmail: 'm.zielinska@gmail.com',
    role: 'Data Scientist',
    company: 'Kurbet EST',
    contractType: 'B2B',
    status: 'OTP_VERIFIED',
    lastChange: '21 godz. temu',
    recruiter: 'Anna Kowalska',
  },
  {
    id: 7,
    initials: 'MS',
    candidateName: 'Marek Szymański',
    candidateEmail: 'marek.szymanski@wp.pl',
    role: 'Sales Representative',
    company: 'Luminex Advance',
    contractType: 'Umowa o pracę',
    status: 'SENT',
    lastChange: '22 godz. temu',
    recruiter: 'Janusz Cygan',
  },
]

const initialAgencies: AgencyAccess[] = [
  {
    id: 1,
    name: 'TalentBridge Sp. z o.o.',
    nip: '521-19-84-832',
    signatureLimit: 800,
    usedSignatures: 184,
    plan: 'Pro',
    planValidUntil: 'Do 12.07.2026',
    paymentStatus: 'paid',
  },
  {
    id: 2,
    name: 'HireWave Polska',
    nip: '634-28-91-115',
    signatureLimit: 200,
    usedSignatures: 73,
    plan: 'Biznes',
    planValidUntil: 'Do 12.07.2026',
    paymentStatus: 'paid',
  },
  {
    id: 3,
    name: 'NordStaff Group',
    nip: '781-10-44-902',
    signatureLimit: 20,
    usedSignatures: 8,
    plan: 'Start (Testowy)',
    planValidUntil: 'Okres testowy (3 dni)',
    paymentStatus: 'trial',
  },
]

const initialInviteCodes: InviteCode[] = [
  {
    code: 'AETHER2026',
    createdAt: 'kod testowy',
    status: 'wykorzystany',
    plan: 'Pro',
    signatureLimit: 800,
    usedBy: 'TalentBridge Sp. z o.o.',
  },
]

const initialFeatureProposals: FeatureProposal[] = [
  {
    id: 1,
    agencyName: 'TalentBridge Sp. z o.o.',
    contactEmail: 'ops@talentbridge.pl',
    featureName: 'Automatyczne przypomnienia SMS',
    description: 'Chcemy wysyłać SMS do kandydatów, którzy otworzyli umowę, ale nie przeszli OTP.',
    priority: 'Ważne (Ułatwi codzienne operacje)',
    status: 'Nowe',
    createdAt: 'dziś',
  },
  {
    id: 2,
    agencyName: 'HireWave Polska',
    contactEmail: 'contact@hirewave.pl',
    featureName: 'Integracja z WhatsApp',
    description:
      'Kandydaci na stanowiska liniowe rzadko sprawdzają skrzynki e-mail, przez co proces podpisania umowy się wydłuża. Chcemy wysyłać powiadomienia z linkiem OTP bezpośrednio na WhatsApp.',
    priority: 'Krytyczne (Blokuje mój rozwój / Przejście z innego systemu)',
    status: 'W realizacji',
    createdAt: 'wczoraj',
  },
  {
    id: 3,
    agencyName: 'NordStaff Group',
    contactEmail: 'hr@nordstaff.pl',
    featureName: 'Ciemny motyw (Dark Mode) dla panelu rekrutera',
    description:
      'Wielu rekruterów pracuje do późnego wieczora. Jasny interfejs bardzo męczy wzrok przy wielogodzinnym przeglądaniu umów.',
    priority: 'Miło mieć (Fajny dodatek)',
    status: 'Zrobione',
    createdAt: '3 dni temu',
  },
]

const superAdminEmails = ['admin@aether.pl', 'aetherflowbiznes@gmail.com']
const AUTH_PROFILE_STORAGE_KEY = 'aether_flow_auth_profile'

const AppContext = createContext<AppContextValue | null>(null)

interface StoredAuthProfile {
  email: string
  role: UserRole
}

interface LoginResponse {
  access_token: string
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
  const [role, setRole] = useState<UserRole>(storedAuthProfile?.role ?? 'guest')
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(storedAuthProfile?.email ?? null)
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments)
  const [agencies, setAgencies] = useState<AgencyAccess[]>(initialAgencies)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>(initialInviteCodes)
  const [featureProposals, setFeatureProposals] = useState<FeatureProposal[]>(initialFeatureProposals)
  const [activeFormLink, setActiveFormLink] = useState<FormLinkConfig | null>(null)

  const centralCandidatesList = useMemo(
    () => documents.filter((document) => !document.deleted),
    [documents],
  )

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

      const testAuthResponse = await apiRequest<TestAuthResponse>('/api/v1/test-auth', {
        auth: true,
      })
      const nextRole = resolveUserRole(loginResponse.user.email, testAuthResponse.user_details.role)

      setRole(nextRole)
      setCurrentUserEmail(loginResponse.user.email)
      storeAuthProfile({ email: loginResponse.user.email, role: nextRole })

      return { ok: true, role: nextRole }
    } catch (error) {
      clearAccessToken()
      clearAuthProfile()
      setRole('guest')
      setCurrentUserEmail(null)

      return {
        ok: false,
        error: getAuthErrorMessage(error, 'Nie udało się zalogować. Sprawdź email i hasło.'),
      }
    }
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      role,
      currentUserEmail,
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
        clearAccessToken()
        clearAuthProfile()
        setRole('guest')
        setCurrentUserEmail(null)
      },
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
            ? 'talentbridge-umowa-b2b'
            : 'talentbridge-umowa-zlecenie'
        const nextLink: FormLinkConfig = {
          ...config,
          slug,
          url: `aetherai.pl/f/${slug}`,
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
          initials,
          candidateName,
          candidateEmail: data.email.trim(),
          role: 'Formularz rekrutacyjny',
          company: 'TalentBridge Sp. z o.o.',
          contractType,
          status: 'DATA_COMPLETED',
          lastChange: 'przed chwilą',
          recruiter: 'Anna Kowalska',
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
      softDeleteDocument: (documentId) => {
        setDocuments((currentDocuments) =>
          currentDocuments.map((document) =>
            document.id === documentId ? { ...document, deleted: true } : document,
          ),
        )
      },
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
      authenticateWithPassword,
      centralCandidatesList,
      currentUserEmail,
      documents,
      featureProposals,
      inviteCodes,
      role,
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
