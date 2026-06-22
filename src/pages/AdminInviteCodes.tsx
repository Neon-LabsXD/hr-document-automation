import { useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, Trash2, X } from 'lucide-react'
import { Header } from '../components/Header'
import { useAppContext } from '../context/AppContext'

const invitePlanOptions = [
  { name: 'Start', label: 'Start (20 podpisów)', signatureLimit: 20 },
  { name: 'Biznes', label: 'Biznes (200 podpisów)', signatureLimit: 200 },
  { name: 'Pro', label: 'Pro (800 podpisów)', signatureLimit: 800 },
]

export function AdminInviteCodes() {
  const { deleteInviteCode, generateInviteCode, inviteCodes } = useAppContext()
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(invitePlanOptions[1].name)
  const [copiedCode, setCopiedCode] = useState('')

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const plan = invitePlanOptions.find((option) => option.name === selectedPlan) ?? invitePlanOptions[1]

    generateInviteCode(plan.name, plan.signatureLimit)
    setGeneratorOpen(false)
  }

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    window.setTimeout(() => setCopiedCode(''), 1800)
  }

  return (
    <>
      <Header
        title="Generator kodów"
        subtitle="Twórz aktywne kody zaproszeń dla nowych agencji rekrutacyjnych."
      />

      <section className="admin-generator-card">
        <div className="page-card-icon">
          <KeyRound />
        </div>
        <div>
          <h2>Nowy kod dostępu</h2>
          <p>Generuj kody z przypisanym planem i śledź, która agencja je wykorzystała.</p>
        </div>
        <button type="button" onClick={() => setGeneratorOpen(true)}>
          Generuj nowy kod
        </button>
      </section>

      <section className="admin-panel-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Plan / limit</th>
              <th>Utworzono</th>
              <th>Status</th>
              <th>Wykorzystany przez</th>
              <th className="action-head">Akcja</th>
            </tr>
          </thead>
          <tbody>
            {inviteCodes.map((inviteCode) => {
              const planName = inviteCode.plan || 'Start'
              const signatureLimit = inviteCode.signatureLimit || 20

              return (
                <tr key={inviteCode.code}>
                  <td>
                    <span className="invite-code-cell">
                      <strong>{inviteCode.code}</strong>
                      <button type="button" aria-label={`Kopiuj kod ${inviteCode.code}`} onClick={() => copyInviteCode(inviteCode.code)}>
                        <Copy />
                      </button>
                    </span>
                  </td>
                  <td>{planName} ({signatureLimit}/mo)</td>
                  <td>{inviteCode.createdAt}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        inviteCode.status === 'aktywny' ? 'status-success' : 'status-neutral'
                      }`}
                    >
                      {inviteCode.status === 'aktywny' ? 'AKTYWNY' : 'WYKORZYSTANY'}
                    </span>
                  </td>
                  <td>{inviteCode.status === 'aktywny' ? '—' : inviteCode.usedBy ?? '—'}</td>
                  <td>
                    <div className="admin-actions-cell">
                      <button
                        className="admin-row-action admin-delete-action"
                        type="button"
                        aria-label={`Usuń kod ${inviteCode.code}`}
                        onClick={() => deleteInviteCode(inviteCode.code)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {generatorOpen && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-limit-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <button
              className="auth-close"
              type="button"
              aria-label="Zamknij modal"
              onClick={() => setGeneratorOpen(false)}
            >
              <X />
            </button>
            <div className="offer-context-icon">
              <KeyRound />
            </div>
            <h2 id="invite-modal-title">Generuj kod zaproszenia</h2>
            <p>Wybierz plan, który zostanie przypisany do nowego kodu invite-only.</p>
            <form onSubmit={handleGenerate}>
              <label>
                Plan
                <select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)}>
                  {invitePlanOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Generuj</button>
            </form>
          </section>
        </div>
      )}

      {copiedCode && (
        <div className="admin-toast">
          <Check />
          Skopiowano kod {copiedCode}
        </div>
      )}
    </>
  )
}
