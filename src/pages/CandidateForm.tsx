import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react'
import { CheckCircle2, FileUp, Loader2, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react'
import type { CandidateFormInput } from '../context/AppContext'
import {
  getCandidateFormPrefill,
  requestCandidateOtp,
  submitCandidateForm,
  verifyCandidateOtp,
} from '../lib/backend'

const initialFormData: CandidateFormInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  pesel: '',
  birthDate: '',
  hourlyRate: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
}

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

type OtpStep = 'idle' | 'requesting' | 'awaiting_code' | 'verifying' | 'submitting'

function maskPhoneNumber(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.length <= 4) {
    return trimmed
  }
  const lastFour = trimmed.slice(-4)
  return `••• ••• ${lastFour}`
}

function buildSubmitErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function CandidateForm() {
  const [formData, setFormData] = useState<CandidateFormInput>(initialFormData)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [ocrFeedback, setOcrFeedback] = useState('')

  const [otpStep, setOtpStep] = useState<OtpStep>('idle')
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array<string>(OTP_LENGTH).fill(''))
  const [otpError, setOtpError] = useState('')
  const [otpInfo, setOtpInfo] = useState('')
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([])
  const verificationTokenRef = useRef<string>('')

  const slug =
    window.location.pathname.split('/f/')[1]?.split('/')[0] ??
    window.location.hash.split('#/f/')[1]?.split('/')[0] ??
    ''

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!slug) {
      return
    }

    let ignore = false

    async function loadPrefill() {
      try {
        const prefill = await getCandidateFormPrefill(slug)

        if (ignore) {
          return
        }

        setFormData((currentData) => ({
          ...currentData,
          firstName: prefill.first_name ?? currentData.firstName,
          lastName: prefill.last_name ?? currentData.lastName,
          email: prefill.email ?? currentData.email,
          phone: prefill.phone ?? currentData.phone,
          pesel: prefill.pesel ?? currentData.pesel,
          birthDate: prefill.birth_date ?? currentData.birthDate,
          hourlyRate: prefill.hourly_rate ?? currentData.hourlyRate,
          street: prefill.street ?? currentData.street,
          houseNumber: prefill.house_number ?? currentData.houseNumber,
          postalCode: prefill.postal_code ?? currentData.postalCode,
          city: prefill.city ?? currentData.city,
        }))
      } catch {
        // Public form may not have saved data yet — candidate fills manually.
      }
    }

    void loadPrefill()

    return () => {
      ignore = true
    }
  }, [slug])

  const isOtpModalOpen =
    otpStep === 'requesting' ||
    otpStep === 'awaiting_code' ||
    otpStep === 'verifying' ||
    otpStep === 'submitting'

  useEffect(() => {
    if (!isOtpModalOpen) {
      return
    }

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOtpModalOpen])

  useEffect(() => {
    if (otpStep !== 'awaiting_code') {
      return
    }

    if (resendSecondsLeft <= 0) {
      return
    }

    const timerId = window.setInterval(() => {
      setResendSecondsLeft((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [otpStep, resendSecondsLeft])

  useEffect(() => {
    if (otpStep === 'awaiting_code') {
      const firstEmptyIndex = otpDigits.findIndex((digit) => digit === '')
      const targetIndex = firstEmptyIndex === -1 ? OTP_LENGTH - 1 : firstEmptyIndex
      otpInputsRef.current[targetIndex]?.focus()
    }
  }, [otpStep, otpDigits])

  const otpCode = useMemo(() => otpDigits.join(''), [otpDigits])
  const isOtpComplete = otpCode.length === OTP_LENGTH && /^\d+$/.test(otpCode)

  const updateField = (field: keyof CandidateFormInput, value: string) => {
    setFormData((currentData) => ({ ...currentData, [field]: value }))
  }

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    setUploadedFiles((currentFiles) => [...currentFiles, ...files])
    event.target.value = ''
    setOcrFeedback('Plik został dodany. Uzupełnij dane ręcznie w formularzu.')
  }

  const requestNewOtp = useCallback(async (): Promise<boolean> => {
    setOtpError('')
    setOtpInfo('')
    try {
      await requestCandidateOtp(slug, formData.phone.trim())
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS)
      setOtpInfo('Kod weryfikacyjny został wysłany SMS-em.')
      return true
    } catch (error) {
      setOtpError(
        buildSubmitErrorMessage(error, 'Nie udało się wysłać kodu SMS. Spróbuj ponownie.'),
      )
      return false
    }
  }, [formData.phone, slug])

  const handleStartOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError('')

    const parsedHourlyRate = Number.parseFloat(formData.hourlyRate.replace(',', '.'))
    if (!Number.isFinite(parsedHourlyRate) || parsedHourlyRate <= 0) {
      setSubmitError('Podaj prawidłową stawkę godzinową (np. 28.10).')
      return
    }

    setOtpStep('requesting')
    setOtpDigits(Array<string>(OTP_LENGTH).fill(''))
    verificationTokenRef.current = ''

    const sent = await requestNewOtp()

    if (!sent) {
      setOtpStep('idle')
      return
    }

    setOtpStep('awaiting_code')
  }

  const handleCloseOtpModal = () => {
    if (otpStep === 'verifying' || otpStep === 'submitting') {
      return
    }
    setOtpStep('idle')
    setOtpError('')
    setOtpInfo('')
    setOtpDigits(Array<string>(OTP_LENGTH).fill(''))
  }

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0 || otpStep !== 'awaiting_code') {
      return
    }
    setOtpDigits(Array<string>(OTP_LENGTH).fill(''))
    await requestNewOtp()
  }

  const applyOtpDigit = (index: number, rawValue: string) => {
    if (rawValue === '') {
      setOtpDigits((digits) => {
        const next = [...digits]
        next[index] = ''
        return next
      })
      return
    }

    const sanitized = rawValue.replace(/\D/g, '')
    if (!sanitized) {
      return
    }

    setOtpError('')

    setOtpDigits((digits) => {
      const next = [...digits]
      const chars = sanitized.split('')
      for (let cursor = 0; cursor < chars.length && index + cursor < OTP_LENGTH; cursor += 1) {
        next[index + cursor] = chars[cursor]
      }
      return next
    })

    const nextIndex = Math.min(index + sanitized.length, OTP_LENGTH - 1)
    otpInputsRef.current[nextIndex]?.focus()
  }

  const handleOtpInputChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    applyOtpDigit(index, event.target.value)
  }

  const handleOtpKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (otpDigits[index]) {
        setOtpDigits((digits) => {
          const next = [...digits]
          next[index] = ''
          return next
        })
        return
      }
      if (index > 0) {
        otpInputsRef.current[index - 1]?.focus()
        setOtpDigits((digits) => {
          const next = [...digits]
          next[index - 1] = ''
          return next
        })
      }
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
      return
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) {
      return
    }
    event.preventDefault()
    applyOtpDigit(0, pasted.slice(0, OTP_LENGTH))
  }

  const finalSubmit = useCallback(
    async (verificationToken: string) => {
      const parsedHourlyRate = Number.parseFloat(formData.hourlyRate.replace(',', '.'))

      try {
        await submitCandidateForm(
          slug,
          {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            pesel: formData.pesel.trim(),
            birth_date: formData.birthDate,
            hourly_rate: parsedHourlyRate,
            street: formData.street.trim(),
            house_number: formData.houseNumber.trim(),
            postal_code: formData.postalCode.trim(),
            city: formData.city.trim(),
            verification_token: verificationToken,
          },
          uploadedFiles[0],
        )
        setSubmitted(true)
        setOtpStep('idle')
      } catch (error) {
        const message = buildSubmitErrorMessage(
          error,
          'Nie udało się wysłać formularza. Spróbuj ponownie.',
        )
        setOtpError(message)
        setSubmitError(message)
        setOtpStep('awaiting_code')
      }
    },
    [formData, slug, uploadedFiles],
  )

  const handleVerifyOtp = async () => {
    if (!isOtpComplete || otpStep === 'verifying' || otpStep === 'submitting') {
      return
    }

    setOtpStep('verifying')
    setOtpError('')

    try {
      const { verification_token } = await verifyCandidateOtp(slug, otpCode)
      verificationTokenRef.current = verification_token
      setOtpInfo('Numer telefonu został potwierdzony. Wysyłamy dane do agencji...')
      setOtpStep('submitting')
      await finalSubmit(verification_token)
    } catch (error) {
      setOtpError(
        buildSubmitErrorMessage(error, 'Nieprawidłowy kod weryfikacyjny.'),
      )
      setOtpDigits(Array<string>(OTP_LENGTH).fill(''))
      setOtpStep('awaiting_code')
      otpInputsRef.current[0]?.focus()
    }
  }

  useEffect(() => {
    if (otpStep === 'awaiting_code' && isOtpComplete) {
      handleVerifyOtp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtpComplete, otpStep])

  const formTitle = 'Formularz danych do umowy'
  const maskedPhone = maskPhoneNumber(formData.phone)
  const isResendDisabled = resendSecondsLeft > 0 || otpStep !== 'awaiting_code'
  const isSubmitBusy = otpStep === 'requesting' || otpStep === 'submitting'

  if (submitted) {
    return (
      <main className="candidate-form-page candidate-form-success-page">
        <section className="candidate-form-success">
          <div className="candidate-form-success-icon">
            <CheckCircle2 />
          </div>
          <h1>Dziękujemy! Twoje dane zostały bezpiecznie przekazane.</h1>
          <p>
            Oczekuj na wiadomość SMS / E-mail z linkiem do cyfrowego podpisania umowy. Może to zająć
            kilka minut.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="candidate-form-page">
      <header className="candidate-form-header">
        <div className="candidate-form-brand">
          <span>
            <Sparkles />
          </span>
          <div>
            <strong>Aether Flow</strong>
            <small>TalentBridge Sp. z o.o.</small>
          </div>
        </div>
        <p className="candidate-form-kicker">Formularz rekrutacyjny</p>
        <h1>Uzupełnij dane do umowy</h1>
        <span className="candidate-form-template">{formTitle}</span>
      </header>

      <form className="candidate-form-shell" onSubmit={handleStartOtp}>
        <section className="candidate-form-section">
          <h2>Dane osobowe</h2>
          <div className="candidate-form-grid">
            <label>
              <span>Imię</span>
              <input required value={formData.firstName} onChange={(event) => updateField('firstName', event.target.value)} />
            </label>
            <label>
              <span>Nazwisko</span>
              <input required value={formData.lastName} onChange={(event) => updateField('lastName', event.target.value)} />
            </label>
            <label>
              <span>E-mail</span>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </label>
            <label>
              <span>Telefon</span>
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </label>
            <label>
              <span>PESEL</span>
              <input
                required
                inputMode="numeric"
                pattern="\d{11}"
                maxLength={11}
                value={formData.pesel}
                onChange={(event) => updateField('pesel', event.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label>
              <span>Data urodzenia</span>
              <input
                required
                type="date"
                value={formData.birthDate}
                onChange={(event) => updateField('birthDate', event.target.value)}
              />
            </label>
            <label className="candidate-form-span-2">
              <span>Stawka godzinowa (zł)</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="np. 28.10"
                value={formData.hourlyRate}
                onChange={(event) => updateField('hourlyRate', event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="candidate-form-section">
          <h2>Adres zamieszkania</h2>
          <div className="candidate-form-grid">
            <label className="candidate-form-span-2">
              <span>Ulica</span>
              <input required value={formData.street} onChange={(event) => updateField('street', event.target.value)} />
            </label>
            <label>
              <span>Numer domu</span>
              <input
                required
                value={formData.houseNumber}
                onChange={(event) => updateField('houseNumber', event.target.value)}
              />
            </label>
            <label>
              <span>Kod pocztowy</span>
              <input
                required
                value={formData.postalCode}
                onChange={(event) => updateField('postalCode', event.target.value)}
              />
            </label>
            <label className="candidate-form-span-2">
              <span>Miejscowość</span>
              <input required value={formData.city} onChange={(event) => updateField('city', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="candidate-form-section">
          <h2>Załączniki</h2>
          <button
            className="candidate-upload-zone"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud />
            <strong>Przeciągnij lub wybierz pliki</strong>
            <span>Oświadczenie, dowód osobisty, legitymacja itp.</span>
            <small>Obsługiwane formaty: .docx, .pdf, .jpg, .png</small>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.jpg,.jpeg,.png,image/*,application/pdf"
              multiple
              hidden
              onChange={handleFilesSelected}
            />
          </button>

          {uploadedFiles.length > 0 && (
            <ul className="candidate-upload-list">
              {uploadedFiles.map((file) => (
                <li key={`${file.name}-${file.lastModified}`}>
                  <FileUp />
                  {file.name}
                </li>
              ))}
            </ul>
          )}
          {ocrFeedback && <p className="create-invite-feedback">{ocrFeedback}</p>}
        </section>

        {submitError && <p className="auth-error">{submitError}</p>}

        <button className="candidate-form-submit" type="submit" disabled={isSubmitBusy}>
          {otpStep === 'requesting'
            ? 'Wysyłanie kodu SMS...'
            : otpStep === 'submitting'
              ? 'Wysyłanie danych...'
              : 'Wyślij dane do agencji'}
        </button>
      </form>

      {isOtpModalOpen && (
        <div
          className="candidate-otp-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-otp-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseOtpModal()
            }
          }}
        >
          <div className="candidate-otp-modal">
            <button
              type="button"
              className="candidate-otp-close"
              onClick={handleCloseOtpModal}
              disabled={otpStep === 'verifying' || otpStep === 'submitting'}
              aria-label="Zamknij okno weryfikacji"
            >
              <X />
            </button>

            <div className="candidate-otp-icon">
              <ShieldCheck />
            </div>

            <h2 id="candidate-otp-title">Potwierdź numer telefonu</h2>
            <p className="candidate-otp-description">
              Wysłaliśmy 6-cyfrowy kod weryfikacyjny SMS-em na numer{' '}
              <strong>{maskedPhone}</strong>. Wpisz go poniżej, aby dokończyć wysyłanie danych.
            </p>

            <div
              className="candidate-otp-inputs"
              onPaste={handleOtpPaste}
              aria-label="Kod weryfikacyjny"
            >
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpInputsRef.current[index] = element
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  disabled={otpStep === 'verifying' || otpStep === 'submitting'}
                  onChange={handleOtpInputChange(index)}
                  onKeyDown={handleOtpKeyDown(index)}
                  aria-label={`Cyfra ${index + 1} z ${OTP_LENGTH}`}
                />
              ))}
            </div>

            {otpError && <p className="candidate-otp-error">{otpError}</p>}
            {!otpError && otpInfo && <p className="candidate-otp-info">{otpInfo}</p>}

            <div className="candidate-otp-actions">
              <button
                type="button"
                className="candidate-otp-resend"
                onClick={handleResendOtp}
                disabled={isResendDisabled}
              >
                {resendSecondsLeft > 0
                  ? `Wyślij ponownie za ${resendSecondsLeft}s`
                  : 'Wyślij ponownie'}
              </button>

              <button
                type="button"
                className="candidate-otp-confirm"
                onClick={handleVerifyOtp}
                disabled={
                  !isOtpComplete || otpStep === 'verifying' || otpStep === 'submitting'
                }
              >
                {otpStep === 'verifying' || otpStep === 'submitting' ? (
                  <>
                    <Loader2 className="candidate-otp-spinner" />
                    {otpStep === 'submitting' ? 'Wysyłanie danych...' : 'Weryfikacja...'}
                  </>
                ) : (
                  'Potwierdź kod'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
