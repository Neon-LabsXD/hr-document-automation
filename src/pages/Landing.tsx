import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  LockKeyhole,
  MailCheck,
  MapPin,
  Send,
  ShieldCheck,
  TimerReset,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { AuthModal } from '../components/AuthModal'
import { FAQSection } from '../components/FAQSection'
import { Footer } from '../components/Footer'
import { LandingNav } from '../components/LandingNav'
import type { UserRole } from '../context/AppContext'
import type { AppPage } from '../types'

interface FunnelStep {
  label: string
  status: string
  description: string
  icon: LucideIcon
}

interface PainPoint {
  problem: string
  solution: string
  icon: LucideIcon
}

interface SecurityFeature {
  title: string
  description: string
  icon: LucideIcon
}

interface PricingPlan {
  name: string
  limit: string
  price: string
  oldPrice?: string
  priceNote?: string
  description: string
  highlighted?: boolean
  features: string[]
}

interface LandingProps {
  onNavigate?: (page: AppPage) => void
}

const funnelSteps: FunnelStep[] = [
  {
    label: 'Wysłano',
    status: 'SENT',
    description: 'Dokument trafia do kandydata natychmiast po wygenerowaniu.',
    icon: Send,
  },
  {
    label: 'Otwarto',
    status: 'OPENED',
    description: 'Widzisz, czy kandydat faktycznie otworzył umowę.',
    icon: MailCheck,
  },
  {
    label: 'Zweryfikowano OTP',
    status: 'OTP_VERIFIED',
    description: 'Tożsamość potwierdzona jednorazowym kodem.',
    icon: ShieldCheck,
  },
  {
    label: 'Podpisano',
    status: 'SIGNED',
    description: 'Podpis prawnie wiążący zapisany razem ze ścieżką audytu.',
    icon: CheckCircle2,
  },
]

const painPoints: PainPoint[] = [
  {
    problem: 'Kandydaci znikają po wysłaniu dokumentów.',
    solution: 'Lejek statusów pokazuje dokładnie, kto otworzył umowę, a kto wymaga przypomnienia.',
    icon: Users,
  },
  {
    problem: 'Ręczna kontrola przez pocztę zabiera godziny.',
    solution: 'Jedno okno do wysyłki, śledzenia, OTP i podpisu dla całego zespołu agencji.',
    icon: TimerReset,
  },
  {
    problem: 'Dane osobowe krążą w mailach i załącznikach.',
    solution: 'Izolowana przestrzeń multi-tenant dla każdej agencji ogranicza ryzyko pomyłek i wycieku.',
    icon: LockKeyhole,
  },
]

const securityFeatures: SecurityFeature[] = [
  {
    title: 'Dane przechowywane w UE',
    description: 'Kontrakty i ścieżki audytu trzymane są na europejskiej infrastrukturze, z naciskiem na lokalizację w Polsce.',
    icon: MapPin,
  },
  {
    title: 'OTP przez FastAPI + Gmail SMTP',
    description: 'Jednorazowe kody ograniczają ryzyko podpisu przez niewłaściwą osobę i wzmacniają proces weryfikacji.',
    icon: MailCheck,
  },
  {
    title: 'Supabase RLS',
    description: 'Izolacja danych na poziomie bazy sprawia, że żadna agencja nie ma dostępu do cudzych kandydatów i kontraktów.',
    icon: DatabaseZap,
  },
]

const pricingPlans: PricingPlan[] = [
  {
    name: 'Start (Testowy)',
    limit: 'do 20 podpisów / miesiąc',
    price: '0 PLN',
    description: 'Dla agencji, które chcą bez ryzyka przetestować pierwszy proces podpisu.',
    features: ['Panel statusów dokumentów', 'Weryfikacja OTP', 'Podstawowa historia audytu'],
  },
  {
    name: 'Biznes',
    limit: 'do 200 podpisów / miesiąc',
    price: '199 PLN',
    oldPrice: '399 PLN',
    priceNote: '*Cena gwarantowana na zawsze dla pierwszych klientów',
    description: 'Najlepszy wybór dla zespołów rekrutacyjnych z codziennym obiegiem dokumentów.',
    highlighted: true,
    features: ['Multi-tenancy dla agencji', 'Automatyczne przypomnienia', 'Priorytetowe wsparcie'],
  },
  {
    name: 'Pro',
    limit: 'do 800 podpisów / miesiąc',
    price: '499 PLN',
    oldPrice: '899 PLN',
    description: 'Dla większych agencji i zespołów, które potrzebują pełnej kontroli nad skalą.',
    features: ['Limit 800 podpisów', 'Dedykowane środowisko', 'Zaawansowane SLA'],
  },
]

export function Landing({ onNavigate }: LandingProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleAuthenticated = (role: UserRole) => {
    onNavigate?.(role === 'super_admin' ? 'admin-agencies' : 'dashboard')
  }

  return (
    <main className="landing-page">
      <LandingNav onNavigate={onNavigate} onAuthOpen={() => setAuthModalOpen(true)} />

      <section id="hero" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">HR documents automation for Polish recruitment agencies</p>
          <h1>Automatyzacja dokumentów HR i bezpieczny e-podpis dla agencji rekrutacyjnych.</h1>
          <p className="hero-lead">
            Pozbądź się rutyny. Wysyłaj umowy kandydatom w 3 kliknięcia, śledź status w czasie
            rzeczywistym i otrzymuj prawnie wiążący podpis w minuty, a nie dni.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => setAuthModalOpen(true)}>
              Zaloguj się
              <ArrowRight />
            </button>
            <a className="secondary-button" href="#demo">
              Zobacz proces podpisu
            </a>
          </div>
          <div className="trust-row" aria-label="Najważniejsze zalety">
            <span>Multi-tenancy</span>
            <span>OTP</span>
            <span>Supabase RLS</span>
            <span>EU data residency</span>
          </div>
        </div>

        <div className="hero-product-card" aria-label="Podgląd produktu">
          <div className="product-window-top">
            <span />
            <span />
            <span />
          </div>
          <div className="product-header">
            <div>
              <small>TalentBridge Sp. z o.o.</small>
              <strong>Lejek dokumentów</strong>
            </div>
            <span className="live-badge">Live</span>
          </div>
          {funnelSteps.map((step, index) => {
            const Icon = step.icon

            return (
              <div key={step.status} className="product-step" style={{ animationDelay: `${index * 180}ms` }}>
                <div className="product-step-icon">
                  <Icon />
                </div>
                <div>
                  <strong>{step.label}</strong>
                  <span>{step.status}</span>
                </div>
                <CheckCircle2 className="product-check" />
              </div>
            )
          })}
        </div>
      </section>

      <section id="problem" className="problem-section">
        <div className="section-heading">
          <p className="eyebrow">Problem {'->'} rozwiązanie</p>
          <h2>Klasyczne blokady agencji rekrutacyjnych w Polsce, zamknięte w jednym bezpiecznym oknie.</h2>
        </div>
        <div className="pain-grid">
          {painPoints.map((item) => {
            const Icon = item.icon

            return (
              <article key={item.problem} className="pain-card">
                <Icon />
                <h3>{item.problem}</h3>
                <p>{item.solution}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="demo" className="demo-section">
        <div className="demo-copy">
          <p className="eyebrow">Interaktywna demonstracja</p>
          <h2>Od wysłania dokumentu do podpisu, bez zgadywania i ręcznych follow-upów.</h2>
          <p>Zawsze wiesz, dlaczego kandydat Kowalski jeszcze nie podpisał umowy.</p>
        </div>
        <div className="funnel-demo">
          {funnelSteps.map((step, index) => {
            const Icon = step.icon

            return (
              <div key={step.status} className="funnel-node">
                {index > 0 && <span className="funnel-line" />}
                <div className="node-circle">
                  <Icon />
                </div>
                <strong>{step.label}</strong>
                <span>{step.status}</span>
                <p>{step.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section id="bezpieczenstwo" className="security-section">
        <div className="section-heading">
          <p className="eyebrow">Compliance ready</p>
          <h2>Bezpieczeństwo i infrastruktura, które możesz pokazać klientowi enterprise.</h2>
        </div>
        <div className="security-grid">
          {securityFeatures.map((feature) => {
            const Icon = feature.icon

            return (
              <article key={feature.title} className="security-card">
                <div>
                  <Icon />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="cennik" className="pricing-section">
        <div className="section-heading">
          <p className="eyebrow">Cennik</p>
          <h2>Prosta subskrypcja dopasowana do wolumenu podpisów.</h2>
        </div>
        <div className="pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className={`pricing-card ${plan.highlighted ? 'pricing-card-featured' : ''}`}>
              {plan.highlighted && <span className="plan-badge">Najczęściej wybierany</span>}
              <h3>{plan.name}</h3>
              <p>{plan.limit}</p>
              <div className="flex flex-col gap-1">
                {plan.oldPrice && (
                  <span className="text-sm font-semibold text-gray-400/50 line-through">{plan.oldPrice}</span>
                )}
                <strong>{plan.price}</strong>
                {plan.priceNote && <span className="text-xs text-gray-400">{plan.priceNote}</span>}
              </div>
              <span className="plan-description">{plan.description}</span>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle2 />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="#rejestracja">{plan.highlighted ? 'Uruchom Biznes' : 'Wybierz plan'}</a>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">* Ceny netto (bez VAT)</p>
      </section>

      <FAQSection />

      <section id="rejestracja" className="signup-section">
        <div>
          <p className="eyebrow">Dostęp invite-only</p>
          <h2>Platforma jest dostępna wyłącznie dla zaproszonych agencji.</h2>
          <p>
            Jeśli posiadasz kod zaproszenia, otwórz panel logowania i przejdź do rejestracji
            agencji. Kod testowy dla środowiska developerskiego: AETHER2026.
          </p>
        </div>
        <div className="signup-form invite-only-card">
          <strong>Zamknięty dostęp B2B</strong>
          <span>Logowanie dla klientów i panel właściciela znajdują się w jednym bezpiecznym oknie.</span>
          <button type="button" onClick={() => setAuthModalOpen(true)}>
            Zaloguj się / zarejestruj agencję
            <ArrowRight />
          </button>
        </div>
      </section>

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </main>
  )
}
