import { FileText } from 'lucide-react'
import { FunnelTable } from '../components/FunnelTable'
import { Header } from '../components/Header'

export function Documents() {
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
