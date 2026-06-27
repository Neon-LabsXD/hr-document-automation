import { useState, type FormEvent } from 'react'
import {
  Activity,
  Building2,
  CreditCard,
  MailCheck,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
  X,
} from 'lucide-react'
import { Header } from '../components/Header'
import { EmptyState } from '../components/EmptyState'
import { MetricCard } from '../components/UI/MetricCard'
import { useAppContext, type AgencyAccess, type AgencyInput } from '../context/AppContext'
import {
  formatPlnAmount,
  formatUsageRatio,
  getActiveSubscriptionCount,
  getGlobalSmtpUsage,
  getMonthlyRecurringRevenue,
} from '../utils/adminMetrics'

const paymentStatusLabels: Record<AgencyAccess['paymentStatus'], string> = {
  paid: 'Opłacono',
  trial: 'Okres testowy',
  overdue: 'Zaległe',
}

const paymentStatusClasses: Record<AgencyAccess['paymentStatus'], string> = {
  paid: 'status-success',
  trial: 'status-warning',
  overdue: 'status-danger',
}

const planOptions = [
  { name: 'Start (Testowy)', signatureLimit: 20 },
  { name: 'Biznes', signatureLimit: 200 },
  { name: 'Pro', signatureLimit: 800 },
]

const initialManualAgencyForm: AgencyInput = {
  name: '',
  nip: '',
  plan: 'Biznes',
  signatureLimit: 200,
  planValidUntil: 'Do 12.07.2026',
  paymentStatus: 'paid',
}

export function AdminAgencies() {
  const { addAgencyManually, agencies, blockAgencyAccess, updateAgencyPlan, updateAgencySignatureLimit } =
    useAppContext()
  const [openActionsAgencyId, setOpenActionsAgencyId] = useState<number | null>(null)
  const [editedAgency, setEditedAgency] = useState<AgencyAccess | null>(null)
  const [planEditedAgency, setPlanEditedAgency] = useState<AgencyAccess | null>(null)
  const [manualAgencyModalOpen, setManualAgencyModalOpen] = useState(false)
  const [manualAgencyForm, setManualAgencyForm] = useState<AgencyInput>(initialManualAgencyForm)
  const [agencySearch, setAgencySearch] = useState('')
  const [signatureLimitDraft, setSignatureLimitDraft] = useState('')
  const [planDraft, setPlanDraft] = useState('')
  const filteredAgencies = agencies.filter((agency) => {
    const searchValue = agencySearch.trim().toLowerCase()

    if (!searchValue) {
      return true
    }

    return [agency.name, agency.nip, agency.plan].some((value) => value.toLowerCase().includes(searchValue))
  })
  const monthlyRevenue = getMonthlyRecurringRevenue(agencies)
  const activeSubscriptions = getActiveSubscriptionCount(agencies)
  const smtpUsage = getGlobalSmtpUsage(agencies)
  const hasAgencies = agencies.length > 0

  const openLimitModal = (agency: AgencyAccess) => {
    setEditedAgency(agency)
    setSignatureLimitDraft(String(agency.signatureLimit))
    setOpenActionsAgencyId(null)
  }

  const closeLimitModal = () => {
    setEditedAgency(null)
    setSignatureLimitDraft('')
  }

  const openPlanModal = (agency: AgencyAccess) => {
    setPlanEditedAgency(agency)
    setPlanDraft(agency.plan)
    setOpenActionsAgencyId(null)
  }

  const closePlanModal = () => {
    setPlanEditedAgency(null)
    setPlanDraft('')
  }

  const handleBlockAccess = (agencyId: number) => {
    blockAgencyAccess(agencyId)
    setOpenActionsAgencyId(null)
  }

  const updateManualAgencyField = <FieldName extends keyof AgencyInput>(
    fieldName: FieldName,
    value: AgencyInput[FieldName],
  ) => {
    setManualAgencyForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }))
  }

  const handleManualAgencySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addAgencyManually(manualAgencyForm)
    setManualAgencyForm(initialManualAgencyForm)
    setManualAgencyModalOpen(false)
  }

  const handleManualPlanChange = (planName: string) => {
    const selectedPlan = planOptions.find((plan) => plan.name === planName)

    setManualAgencyForm((currentForm) => ({
      ...currentForm,
      plan: planName,
      signatureLimit: selectedPlan?.signatureLimit ?? currentForm.signatureLimit,
      paymentStatus: planName === 'Start (Testowy)' ? 'trial' : 'paid',
      planValidUntil: planName === 'Start (Testowy)' ? 'Okres testowy (3 dni)' : 'Do 12.07.2026',
    }))
  }

  const handleLimitSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editedAgency) {
      return
    }

    updateAgencySignatureLimit(editedAgency.id, Number(signatureLimitDraft))
    closeLimitModal()
  }

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!planEditedAgency) {
      return
    }

    const selectedPlan = planOptions.find((plan) => plan.name === planDraft)

    if (!selectedPlan) {
      return
    }

    updateAgencyPlan(planEditedAgency.id, selectedPlan.name, selectedPlan.signatureLimit)
    closePlanModal()
  }

  return (
    <>
      <Header
        title="Agencje"
        subtitle="Lista firm, które otrzymały dostęp do zamkniętej platformy Aether Flow."
      />

      <section className="page-card">
        <div className="page-card-icon">
          <Building2 />
        </div>
        <div>
          <h2>Invite-only tenant registry</h2>
          <p>Każda agencja ma własny limit podpisów i izolowaną przestrzeń danych.</p>
        </div>
      </section>

      <section className="admin-metrics-grid">
        <MetricCard
          label="MRR (Miesięczny przychód)"
          value={formatPlnAmount(monthlyRevenue)}
          description="aktywny przychód abonamentowy"
          delta={hasAgencies ? `${activeSubscriptions} aktywne` : '0%'}
          icon={TrendingUp}
        />
        <MetricCard
          label="Aktywne subskrypcje"
          value={String(activeSubscriptions)}
          description="firmy z dostępem do platformy"
          delta={hasAgencies ? `${agencies.length} łącznie` : '0'}
          icon={CreditCard}
        />
        <MetricCard
          label="Zużycie globalne SMTP"
          value={formatUsageRatio(smtpUsage.used, smtpUsage.limit)}
          description="wiadomości w bieżącym miesiącu"
          delta={smtpUsage.limit === 0 ? '0%' : `${Math.round((smtpUsage.used / smtpUsage.limit) * 100)}%`}
          icon={MailCheck}
        />
      </section>

      <section className="admin-panel-card">
        <div className="admin-table-toolbar">
          <button type="button" onClick={() => setManualAgencyModalOpen(true)}>
            <Plus />
            Dodaj agencję ręcznie
          </button>
          <div className="admin-search-box">
            <Search />
            <input
              type="search"
              value={agencySearch}
              onChange={(event) => setAgencySearch(event.target.value)}
              placeholder="Szukaj agencji..."
            />
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Agencja</th>
              <th>NIP</th>
              <th>Plan</th>
              <th>Ważność planu</th>
              <th>Status płatności</th>
              <th>Limit</th>
              <th>Zużycie</th>
              <th className="action-head">Akcja</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgencies.length === 0 ? (
              <EmptyState
                variant="table"
                colSpan={8}
                message={agencies.length === 0 ? 'Lista agencji jest pusta' : 'Brak wyników wyszukiwania'}
                description={
                  agencies.length === 0
                    ? 'Dodaj pierwszą agencję ręcznie lub wygeneruj kod zaproszenia.'
                    : 'Spróbuj zmienić frazę wyszukiwania.'
                }
              />
            ) : (
              filteredAgencies.map((agency) => (
              <tr key={agency.id}>
                <td>{agency.name}</td>
                <td>{agency.nip}</td>
                <td>{agency.plan}</td>
                <td>{agency.planValidUntil}</td>
                <td>
                  <span className={`status-pill ${paymentStatusClasses[agency.paymentStatus]}`}>
                    {paymentStatusLabels[agency.paymentStatus]}
                  </span>
                </td>
                <td>{agency.signatureLimit} podpisów / mies.</td>
                <td>{agency.usedSignatures} / {agency.signatureLimit}</td>
                <td>
                  <div className="admin-actions-cell">
                    <button
                      className="admin-row-action"
                      type="button"
                      aria-label={`Akcje dla ${agency.name}`}
                      onClick={() =>
                        setOpenActionsAgencyId((currentId) => (currentId === agency.id ? null : agency.id))
                      }
                    >
                      <MoreHorizontal />
                    </button>

                    {openActionsAgencyId === agency.id && (
                      <div className="admin-actions-menu">
                        <button type="button" onClick={() => openLimitModal(agency)}>
                          Edytuj limity
                        </button>
                        <button type="button" onClick={() => openPlanModal(agency)}>
                          Zmień plan
                        </button>
                        <button className="danger-action" type="button" onClick={() => handleBlockAccess(agency.id)}>
                          Zablokuj dostęp
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </section>

      {manualAgencyModalOpen && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-limit-modal" role="dialog" aria-modal="true" aria-labelledby="manual-agency-title">
            <button
              className="auth-close"
              type="button"
              aria-label="Zamknij modal"
              onClick={() => setManualAgencyModalOpen(false)}
            >
              <X />
            </button>
            <div className="offer-context-icon">
              <Building2 />
            </div>
            <h2 id="manual-agency-title">Dodaj agencję ręcznie</h2>
            <p>Utwórz tenant dla klienta, który opłaca dostęp poza standardowym procesem zaproszeń.</p>
            <form onSubmit={handleManualAgencySubmit}>
              <label>
                Nazwa agencji
                <input
                  required
                  type="text"
                  value={manualAgencyForm.name}
                  onChange={(event) => updateManualAgencyField('name', event.target.value)}
                  placeholder="Enterprise HR Polska"
                />
              </label>
              <label>
                NIP
                <input
                  required
                  type="text"
                  value={manualAgencyForm.nip}
                  onChange={(event) => updateManualAgencyField('nip', event.target.value)}
                  placeholder="000-00-00-000"
                />
              </label>
              <label>
                Plan
                <select value={manualAgencyForm.plan} onChange={(event) => handleManualPlanChange(event.target.value)}>
                  {planOptions.map((plan) => (
                    <option key={plan.name} value={plan.name}>
                      {plan.name} — {plan.signatureLimit} podpisów / mies.
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Limit podpisów / miesiąc
                <input
                  min={0}
                  required
                  type="number"
                  value={manualAgencyForm.signatureLimit}
                  onChange={(event) => updateManualAgencyField('signatureLimit', Number(event.target.value))}
                />
              </label>
              <button type="submit">Dodaj agencję</button>
            </form>
          </section>
        </div>
      )}

      {editedAgency && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-limit-modal" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
            <button className="auth-close" type="button" aria-label="Zamknij modal" onClick={closeLimitModal}>
              <X />
            </button>
            <div className="offer-context-icon">
              <Activity />
            </div>
            <h2 id="limit-modal-title">Edytuj limity</h2>
            <p>
              Ręcznie ustaw maksymalną liczbę podpisów miesięcznie dla firmy{' '}
              <strong>{editedAgency.name}</strong>.
            </p>
            <form onSubmit={handleLimitSubmit}>
              <label>
                Maksymalna liczba podpisów / miesiąc
                <input
                  min={0}
                  required
                  type="number"
                  value={signatureLimitDraft}
                  onChange={(event) => setSignatureLimitDraft(event.target.value)}
                />
              </label>
              <button type="submit">Zapisz limit</button>
            </form>
          </section>
        </div>
      )}

      {planEditedAgency && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-limit-modal" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">
            <button className="auth-close" type="button" aria-label="Zamknij modal" onClick={closePlanModal}>
              <X />
            </button>
            <div className="offer-context-icon">
              <CreditCard />
            </div>
            <h2 id="plan-modal-title">Zmień plan</h2>
            <p>
              Wybierz nowy plan dla firmy <strong>{planEditedAgency.name}</strong>. Limit podpisów
              zostanie zaktualizowany automatycznie.
            </p>
            <form onSubmit={handlePlanSubmit}>
              <label>
                Plan subskrypcji
                <select value={planDraft} onChange={(event) => setPlanDraft(event.target.value)}>
                  {planOptions.map((plan) => (
                    <option key={plan.name} value={plan.name}>
                      {plan.name} — {plan.signatureLimit} podpisów / mies.
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Zapisz plan</button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
