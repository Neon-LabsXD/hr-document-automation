import type { AgencyAccess } from '../context/AppContext'

const planMonthlyPrices: Record<string, number> = {
  'Start (Testowy)': 0,
  Start: 0,
  Biznes: 199,
  Pro: 499,
}

function getAgencyPlanPrice(plan: string) {
  return planMonthlyPrices[plan] ?? 0
}

export function getMonthlyRecurringRevenue(agencies: AgencyAccess[]) {
  return agencies
    .filter((agency) => agency.paymentStatus === 'paid' || agency.paymentStatus === 'trial')
    .reduce((total, agency) => total + getAgencyPlanPrice(agency.plan), 0)
}

export function formatPlnAmount(amount: number) {
  if (amount === 0) {
    return '0 PLN'
  }

  return `${amount.toLocaleString('pl-PL')} PLN`
}

export function getActiveSubscriptionCount(agencies: AgencyAccess[]) {
  return agencies.filter((agency) => agency.paymentStatus === 'paid' || agency.paymentStatus === 'trial').length
}

export function getGlobalSmtpUsage(agencies: AgencyAccess[]) {
  const used = agencies.reduce((total, agency) => total + agency.usedSignatures, 0)
  const limit = agencies.reduce((total, agency) => total + agency.signatureLimit, 0)

  return { used, limit }
}

export function formatUsageRatio(used: number, limit: number) {
  return `${used.toLocaleString('pl-PL')} / ${limit.toLocaleString('pl-PL')}`
}
