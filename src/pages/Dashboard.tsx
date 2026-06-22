import { Clock3, FileText, Gauge, TrendingUp } from 'lucide-react'
import { FunnelTable } from '../components/FunnelTable'
import { Header } from '../components/Header'
import { MetricCard } from '../components/UI/MetricCard'
import { useAppContext } from '../context/AppContext'
import {
  getActiveContractsCount,
  getAverageSigningTimeLabel,
  getConversionRate,
  getPendingSignatureCount,
} from '../utils/candidateAnalytics'

export function Dashboard() {
  const { centralCandidatesList } = useAppContext()
  const activeContracts = getActiveContractsCount(centralCandidatesList)
  const pendingCount = getPendingSignatureCount(centralCandidatesList)
  const conversionRate = getConversionRate(centralCandidatesList)
  const averageSigningTime = getAverageSigningTimeLabel(centralCandidatesList)
  const isEmpty = centralCandidatesList.length === 0

  return (
    <>
      <Header
        title="Cześć, Andrii 👋"
        subtitle="Oto, co dziś przypływa przez Twój proces podpisywania."
      />

      <section className={`metrics-grid ${isEmpty ? 'metrics-grid-empty' : ''}`}>
        <MetricCard
          label="Aktywne umowy"
          value={String(activeContracts)}
          description={isEmpty ? 'brak aktywnych umów' : 'wzrost aktywnych umów'}
          delta={isEmpty ? '0%' : '+ 12,4%'}
          icon={FileText}
        />
        <MetricCard
          label="Oczekujące na podpis"
          value={String(pendingCount)}
          description={isEmpty ? 'brak oczekujących dokumentów' : 'wysłano lub OTP'}
          delta={isEmpty ? '0%' : '-8%'}
          icon={Clock3}
        />
        <MetricCard
          label="Współczynnik konwersji"
          value={`${conversionRate}%`}
          description={isEmpty ? 'brak danych do analizy' : 'wysłano vs. podpisano'}
          delta={isEmpty ? '0%' : '+ 4,3%'}
          icon={TrendingUp}
        />
        <MetricCard
          label="Wskaźnik efektywności"
          value={averageSigningTime}
          description={isEmpty ? 'brak podpisanych umów' : 'czas do podpisu'}
          delta={isEmpty ? '0 dni' : '+ 0,6 dnia'}
          icon={Gauge}
        />
      </section>

      {isEmpty ? (
        <section className="dashboard-empty-state">
          <h2>Brak aktywnych kandydatów</h2>
          <p>Lejek dokumentów jest pusty. Wygeneruj link formularza lub dodaj pierwszego kandydata.</p>
        </section>
      ) : (
        <FunnelTable />
      )}
    </>
  )
}
