import { useEffect } from 'react'
import { FileText } from 'lucide-react'
import { FunnelTable } from '../components/FunnelTable'
import { Header } from '../components/Header'
import { useAppContext } from '../context/AppContext'

export function Documents() {
  const { fetchCandidates, role } = useAppContext()

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

  return (
    <>
      <Header
        title="Dokumenty"
        subtitle="Lista aktywnych umów, szablonów i dokumentów oczekujących na podpis."
      />

      <section className="page-card">
        <div className="page-card-icon">
          <FileText />
        </div>
        <div>
          <h2>Biblioteka dokumentów</h2>
          <p>
            W tym miejscu możesz później dodać szablony umów, filtrowanie po typach dokumentów i
            integrację z Supabase Storage.
          </p>
        </div>
      </section>

      <FunnelTable />
    </>
  )
}
