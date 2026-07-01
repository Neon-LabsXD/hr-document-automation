import type { DocumentRecord, DocumentStatus } from '../context/AppContext'

export interface BackendCandidate {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  status?: string | null
  template_id?: number | null
  template_name?: string | null
  template_filename?: string | null
  invited_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  sent_at?: string | null
  opened_at?: string | null
  otp_verified_at?: string | null
  signed_at?: string | null
}

const backendStatusToDocumentStatus: Record<string, DocumentStatus> = {
  invited: 'PENDING_GENERATION',
  nowy: 'PENDING_GENERATION',
  new: 'PENDING_GENERATION',
  pending: 'PENDING_GENERATION',
  submitted: 'DATA_COMPLETED',
  'data_completed': 'DATA_COMPLETED',
  sent: 'SENT',
  wyslano: 'SENT',
  opened: 'OPENED',
  otwarto: 'OPENED',
  otp_verified: 'OTP_VERIFIED',
  signed: 'SIGNED',
  error: 'PENDING_GENERATION',
}

function mapCandidateStatus(status: string | null | undefined): DocumentStatus {
  if (!status) {
    return 'PENDING_GENERATION'
  }

  const normalized = status.trim().toLowerCase()
  return backendStatusToDocumentStatus[normalized] ?? 'PENDING_GENERATION'
}

function candidateIdToNumber(id: string): number {
  const hex = id.replace(/-/g, '').slice(0, 8)
  const parsed = Number.parseInt(hex, 16)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now()
}

function formatLastChange(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '—'
  }

  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) {
    return 'przed chwilą'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min temu`
  }

  const diffHours = Math.floor(diffMinutes / 60)

  if (diffHours < 24) {
    return `${diffHours} godz. temu`
  }

  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 1) {
    return 'wczoraj'
  }

  return `${diffDays} dni temu`
}

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0)
  const last = lastName.trim().charAt(0)
  const initials = `${first}${last}`.toUpperCase()

  return initials || '??'
}

function resolveTemplateLabel(candidate: BackendCandidate): string {
  const templateName = (candidate.template_name ?? '').trim()

  if (templateName) {
    return templateName
  }

  const filename = (candidate.template_filename ?? '').trim()

  if (filename) {
    return filename.toLowerCase().endsWith('.pdf') ? filename.slice(0, -4) : filename
  }

  return 'Dokument agencji'
}

export function mapBackendCandidateToDocumentRecord(
  candidate: BackendCandidate,
  recruiterLabel = '—',
): DocumentRecord {
  const firstName = (candidate.first_name ?? '').trim()
  const lastName = (candidate.last_name ?? '').trim()
  const candidateName = `${firstName} ${lastName}`.trim() || (candidate.email ?? 'Kandydat')
  const templateLabel = resolveTemplateLabel(candidate)

  return {
    id: candidateIdToNumber(candidate.id),
    backendId: candidate.id,
    initials: getInitials(firstName, lastName),
    candidateName,
    candidateEmail: (candidate.email ?? '').trim(),
    role: templateLabel,
    company: '',
    contractType: templateLabel,
    status: mapCandidateStatus(candidate.status),
    lastChange: formatLastChange(candidate.updated_at ?? candidate.created_at),
    recruiter: recruiterLabel,
    sentAt: candidate.sent_at ?? null,
    openedAt: candidate.opened_at ?? null,
    otpVerifiedAt: candidate.otp_verified_at ?? null,
    signedAt: candidate.signed_at ?? null,
  }
}
