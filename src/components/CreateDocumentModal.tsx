import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, FileText, Mail, Send, Smartphone, X } from 'lucide-react'
import { useAppContext, type FormLinkConfig, type FormTemplate } from '../context/AppContext'
import { sendDocumentInvite } from '../lib/backend'

interface CreateDocumentModalProps {
  isOpen: boolean
  onClose: () => void
}

const templates: FormTemplate[] = ['Umowa Zlecenie + Oświadczenie', 'Umowa B2B (wersja 2026) + Załączniki']
const docusealTemplateId = Number(import.meta.env.VITE_DOCUSEAL_TEMPLATE_ID ?? 1)

export function CreateDocumentModal({ isOpen, onClose }: CreateDocumentModalProps) {
  const { generateFormLink } = useAppContext()
  const [step, setStep] = useState(1)
  const [template, setTemplate] = useState<FormTemplate>(templates[0])
  const [requireIdScan, setRequireIdScan] = useState(true)
  const [requireStudentStatus, setRequireStudentStatus] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<FormLinkConfig | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  if (!isOpen) {
    return null
  }

  const resetModalState = () => {
    setStep(1)
    setTemplate(templates[0])
    setRequireIdScan(true)
    setRequireStudentStatus(false)
    setGeneratedLink(null)
    setInviteName('')
    setInviteEmail('')
    setInvitePhone('')
    setCopied(false)
    setInviteSent(false)
    setInviteError('')
    setIsSendingInvite(false)
    setIsClosing(false)
  }

  const closeModal = () => {
    setIsClosing(true)
    window.setTimeout(() => {
      onClose()
      resetModalState()
    }, 180)
  }

  const handleGenerateLink = () => {
    const link = generateFormLink({
      template,
      requireIdScan,
      requireStudentStatus,
    })
    setGeneratedLink(link)
    setStep(2)
  }

  const handleCopyLink = async () => {
    if (!generatedLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(generatedLink.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  const handleOpenFormPreview = () => {
    if (!generatedLink) {
      return
    }

    window.open(`/f/${generatedLink.slug}`, '_blank', 'noopener,noreferrer')
  }

  const handleSendInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Podaj imię, nazwisko i e-mail kandydata.')
      return
    }

    setInviteError('')
    setInviteSent(false)
    setIsSendingInvite(true)

    try {
      await sendDocumentInvite({
        template_id: docusealTemplateId,
        candidate_email: inviteEmail.trim(),
        candidate_name: inviteName.trim(),
      })
      setInviteSent(true)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Nie udało się wysłać zaproszenia.')
    } finally {
      setIsSendingInvite(false)
    }
  }

  return (
    <div
      className={`create-document-backdrop ${isClosing ? 'create-document-backdrop-closing' : ''}`}
      onMouseDown={closeModal}
    >
      <section
        className={`create-document-modal ${isClosing ? 'create-document-modal-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-document-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="create-document-close" type="button" aria-label="Zamknij kreator" onClick={closeModal}>
          <X />
        </button>

        <div className="create-document-heading">
          <span className="create-document-step">Krok {step} z 2</span>
          <h2 id="create-document-title">
            {step === 1 ? 'Wybierz szablon i dokumenty' : 'Udostępnij formularz'}
          </h2>
          <p>
            {step === 1
              ? 'Skonfiguruj pakiet dokumentów i wymagane załączniki dla kandydata.'
              : 'Wyślij ten link do kandydata. Po uzupełnieniu danych, umowa wygeneruje się automatycznie.'}
          </p>
        </div>

        <div className="create-document-progress" aria-hidden="true">
          <span className="create-document-progress-active" />
          <span className={step === 2 ? 'create-document-progress-active' : ''} />
        </div>

        {step === 1 && (
          <div className="create-document-template-step">
            <div className="create-template-grid create-template-grid-single">
              {templates.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={template === option ? 'create-template-card create-template-card-active' : 'create-template-card'}
                  onClick={() => setTemplate(option)}
                >
                  <span>
                    <FileText />
                  </span>
                  <strong>{option}</strong>
                  <small>
                    {option.includes('B2B')
                      ? 'Dla kontraktów biznesowych z pełnym pakietem załączników'
                      : 'Dla kandydatów na umowę zlecenie ze standardowym oświadczeniem'}
                  </small>
                </button>
              ))}
            </div>

            <div className="create-document-checkboxes">
              <label className="create-document-checkbox">
                <input
                  type="checkbox"
                  checked={requireIdScan}
                  onChange={(event) => setRequireIdScan(event.target.checked)}
                />
                <span>Wymagaj skanu dokumentu tożsamości</span>
              </label>
              <label className="create-document-checkbox">
                <input
                  type="checkbox"
                  checked={requireStudentStatus}
                  onChange={(event) => setRequireStudentStatus(event.target.checked)}
                />
                <span>Wymagaj statusu studenta</span>
              </label>
            </div>

            <div className="create-document-actions">
              <button type="button" onClick={handleGenerateLink}>
                Generuj link do formularza
                <ArrowRight />
              </button>
            </div>
          </div>
        )}

        {step === 2 && generatedLink && (
          <div className="create-document-share-step">
            <div className="create-link-success">
              <strong>Link do formularza został wygenerowany!</strong>
              <span>Skopiuj link lub wyślij zaproszenie bezpośrednio do kandydata.</span>
            </div>

            <div className="create-link-row">
              <input readOnly value={generatedLink.url} aria-label="Wygenerowany link do formularza" />
              <button className="create-copy-button" type="button" onClick={handleCopyLink}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Skopiowano' : 'Kopiuj link'}
              </button>
            </div>

            <button className="create-open-form-button" type="button" onClick={handleOpenFormPreview}>
              <ExternalLink />
              Otwórz formularz (test)
            </button>

            <div className="create-link-divider">
              <span>lub</span>
            </div>

            <div className="create-invite-grid">
              <label>
                <span>Imię i nazwisko kandydata</span>
                <input
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder="Jan Kowalski"
                />
              </label>
              <label>
                <span>E-mail kandydata</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="kandydat@email.com"
                />
              </label>
              <label>
                <span>Telefon kandydata</span>
                <input
                  value={invitePhone}
                  onChange={(event) => setInvitePhone(event.target.value)}
                  placeholder="+48 600 500 400"
                />
              </label>
            </div>

            <button
              className="create-invite-button"
              type="button"
              disabled={isSendingInvite || !inviteName.trim() || !inviteEmail.trim()}
              onClick={handleSendInvite}
            >
              <Send />
              {isSendingInvite ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
            </button>

            {inviteError && <p className="auth-error">{inviteError}</p>}

            {inviteSent && (
              <p className="create-invite-feedback">
                <Mail />
                <Smartphone />
                Zaproszenie zostało wysłane na wskazany e-mail.
              </p>
            )}

            <div className="create-document-actions create-document-actions-split">
              <button className="create-document-secondary" type="button" onClick={() => setStep(1)}>
                <ArrowLeft />
                Wstecz
              </button>
              <button type="button" onClick={closeModal}>
                Gotowe
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
