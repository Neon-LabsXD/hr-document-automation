import { useState, type FormEvent } from 'react'
import { LockKeyhole, X } from 'lucide-react'
import { useAppContext, type UserRole } from '../context/AppContext'
import { RegulaminContent } from './RegulaminContent'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthenticated: (role: UserRole) => void
}

type AuthMode = 'login' | 'register'

export function AuthModal({ isOpen, onClose, onAuthenticated }: AuthModalProps) {
  const { login, registerAgency } = useAppContext()
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  if (!isOpen) {
    return null
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await login(loginEmail, loginPassword)

    setIsSubmitting(false)

    if (result.ok && result.role) {
      onAuthenticated(result.role)
      onClose()
      return
    }

    setError(result.error ?? 'Nie udało się zalogować. Sprawdź email i hasło.')
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!acceptedTerms) {
      setError('Aby założyć konto, musisz zaakceptować Regulamin platformy.')
      return
    }

    setIsSubmitting(true)

    const result = await registerAgency(agencyName, fullName, registerEmail, registerPassword, inviteCode)

    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error ?? 'Nie udało się zarejestrować agencji.')
      return
    }

    if (result.role) {
      onAuthenticated(result.role)
      onClose()
    }
  }

  const switchToRegister = () => {
    setMode('register')
    setError('')
  }

  const switchToLogin = () => {
    setMode('login')
    setError('')
  }

  return (
    <div className="auth-backdrop" role="presentation">
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" aria-label="Zamknij modal" onClick={onClose}>
          <X />
        </button>

        <div className="auth-heading">
          <div>
            <LockKeyhole />
          </div>
          <p className="eyebrow">Invite-only access</p>
          <h2 id="auth-title">{mode === 'login' ? 'Logowanie' : 'Rejestracja agencji'}</h2>
          <span>
            {mode === 'login'
              ? 'Dostęp do Aether Flow mają wyłącznie zaproszone agencje.'
              : 'Wpisz kod zaproszenia otrzymany od administratora systemu.'}
          </span>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'auth-tab-active' : ''} type="button" onClick={switchToLogin}>
            Logowanie
          </button>
          <button
            className={mode === 'register' ? 'auth-tab-active' : ''}
            type="button"
            onClick={switchToRegister}
          >
            Rejestracja
          </button>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              E-mail
              <input
                required
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="aetherflowbiznes@gmail.com"
              />
            </label>
            <label>
              Hasło
              <input
                required
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="••••••••"
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logowanie...' : 'Zaloguj się'}
            </button>
            <button className="auth-switch-link" type="button" onClick={switchToRegister}>
              Masz kod zaproszenia? Zarejestruj agencję
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegister}>
            <label>
              Nazwa agencji
              <input
                required
                type="text"
                value={agencyName}
                onChange={(event) => setAgencyName(event.target.value)}
                placeholder="TalentBridge Sp. z o.o."
              />
            </label>
            <label>
              Imię i nazwisko administratora
              <input
                required
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Andrii Matyniuk"
              />
            </label>
            <label>
              E-mail
              <input
                required
                type="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="kontakt@agencja.pl"
              />
            </label>
            <label>
              Hasło
              <input
                required
                type="password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder="••••••••"
              />
            </label>
            <label>
              Kod zaproszenia
              <input
                required
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="Wpisz kod zaproszenia"
              />
            </label>
            <label className="auth-consent">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Oświadczam, że zawieram umowę jako przedsiębiorca (B2B) oraz akceptuję{' '}
                <button type="button" className="auth-consent-link" onClick={() => setShowTerms(true)}>
                  Regulamin platformy
                </button>
                .
              </span>
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" disabled={isSubmitting || !acceptedTerms}>
              {isSubmitting ? 'Rejestracja...' : 'Zarejestruj agencję'}
            </button>
          </form>
        )}

        {showTerms && (
          <div className="auth-terms-overlay" role="dialog" aria-modal="true" aria-label="Regulamin platformy">
            <div className="auth-terms-bar">
              <strong>Regulamin platformy</strong>
              <button type="button" aria-label="Zamknij regulamin" onClick={() => setShowTerms(false)}>
                <X />
              </button>
            </div>
            <div className="auth-terms-scroll">
              <RegulaminContent />
            </div>
            <button
              type="button"
              className="auth-terms-accept"
              onClick={() => {
                setAcceptedTerms(true)
                setShowTerms(false)
              }}
            >
              Akceptuję Regulamin
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
