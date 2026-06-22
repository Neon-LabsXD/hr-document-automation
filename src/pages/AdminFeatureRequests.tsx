import { MoreHorizontal, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { Header } from '../components/Header'
import { useAppContext, type BusinessPriority, type FeatureRequestStatus } from '../context/AppContext'

const priorityClasses: Record<BusinessPriority, string> = {
  'Miło mieć (Fajny dodatek)': 'feature-priority-low',
  'Ważne (Ułatwi codzienne operacje)': 'feature-priority-medium',
  'Krytyczne (Blokuje mój rozwój / Przejście z innego systemu)': 'feature-priority-critical',
}

const priorityLabels: Record<BusinessPriority, string> = {
  'Miło mieć (Fajny dodatek)': 'Miło mieć',
  'Ważne (Ułatwi codzienne operacje)': 'Ważne',
  'Krytyczne (Blokuje mój rozwój / Przejście z innego systemu)': 'Krytyczne',
}

const statusClasses: Record<FeatureRequestStatus, string> = {
  Nowe: 'feature-status-new',
  'W realizacji': 'feature-status-progress',
  Zrobione: 'feature-status-done',
}

export function AdminFeatureRequests() {
  const { featureProposals, updateFeatureProposalStatus } = useAppContext()
  const [openStatusMenuId, setOpenStatusMenuId] = useState<number | null>(null)

  const changeStatus = (proposalId: number, status: FeatureRequestStatus) => {
    updateFeatureProposalStatus(proposalId, status)
    setOpenStatusMenuId(null)
  }

  return (
    <>
      <Header
        title="Sugerowane funkcje"
        subtitle="Zgłoszenia z formularza Zaproponuj funkcję, które pomagają planować roadmapę."
      />

      <section className="page-card">
        <div className="page-card-icon">
          <Lightbulb />
        </div>
        <div>
          <h2>Głos rynku</h2>
          <p>Tu trafiają potrzeby agencji przed zapisaniem ich w docelowej tabeli Supabase.</p>
        </div>
      </section>

      <div className="feature-request-list">
        {featureProposals.map((proposal) => (
          <article key={proposal.id} className="feature-request-card">
            <div>
              <div className="feature-badge-row">
                <span className={priorityClasses[proposal.priority]}>{priorityLabels[proposal.priority]}</span>
                <span className={statusClasses[proposal.status]}>{proposal.status}</span>
              </div>
              <h2>{proposal.featureName}</h2>
              <p>{proposal.description}</p>
            </div>
            <footer>
              <strong>{proposal.agencyName}</strong>
              <a href={`mailto:${proposal.contactEmail}`}>{proposal.contactEmail}</a>
              <em>{proposal.createdAt}</em>
              <div className="feature-status-actions">
                <button
                  type="button"
                  onClick={() =>
                    setOpenStatusMenuId((currentId) => (currentId === proposal.id ? null : proposal.id))
                  }
                >
                  <MoreHorizontal />
                  Zmień status
                </button>

                {openStatusMenuId === proposal.id && (
                  <div className="feature-status-menu">
                    <button type="button" onClick={() => changeStatus(proposal.id, 'W realizacji')}>
                      Oznacz jako W realizacji
                    </button>
                    <button type="button" onClick={() => changeStatus(proposal.id, 'Zrobione')}>
                      Oznacz jako Zrobione
                    </button>
                  </div>
                )}
              </div>
            </footer>
          </article>
        ))}
      </div>
    </>
  )
}
