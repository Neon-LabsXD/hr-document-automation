import { Menu, Sparkles } from 'lucide-react'
import type { AppPage } from '../types'

interface LandingNavProps {
  onNavigate?: (page: AppPage) => void
  onAuthOpen: () => void
  activeNav?: 'offer'
}

export function LandingNav({ onNavigate, onAuthOpen, activeNav }: LandingNavProps) {
  const goToLandingSection = (hash: string) => {
    onNavigate?.('landing')
    window.requestAnimationFrame(() => {
      window.location.hash = hash
    })
  }

  return (
    <nav className="landing-nav" aria-label="Główna nawigacja">
      <button className="landing-brand landing-brand-button" type="button" onClick={() => onNavigate?.('landing')}>
        <span>
          <Sparkles />
        </span>
        Aether Flow
      </button>
      <div className="nav-links">
        <button type="button" onClick={() => goToLandingSection('#problem')}>
          Problem
        </button>
        <button type="button" onClick={() => goToLandingSection('#demo')}>
          Proces
        </button>
        <button type="button" onClick={() => goToLandingSection('#bezpieczenstwo')}>
          Bezpieczeństwo
        </button>
        <button type="button" onClick={() => goToLandingSection('#cennik')}>
          Cennik
        </button>
        <button type="button" onClick={() => goToLandingSection('#faq')}>
          FAQ
        </button>
        <button
          type="button"
          className={activeNav === 'offer' ? 'nav-link-active' : ''}
          onClick={() => onNavigate?.('offer')}
        >
          Zaproponuj funkcję
        </button>
      </div>
      <button className="nav-cta" type="button" onClick={onAuthOpen}>
        Zaloguj się
      </button>
      <button className="mobile-menu" type="button" aria-label="Otwórz menu">
        <Menu />
      </button>
    </nav>
  )
}
