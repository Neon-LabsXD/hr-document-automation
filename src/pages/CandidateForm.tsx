import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckCircle2, FileUp, Sparkles, UploadCloud } from 'lucide-react'
import { useAppContext, type CandidateFormInput } from '../context/AppContext'
import { scanPassport } from '../lib/backend'

const initialFormData: CandidateFormInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  pesel: '',
  birthDate: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
}

export function CandidateForm() {
  const { activeFormLink, submitCandidateForm } = useAppContext()
  const [formData, setFormData] = useState<CandidateFormInput>(initialFormData)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isScanningPassport, setIsScanningPassport] = useState(false)
  const [ocrFeedback, setOcrFeedback] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const updateField = (field: keyof CandidateFormInput, value: string) => {
    setFormData((currentData) => ({ ...currentData, [field]: value }))
  }

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    setUploadedFiles((currentFiles) => [...currentFiles, ...files.map((file) => file.name)])
    event.target.value = ''

    const passportImage = files.find((file) => file.type.startsWith('image/'))

    if (!passportImage) {
      return
    }

    setIsScanningPassport(true)
    setOcrFeedback('Rozpoznawanie dokumentu...')

    try {
      const result = await scanPassport(passportImage)
      const [firstName = '', ...lastNameParts] = (result.employee_name ?? '').split(' ').filter(Boolean)

      setFormData((currentData) => ({
        ...currentData,
        firstName: firstName || currentData.firstName,
        lastName: lastNameParts.join(' ') || currentData.lastName,
        pesel: result.pesel ?? currentData.pesel,
      }))
      setOcrFeedback('Dane z dokumentu zostały rozpoznane i uzupełnione.')
    } catch (error) {
      setOcrFeedback(error instanceof Error ? error.message : 'Nie udało się rozpoznać dokumentu.')
    } finally {
      setIsScanningPassport(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    window.setTimeout(() => {
      submitCandidateForm(formData)
      setSubmitted(true)
      setIsSubmitting(false)
    }, 420)
  }

  const formTitle =
    activeFormLink?.template === 'Umowa B2B (wersja 2026) + Załączniki'
      ? 'Umowa B2B + załączniki'
      : 'Umowa zlecenie + oświadczenie'

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

      <form className="candidate-form-shell" onSubmit={handleSubmit}>
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
              <input required value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </label>
            <label>
              <span>PESEL</span>
              <input required value={formData.pesel} onChange={(event) => updateField('pesel', event.target.value)} />
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
            <span>{isScanningPassport ? 'OCR analizuje dokument...' : 'Oświadczenie, dowód osobisty, legitymacja itp.'}</span>
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
              {uploadedFiles.map((fileName) => (
                <li key={fileName}>
                  <FileUp />
                  {fileName}
                </li>
              ))}
            </ul>
          )}
          {ocrFeedback && <p className="create-invite-feedback">{ocrFeedback}</p>}
        </section>

        <button className="candidate-form-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Wysyłanie danych...' : 'Wyślij dane do agencji'}
        </button>
      </form>
    </main>
  )
}
