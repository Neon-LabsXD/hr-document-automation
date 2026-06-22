import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { AuthModal } from '../components/AuthModal'
import { Footer } from '../components/Footer'
import { LandingNav } from '../components/LandingNav'
import type { UserRole } from '../context/AppContext'
import type { AppPage } from '../types'
import { Offer } from './Offer'

interface PublicOfferPageProps {
  onNavigate: (page: AppPage) => void
}

export function PublicOfferPage({ onNavigate }: PublicOfferPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleAuthenticated = (role: UserRole) => {
    onNavigate(role === 'super_admin' ? 'admin-agencies' : 'dashboard')
  }

  return (
    <main className="landing-page public-offer-page">
      <LandingNav activeNav="offer" onNavigate={onNavigate} onAuthOpen={() => setAuthModalOpen(true)} />

      <div className="public-page-shell">
        <button className="public-back-link" type="button" onClick={() => onNavigate('landing')}>
          <ArrowLeft />
          Wróć do strony głównej
        </button>

        <div className="public-page-content">
          <Offer />
        </div>
      </div>

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </main>
  )
}
