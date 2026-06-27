import type { DocumentRecord, DocumentStatus } from '../context/AppContext'

const funnelStageStatuses: DocumentStatus[] = ['SENT', 'OPENED', 'OTP_VERIFIED', 'SIGNED']

const funnelStageRank: Record<DocumentStatus, number> = {
  PENDING_GENERATION: 0,
  DATA_COMPLETED: 0,
  SENT: 1,
  OPENED: 2,
  OTP_VERIFIED: 3,
  SIGNED: 4,
}

export interface FunnelMetric {
  label: string
  value: number
  tone: 'sent' | 'opened' | 'otp' | 'signed'
}

export interface RecruiterMetric {
  name: string
  initials: string
  sent: number
  signed: number
  success: number
  averageTime: string
}

function getRecruiterInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getAverageTime(signed: number, sent: number) {
  if (sent === 0) {
    return '—'
  }

  const ratio = signed / sent

  if (ratio >= 0.75) {
    return '4h'
  }

  if (ratio >= 0.5) {
    return '1.2 dnia'
  }

  return '3 dni'
}

export function getActiveCandidates(documents: DocumentRecord[]) {
  return documents.filter((document) => !document.deleted)
}

export function getActiveContractsCount(candidates: DocumentRecord[]) {
  return candidates.length
}

export function getPendingSignatureCount(candidates: DocumentRecord[]) {
  return candidates.filter((document) => document.status === 'SENT' || document.status === 'OTP_VERIFIED').length
}

export function getSignedCount(candidates: DocumentRecord[]) {
  return candidates.filter((document) => document.status === 'SIGNED').length
}

export function getConversionRate(candidates: DocumentRecord[]) {
  if (candidates.length === 0) {
    return 0
  }

  return Math.round((getSignedCount(candidates) / candidates.length) * 100)
}

export function getFunnelMetrics(candidates: DocumentRecord[]): FunnelMetric[] {
  const total = candidates.length

  if (total === 0) {
    return [
      { label: 'Wysłano', value: 0, tone: 'sent' },
      { label: 'Otwarto', value: 0, tone: 'opened' },
      { label: 'Zweryfikowano OTP', value: 0, tone: 'otp' },
      { label: 'Podpisano', value: 0, tone: 'signed' },
    ]
  }

  const stageThresholds: Array<{ label: string; minRank: number; tone: FunnelMetric['tone'] }> = [
    { label: 'Wysłano', minRank: funnelStageRank.SENT, tone: 'sent' },
    { label: 'Otwarto', minRank: funnelStageRank.OPENED, tone: 'opened' },
    { label: 'Zweryfikowano OTP', minRank: funnelStageRank.OTP_VERIFIED, tone: 'otp' },
    { label: 'Podpisano', minRank: funnelStageRank.SIGNED, tone: 'signed' },
  ]

  return stageThresholds.map((stage) => {
    const count = candidates.filter((candidate) => funnelStageRank[candidate.status] >= stage.minRank).length

    return {
      label: stage.label,
      value: Math.round((count / total) * 100),
      tone: stage.tone,
    }
  })
}

export function getRecruiterMetrics(candidates: DocumentRecord[]): RecruiterMetric[] {
  const grouped = candidates.reduce<Record<string, DocumentRecord[]>>((accumulator, candidate) => {
    const recruiterName = candidate.recruiter

    if (!accumulator[recruiterName]) {
      accumulator[recruiterName] = []
    }

    accumulator[recruiterName].push(candidate)

    return accumulator
  }, {})

  return Object.entries(grouped)
    .map(([name, recruiterCandidates]) => {
      const sent = recruiterCandidates.length
      const signed = recruiterCandidates.filter((candidate) => candidate.status === 'SIGNED').length
      const success = sent === 0 ? 0 : Math.round((signed / sent) * 100)

      return {
        name,
        initials: getRecruiterInitials(name),
        sent,
        signed,
        success,
        averageTime: getAverageTime(signed, sent),
      }
    })
    .sort((left, right) => right.sent - left.sent)
}

export function getSlaDistribution(candidates: DocumentRecord[]) {
  if (candidates.length === 0) {
    return [
      { label: 'W ciągu 2h', value: 0 },
      { label: 'W ciągu 24h', value: 0 },
      { label: 'Powyżej 48h', value: 0 },
    ]
  }

  const fast = candidates.filter((candidate) => candidate.status === 'SIGNED').length
  const medium = candidates.filter((candidate) =>
    ['OPENED', 'OTP_VERIFIED'].includes(candidate.status),
  ).length
  const slow = candidates.filter((candidate) =>
    ['SENT', 'PENDING_GENERATION', 'DATA_COMPLETED'].includes(candidate.status),
  ).length
  const total = fast + medium + slow || 1

  return [
    { label: 'W ciągu 2h', value: Math.round((fast / total) * 100) },
    { label: 'W ciągu 24h', value: Math.round((medium / total) * 100) },
    { label: 'Powyżej 48h', value: Math.round((slow / total) * 100) },
  ]
}

export function getAverageSigningTimeLabel(candidates: DocumentRecord[]) {
  if (candidates.length === 0) {
    return '0 dni'
  }

  const signedRatio = getSignedCount(candidates) / candidates.length

  if (signedRatio >= 0.5) {
    return '1,4 dnia'
  }

  if (signedRatio >= 0.25) {
    return '2,1 dnia'
  }

  return '3 dni'
}

export { funnelStageStatuses }
