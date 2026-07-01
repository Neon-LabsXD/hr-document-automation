import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Header } from '../components/Header'
import { useAppContext } from '../context/AppContext'
import { pricingPlans, type PricingPlanId } from '../data/pricingPlans'
import { getOrganizationSubscription, updateOrganizationSubscription } from '../lib/backend'

export function Pricing() {
  const { fetchOrganizationProfile, patchOrganizationSubscription } = useAppContext()
  const [currentPlanId, setCurrentPlanId] = useState<PricingPlanId>('start')
  const [signaturesLimit, setSignaturesLimit] = useState(20)
  const [isLoading, setIsLoading] = useState(true)
  const [updatingPlanId, setUpdatingPlanId] = useState<PricingPlanId | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadSubscription() {
      setIsLoading(true)

      try {
        const subscription = await getOrganizationSubscription()

        if (!ignore) {
          setCurrentPlanId(subscription.plan_id as PricingPlanId)
          setSignaturesLimit(subscription.signatures_limit)
        }
      } catch (error) {
        if (!ignore) {
          console.error('Nie udało się pobrać planu subskrypcji:', error)
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadSubscription()

    return () => {
      ignore = true
    }
  }, [])

  const handleSelectPlan = async (planId: PricingPlanId) => {
    const selectedPlan = pricingPlans.find((plan) => plan.id === planId)

    if (!selectedPlan || selectedPlan.comingSoon || planId === currentPlanId || updatingPlanId) {
      return
    }

    setUpdatingPlanId(planId)
    setStatusMessage('')

    try {
      const subscription = await updateOrganizationSubscription(planId)
      setCurrentPlanId(subscription.plan_id as PricingPlanId)
      setSignaturesLimit(subscription.signatures_limit)
      patchOrganizationSubscription(subscription.plan_name, subscription.signatures_limit)
      await fetchOrganizationProfile()
      setStatusMessage(`Aktywowano plan ${subscription.plan_name}.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Nie udało się zmienić planu.')
    } finally {
      setUpdatingPlanId(null)
    }
  }

  return (
    <>
      <Header
        title="Plany i cennik"
        subtitle="Wybierz subskrypcję dopasowaną do wolumenu podpisów w Twojej agencji."
      />

      <section className="cabinet-pricing-summary">
        <div>
          <p className="eyebrow">Twój plan</p>
          <h2>{isLoading ? 'Ładowanie...' : pricingPlans.find((plan) => plan.id === currentPlanId)?.name}</h2>
          <span>
            Limit podpisów: <strong>{signaturesLimit}</strong> / miesiąc
          </span>
        </div>
        <p className="cabinet-pricing-note">* Ceny netto (bez VAT)</p>
      </section>

      {statusMessage && <p className="cabinet-pricing-status">{statusMessage}</p>}

      <section className="cabinet-pricing-section">
        <div className="pricing-grid">
          {pricingPlans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId
            const isUpdating = updatingPlanId === plan.id

            const isUnavailable = Boolean(plan.comingSoon)

            return (
              <article
                key={plan.id}
                className={`pricing-card ${plan.highlighted ? 'pricing-card-featured' : ''} ${
                  isCurrentPlan ? 'pricing-card-current' : ''
                } ${isUnavailable ? 'pricing-card-coming-soon' : ''}`}
              >
                {plan.highlighted && <span className="plan-badge">Najczęściej wybierany</span>}
                {isCurrentPlan && <span className="plan-badge plan-badge-current">Twój plan</span>}
                {isUnavailable && <span className="plan-badge plan-badge-coming-soon">W realizacji</span>}
                <h3>{plan.name}</h3>
                <p>{plan.limit}</p>
                <div className="flex flex-col gap-1">
                  {plan.oldPrice && (
                    <span className="text-sm font-semibold text-gray-400/50 line-through">{plan.oldPrice}</span>
                  )}
                  <strong>{plan.price}</strong>
                </div>
                <span className="plan-description">{plan.description}</span>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckCircle2 />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={isCurrentPlan || isUnavailable || isLoading || Boolean(updatingPlanId)}
                  onClick={() => void handleSelectPlan(plan.id)}
                >
                  {isCurrentPlan
                    ? 'Aktywny plan'
                    : isUnavailable
                      ? plan.ctaLabel
                      : isUpdating
                        ? 'Aktywowanie...'
                        : plan.ctaLabel}
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}
