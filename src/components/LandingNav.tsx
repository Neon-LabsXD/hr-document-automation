import { useEffect, useState } from 'react'
import { Menu, Sparkles, X } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import type { AppPage } from '../types'

interface LandingNavProps {
  onNavigate?: (page: AppPage) => void
  onAuthOpen: () => void
  activeNav?: 'offer'
}

export function LandingNav({ onNavigate, onAuthOpen, activeNav }: LandingNavProps) {
  const { isAuthenticated, role } = useAppContext()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const goToDashboard = () => {
    closeMenu()
    onNavigate?.(role === 'super_admin' ? 'admin-agencies' : 'dashboard')
  }

  const goToLandingSection = (hash: string) => {
    closeMenu()
    onNavigate?.('landing')
    window.requestAnimationFrame(() => {
      window.location.hash = hash
    })
  }

  const goToOffer = () => {
    closeMenu()
    onNavigate?.('offer')
  }

  const handleAuthClick = () => {
    closeMenu()
    if (isAuthenticated) {
      goToDashboard()
      return
    }
    onAuthOpen()
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    document.body.style.overflow = 'hidden'

    const closeMenuOnResize = () => {
      if (window.innerWidth > 980) {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('resize', closeMenuOnResize)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('resize', closeMenuOnResize)
    }
  }, [isMenuOpen])

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
          onClick={goToOffer}
        >
          Zaproponuj funkcję
        </button>
      </div>

      <button className="nav-cta" type="button" onClick={handleAuthClick}>
        {isAuthenticated ? 'Przejdź do pulpitu' : 'Zaloguj się'}
      </button>

      <button
        className="mobile-menu"
        type="button"
        aria-label={isMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
        aria-expanded={isMenuOpen}
        aria-controls="landing-mobile-menu"
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        {isMenuOpen ? <X /> : <Menu />}
      </button>

      {isMenuOpen && (
        <button
          className="landing-mobile-menu-backdrop"
          type="button"
          aria-label="Zamknij menu"
          onClick={closeMenu}
        />
      )}

      <div
        id="landing-mobile-menu"
        className={`landing-mobile-menu ${isMenuOpen ? 'landing-mobile-menu-open' : ''}`}
      >
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
          onClick={goToOffer}
        >
          Zaproponuj funkcję
        </button>
        <button className="landing-mobile-menu-cta" type="button" onClick={handleAuthClick}>
          {isAuthenticated ? 'Przejdź do pulpitu' : 'Zaloguj się'}
        </button>
      </div>
    </nav>
  )
}
