import { Mail, Users } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Header } from '../components/Header'
import { useAppContext } from '../context/AppContext'

export function Candidates() {
  const { centralCandidatesList } = useAppContext()

  return (
    <>
      <Header
        title="Kandydaci"
        subtitle="Baza kandydatów połączona z dokumentami i statusem podpisu."
      />

      <section className="page-card">
        <div className="page-card-icon">
          <Users />
        </div>
        <div>
          <h2>Baza kandydatów</h2>
          <p>
            {centralCandidatesList.length === 0
              ? 'Brak aktywnych kandydatów. Karty pojawią się automatycznie po dodaniu rekordów do lejka.'
              : `Wyświetlamy ${centralCandidatesList.length} aktywnych kandydatów powiązanych z dokumentami.`}
          </p>
        </div>
      </section>

      {centralCandidatesList.length === 0 ? (
        <EmptyState
          message="Brak kandydatów do wyświetlenia"
          description="Usunięci kandydaci znikają również z tej listy w czasie rzeczywistym."
        />
      ) : (
        <div className="candidate-grid">
          {centralCandidatesList.map((document) => (
            <article key={document.id} className="candidate-profile-card" id={`kandydat-${document.id}`}>
              <div className="candidate-profile-avatar">{document.initials}</div>
              <div>
                <h3>{document.candidateName}</h3>
                <p>{document.role}</p>
                <span className="candidate-recruiter-tag">Rekruter: {document.recruiter}</span>
                <a href={`mailto:${document.candidateEmail}`}>
                  <Mail />
                  {document.candidateEmail}
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
