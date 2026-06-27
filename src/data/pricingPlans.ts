export type PricingPlanId = 'start' | 'biznes' | 'pro'

export interface PricingPlan {
  id: PricingPlanId
  name: string
  signatureLimit: number
  limit: string
  price: string
  oldPrice?: string
  priceNote?: string
  description: string
  highlighted?: boolean
  features: string[]
  ctaLabel: string
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'start',
    name: 'Start (Testowy)',
    signatureLimit: 20,
    limit: 'do 20 podpisów / miesiąc',
    price: '0 PLN',
    description: 'Dla agencji, które chcą bez ryzyka przetestować pierwszy proces podpisu.',
    features: ['Panel statusów dokumentów', 'Weryfikacja OTP', 'Podstawowa historia audytu'],
    ctaLabel: 'Wybierz plan',
  },
  {
    id: 'biznes',
    name: 'Biznes',
    signatureLimit: 200,
    limit: 'do 200 podpisów / miesiąc',
    price: '199 PLN',
    oldPrice: '399 PLN',
    priceNote: '*Cena gwarantowana na zawsze dla pierwszych klientów',
    description: 'Najlepszy wybór dla zespołów rekrutacyjnych z codziennym obiegiem dokumentów.',
    highlighted: true,
    features: ['Multi-tenancy dla agencji', 'Automatyczne przypomnienia', 'Priorytetowe wsparcie'],
    ctaLabel: 'Uruchom Biznes',
  },
  {
    id: 'pro',
    name: 'Pro',
    signatureLimit: 800,
    limit: 'do 800 podpisów / miesiąc',
    price: '499 PLN',
    oldPrice: '899 PLN',
    description: 'Dla większych agencji i zespołów, które potrzebują pełnej kontroli nad skalą.',
    features: ['Limit 800 podpisów', 'Dedykowane środowisko', 'Zaawansowane SLA'],
    ctaLabel: 'Wybierz plan',
  },
]

export function getPricingPlanById(planId: PricingPlanId) {
  return pricingPlans.find((plan) => plan.id === planId) ?? pricingPlans[0]
}

export function resolvePricingPlanId(planName: string | null | undefined): PricingPlanId {
  const normalized = (planName ?? '').trim().toLowerCase()

  if (normalized.includes('pro')) {
    return 'pro'
  }

  if (normalized.includes('biznes') || normalized.includes('business')) {
    return 'biznes'
  }

  return 'start'
}
