import { useMemo } from 'react'
import { BarChart3, Clock3, TrendingUp, Users } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Header } from '../components/Header'
import { useAppContext } from '../context/AppContext'
import {
  getAverageSigningTimeLabel,
  getFunnelMetrics,
  getRecruiterMetrics,
  getSlaDistribution,
} from '../utils/candidateAnalytics'

export function Stats() {
  const { centralCandidatesList } = useAppContext()

  const funnelMetrics = useMemo(() => getFunnelMetrics(centralCandidatesList), [centralCandidatesList])
  const slaDistribution = useMemo(() => getSlaDistribution(centralCandidatesList), [centralCandidatesList])
  const recruiterRows = useMemo(() => getRecruiterMetrics(centralCandidatesList), [centralCandidatesList])
  const averageSigningTime = useMemo(
    () => getAverageSigningTimeLabel(centralCandidatesList),
    [centralCandidatesList],
  )

  return (
    <>
      <Header
        title="Statystyki"
        subtitle="Przegląd konwersji dokumentów, czasu podpisu i aktywności kandydatów."
      />

      <section className="page-card">
        <div className="page-card-icon">
          <BarChart3 />
        </div>
        <div>
          <h2>Analityka procesu</h2>
          <p>
            {centralCandidatesList.length === 0
              ? 'Brak kandydatów w bazie. Wykresy zaktualizują się automatycznie po dodaniu pierwszych rekordów.'
              : `Analiza oparta na ${centralCandidatesList.length} aktywnych kandydatach w bieżącym lejku.`}
          </p>
        </div>
      </section>

      <section className="analytics-grid">
        <article className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <span className="analytics-kicker">Lejek dokumentów</span>
              <h2>Konwersja lejka umów</h2>
            </div>
            <div className="analytics-icon">
              <TrendingUp />
            </div>
          </div>

          <div className="conversion-list">
            {funnelMetrics.map((metric) => (
              <div className="conversion-row" key={metric.label}>
                <div className="conversion-label">
                  <span>{metric.label}</span>
                  <strong>{metric.value}%</strong>
                </div>
                <div className="conversion-track">
                  <span
                    className={`conversion-fill conversion-fill-${metric.tone}`}
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-card analytics-card-dark">
          <div className="analytics-card-header">
            <div>
              <span className="analytics-kicker">SLA podpisu</span>
              <h2>Średni czas do podpisu (SLA)</h2>
            </div>
            <div className="analytics-icon">
              <Clock3 />
            </div>
          </div>

          <div className="sla-hero">
            <strong>{averageSigningTime}</strong>
            <span>średnio od wysyłki dokumentu do finalnego podpisu</span>
          </div>

          <div className="sla-distribution">
            {slaDistribution.map((item) => (
              <div className="sla-bar-row" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}%</strong>
                </div>
                <div className="sla-track">
                  <span style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="analytics-leaderboard">
        <div className="panel-header">
          <div>
            <h2>Efektywność zespołu rekruterów</h2>
            <p>Ranking aktywności i skuteczności podpisów w bieżącym miesiącu.</p>
          </div>
          <div className="analytics-icon analytics-icon-soft">
            <Users />
          </div>
        </div>

        <table className="analytics-table">
          <thead>
            <tr>
              <th>Rekruter</th>
              <th>Wysłane umowy</th>
              <th>Podpisane</th>
              <th>Skuteczność</th>
              <th>Średni czas</th>
            </tr>
          </thead>
          <tbody>
            {recruiterRows.length === 0 ? (
              <EmptyState
                variant="table"
                colSpan={5}
                message="Brak danych o rekruterach"
                description="Tabela zaktualizuje się po dodaniu rekordów do lejka."
              />
            ) : (
              recruiterRows.map((recruiter) => (
                <tr key={recruiter.name}>
                  <td>
                    <div className="recruiter-cell">
                      <span className="recruiter-avatar">{recruiter.initials}</span>
                      <strong>{recruiter.name}</strong>
                    </div>
                  </td>
                  <td>{recruiter.sent} umów</td>
                  <td>{recruiter.signed} podpisanych</td>
                  <td>
                    <span className="effectiveness-pill">{recruiter.success}%</span>
                  </td>
                  <td>{recruiter.averageTime}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
