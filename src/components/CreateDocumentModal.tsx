import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, FileText, Mail, Send, X } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { useAppContext, type FormLinkConfig } from '../context/AppContext'
import { createCandidateInvitation, listTemplates, type AgencyTemplate } from '../lib/backend'

interface CreateDocumentModalProps {
  isOpen: boolean
  onClose: () => void
}

function isValidCandidateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function CreateDocumentModal({ isOpen, onClose }: CreateDocumentModalProps) {
  const { fetchCandidates } = useAppContext()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<AgencyTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [templatesError, setTemplatesError] = useState('')
  const [generatedLink, setGeneratedLink] = useState<FormLinkConfig | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let ignore = false

    async function loadTemplates() {
      setIsLoadingTemplates(true)
      setTemplatesError('')

      try {
        const response = await listTemplates()

        if (ignore) {
          return
        }

        setTemplates(response.templates)

        const defaultTemplate =
          response.templates.find((template) => template.is_default_send) ?? response.templates[0] ?? null

        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id)
          setSelectedTemplateName(defaultTemplate.name || defaultTemplate.filename)
        } else {
          setSelectedTemplateId(null)
          setSelectedTemplateName('')
        }
      } catch (error) {
        if (ignore) {
          return
        }

        setTemplates([])
        setSelectedTemplateId(null)
        setSelectedTemplateName('')
        setTemplatesError(error instanceof Error ? error.message : 'Nie udało się pobrać szablonów.')
      } finally {
        if (!ignore) {
          setIsLoadingTemplates(false)
        }
      }
    }

    void loadTemplates()

    return () => {
      ignore = true
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const resetModalState = () => {
    setStep(1)
    const defaultTemplate = templates.find((template) => template.is_default_send) ?? templates[0] ?? null
    setSelectedTemplateId(defaultTemplate?.id ?? null)
    setSelectedTemplateName(defaultTemplate?.name || defaultTemplate?.filename || '')
    setGeneratedLink(null)
    setInviteEmail('')
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
    if (!selectedTemplateId) {
      setInviteError('Wybierz szablon przed wygenerowaniem formularza.')
      return
    }

    setInviteError('')
    setStep(2)
  }

  const handleSelectTemplate = (template: AgencyTemplate) => {
    setSelectedTemplateId(template.id)
    setSelectedTemplateName(template.name || template.filename)
    setInviteError('')
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
    // TODO: Modified for simplified email-only flow
    if (!inviteEmail.trim()) {
      setInviteError('Podaj e-mail kandydata.')
      return
    }

    if (!isValidCandidateEmail(inviteEmail)) {
      setInviteError('Podaj poprawny adres e-mail kandydata.')
      return
    }

    setInviteError('')
    setInviteSent(false)
    setIsSendingInvite(true)

    if (!selectedTemplateId) {
      setInviteError('Wybierz szablon przed wysłaniem zaproszenia.')
      setIsSendingInvite(false)
      return
    }

    try {
      const invitation = await createCandidateInvitation({
        template_id: selectedTemplateId,
        candidate_email: inviteEmail.trim(),
        require_id_scan: false,
        require_student_status: false,
      })
      const url = `${window.location.origin}${invitation.url}`
      setGeneratedLink({
        template: selectedTemplateName,
        requireIdScan: false,
        requireStudentStatus: false,
        slug: invitation.slug,
        url,
      })
      setInviteSent(true)
      await fetchCandidates()
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
            {step === 1 ? 'Wybierz dokument' : 'Udostępnij formularz'}
          </h2>
          <p>
            {step === 1
              ? 'Wybierz szablon umowy, który otrzyma kandydat.'
              : 'Wyślij ten link do kandydata. Po uzupełnieniu danych, umowa wygeneruje się automatycznie.'}
          </p>
        </div>

        <div className="create-document-progress" aria-hidden="true">
          <span className="create-document-progress-active" />
          <span className={step === 2 ? 'create-document-progress-active' : ''} />
        </div>

        {step === 1 && (
          <div className="create-document-template-step">
            {isLoadingTemplates ? (
              <p className="create-template-loading">Ładowanie szablonów...</p>
            ) : templates.length === 0 ? (
              <EmptyState
                message="У вас пока нет загруженных шаблонов."
                description="Пожалуйста, перейдите в 'Ustawienia agencji' и добавьте свой первый DOCX-шаблон."
              />
            ) : (
              <div className="create-template-grid create-template-grid-single">
                {templates.map((template) => (
                  <button
                    key={`${template.id}-${template.filename}`}
                    type="button"
                    className={
                      selectedTemplateId === template.id
                        ? 'create-template-card create-template-card-active'
                        : 'create-template-card'
                    }
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <span>
                      <FileText />
                    </span>
                    <strong>{template.name || template.filename}</strong>
                    <small>
                      {template.is_default_send
                        ? 'Domyślny szablon do wysyłki'
                        : 'Szablon PDF z Supabase Storage'}
                    </small>
                  </button>
                ))}
              </div>
            )}

            {(templatesError || inviteError) && <p className="auth-error">{templatesError || inviteError}</p>}

            <div className="create-document-actions">
              <button type="button" disabled={isLoadingTemplates || templates.length === 0 || !selectedTemplateId} onClick={handleGenerateLink}>
                Generuj link do formularza
                <ArrowRight />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="create-document-share-step">
            <div className="create-document-share-body">
              <div className="create-link-success">
                <strong>Przygotuj zaproszenie dla kandydata</strong>
                <span>Po utworzeniu zaproszenia kandydat otrzyma publiczny formularz. DocuSeal uruchomi się dopiero po wysłaniu ankiety.</span>
              </div>

              {generatedLink && (
                <div className="create-link-row">
                  <input readOnly value={generatedLink.url} aria-label="Wygenerowany link do formularza" />
                  <button className="create-copy-button" type="button" onClick={handleCopyLink}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? 'Skopiowano' : 'Kopiuj link'}
                  </button>
                </div>
              )}

              {generatedLink && (
                <button className="create-open-form-button" type="button" onClick={handleOpenFormPreview}>
                  <ExternalLink />
                  Otwórz formularz (test)
                </button>
              )}

              <div className="create-link-divider">
                <span>lub</span>
              </div>

              <div className="create-invite-grid">
                <label>
                  <span>E-mail kandydata</span>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="kandydat@email.com"
                  />
                </label>
              </div>

              <button
                className="create-invite-button"
                type="button"
                disabled={isSendingInvite || !inviteEmail.trim() || !isValidCandidateEmail(inviteEmail)}
                onClick={handleSendInvite}
              >
                <Send />
                {isSendingInvite ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
              </button>

              {inviteError && <p className="auth-error">{inviteError}</p>}

              {inviteSent && (
                <p className="create-invite-feedback">
                  <Mail />
                  Zaproszenie z linkiem zostało wysłane na e-mail!
                </p>
              )}
            </div>

            <div className="create-document-actions create-document-actions-split create-document-share-footer">
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
