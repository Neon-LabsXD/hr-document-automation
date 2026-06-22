import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Lightbulb, Mail, Sparkles } from 'lucide-react'
import { useAppContext, type BusinessPriority, type FeatureProposalInput } from '../context/AppContext'

const initialFormState: FeatureProposalInput = {
  agencyName: '',
  contactEmail: '',
  featureName: '',
  description: '',
  priority: 'Ważne (Ułatwi codzienne operacje)',
}

const priorityOptions: BusinessPriority[] = [
  'Miło mieć (Fajny dodatek)',
  'Ważne (Ułatwi codzienne operacje)',
  'Krytyczne (Blokuje mój rozwój / Przejście z innego systemu)',
]

export function Offer() {
  const { addFeatureProposal } = useAppContext()
  const [formData, setFormData] = useState<FeatureProposalInput>(initialFormState)
  const [submittedProposal, setSubmittedProposal] = useState<FeatureProposalInput | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addFeatureProposal(formData)
    setSubmittedProposal(formData)
  }

  const updateField = <FieldName extends keyof FeatureProposalInput>(
    fieldName: FieldName,
    value: FeatureProposalInput[FieldName],
  ) => {
    setFormData((currentData) => ({
      ...currentData,
      [fieldName]: value,
    }))
  }

  return (
    <div className="offer-page">
      <section className="offer-hero">
        <p className="eyebrow">Zaproponuj funkcję</p>
        <h1>Masz pomysł na ulepszenie Aether Flow?</h1>
        <p>
          Tworzymy naszą platformę wspólnie z agencjami rekrutacyjnymi. Napisz, jakiej
          automatyzacji brakuje w Twoim codziennym procesie, a my przeanalizujemy Twoje zgłoszenie
          i wdrożymy je w najbliższych aktualizacjach.
        </p>
      </section>

      <section className="offer-layout">
        <aside className="offer-context-card">
          <div className="offer-context-icon">
            <Lightbulb />
          </div>
          <h2>Pomysły z rynku trafiają prosto do roadmapy.</h2>
          <p>
            Zgłoszenie zapisujemy dziś lokalnie w stanie aplikacji. W kolejnym kroku można podmienić
            ten moment na zapis do tabeli Supabase.
          </p>
          <div className="offer-context-list">
            <span>
              <Sparkles />
              Analiza potrzeb agencji
            </span>
            <span>
              <Mail />
              Kontakt po rozpoczęciu prac
            </span>
          </div>
        </aside>

        <div className="offer-card-shell">
          <form
            className={`offer-form ${submittedProposal ? 'offer-form-hidden' : ''}`}
            onSubmit={handleSubmit}
          >
            <label>
              Nazwa agencji
              <input
                required
                type="text"
                value={formData.agencyName}
                onChange={(event) => updateField('agencyName', event.target.value)}
                placeholder="TalentBridge Sp. z o.o."
              />
            </label>

            <label>
              E-mail kontaktowy
              <input
                required
                type="email"
                value={formData.contactEmail}
                onChange={(event) => updateField('contactEmail', event.target.value)}
                placeholder="kontakt@agencja.pl"
              />
            </label>

            <label>
              Nazwa funkcji / automatyzacji
              <input
                required
                type="text"
                value={formData.featureName}
                onChange={(event) => updateField('featureName', event.target.value)}
                placeholder="Automatyczne przypomnienia SMS"
              />
            </label>

            <label>
              Szczegółowy opis
              <textarea
                required
                value={formData.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Opisz, jak ta funkcja powinna działać i jaki problem ma rozwiązać."
              />
            </label>

            <label>
              Priorytet dla Twojego biznesu
              <select
                value={formData.priority}
                onChange={(event) => updateField('priority', event.target.value as BusinessPriority)}
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">
              Wyślij propozycję
              <ArrowRight />
            </button>
          </form>

          {submittedProposal && (
            <article className="offer-success-card">
              <div>
                <CheckCircle2 />
              </div>
              <h2>Dziękujemy! Twoje zgłoszenie zostało zarejestrowane.</h2>
              <p>
                Powiadomimy Cię e-mailem, gdy rozpoczniemy prace nad tą funkcją.
              </p>
              <span>
                Zgłoszenie: <strong>{submittedProposal.featureName}</strong>
              </span>
            </article>
          )}
        </div>
      </section>
    </div>
  )
}
