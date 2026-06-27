import { useEffect } from 'react'
import { Clock3, FileText, Gauge, TrendingUp } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
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
  const { centralCandidatesList, fetchCandidates, role } = useAppContext()

  useEffect(() => {
    if (role === 'guest') {
      return
    }

    void fetchCandidates().catch((error) => {
      console.error('Nie udało się pobrać kandydatów:', error)
    })

    const pollInterval = window.setInterval(() => {
      void fetchCandidates().catch((error) => {
        console.error('Nie udało się odświeżyć kandydatów:', error)
      })
    }, 20_000)

    return () => {
      window.clearInterval(pollInterval)
    }
  }, [fetchCandidates, role])
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
          delta="0%"
          icon={FileText}
        />
        <MetricCard
          label="Oczekujące na podpis"
          value={String(pendingCount)}
          description={isEmpty ? 'brak oczekujących dokumentów' : 'wysłano lub OTP'}
          delta="0%"
          icon={Clock3}
        />
        <MetricCard
          label="Współczynnik konwersji"
          value={`${conversionRate}%`}
          description={isEmpty ? 'brak danych do analizy' : 'wysłano vs. podpisano'}
          delta="0%"
          icon={TrendingUp}
        />
        <MetricCard
          label="Wskaźnik efektywności"
          value={averageSigningTime}
          description={isEmpty ? 'brak podpisanych umów' : 'czas do podpisu'}
          delta={isEmpty ? '0 dni' : averageSigningTime}
          icon={Gauge}
        />
      </section>

      {isEmpty ? (
        <EmptyState
          message="Brak aktywnych kandydatów"
          description="Lejek dokumentów jest pusty. Wygeneruj link formularza lub dodaj pierwszego kandydata."
        />
      ) : (
        <FunnelTable />
      )}
    </>
  )
}
