import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Building2, FileText, Mail, Pencil, Plus, Settings as SettingsIcon, Star, Trash2, UploadCloud } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Header } from '../components/Header'
import { TemplateBuilderModal } from '../components/TemplateBuilderModal'
import { useAppContext } from '../context/AppContext'
import {
  type AgencyTemplate,
  deleteTemplate,
  getOrganizationProfile,
  getTemplateBuilderToken,
  listTemplates,
  MAX_AGENCY_TEMPLATES,
  setDefaultSendTemplate,
  updateOrganizationProfile,
  uploadTemplate,
} from '../lib/backend'
type SettingsTab = 'profile' | 'team' | 'templates' | 'integrations'

const settingsTabs: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profil agencji' },
  { id: 'team', label: 'Zespół' },
  { id: 'templates', label: 'Szablony umów' },
  { id: 'integrations', label: 'Integracje' },
]

const teamMembers: { name: string; email: string; role: string; addedAt: string }[] = []

function formatTemplateSize(size: number | null) {
  if (!size || size <= 0) {
    return 'PDF'
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatTemplateDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function Settings() {
  const { fetchOrganizationProfile } = useAppContext()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [templates, setTemplates] = useState<AgencyTemplate[]>([])
  const [maxTemplates, setMaxTemplates] = useState(MAX_AGENCY_TEMPLATES)
  const [defaultTemplateId, setDefaultTemplateId] = useState<number | null>(null)
  const [settingDefaultFor, setSettingDefaultFor] = useState<string | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null)
  const [templateUploadStatus, setTemplateUploadStatus] = useState('')
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false)
  const templateInputRef = useRef<HTMLInputElement | null>(null)
  const [profileForm, setProfileForm] = useState({
    agencyName: '',
    nip: '',
    address: '',
    phone: '',
  })
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaveStatus, setProfileSaveStatus] = useState('')
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: '',
    senderEmail: '',
    appPassword: '',
  })
  const [builderModal, setBuilderModal] = useState<{
    templateName: string
    builderToken: string | null
    builderHost: string | null
  } | null>(null)
  const [openingBuilderFor, setOpeningBuilderFor] = useState<string | null>(null)

  const openBuilder = useCallback(
    (templateName: string, builderToken: string, builderHost: string | null = null) => {
      setBuilderModal({
        templateName,
        builderToken,
        builderHost,
      })
    },
    [],
  )

  const closeBuilder = useCallback(() => {
    setBuilderModal(null)
  }, [])

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true)

    try {
      const response = await listTemplates()
      setTemplates(response.templates)
      setMaxTemplates(response.maxTemplates)
      setDefaultTemplateId(response.defaultTemplateId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się pobrać listy szablonów.'
      setTemplateUploadStatus(message)
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true)
    setProfileSaveStatus('')

    try {
      const profile = await getOrganizationProfile()
      setProfileForm({
        agencyName: profile.name,
        nip: profile.nip,
        address: profile.address,
        phone: profile.phone,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się pobrać profilu agencji.'
      setProfileSaveStatus(message)
    } finally {
      setIsLoadingProfile(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'profile') {
      return
    }

    void loadProfile()
  }, [activeTab, loadProfile])

  useEffect(() => {
    if (activeTab !== 'templates') {
      return
    }

    void loadTemplates()
  }, [activeTab, loadTemplates])

  const handleSaveProfile = async () => {
    if (!profileForm.agencyName.trim()) {
      setProfileSaveStatus('Nazwa agencji jest wymagana.')
      return
    }

    setIsSavingProfile(true)
    setProfileSaveStatus('')

    try {
      const profile = await updateOrganizationProfile({
        name: profileForm.agencyName.trim(),
        nip: profileForm.nip.trim(),
        address: profileForm.address.trim(),
        phone: profileForm.phone.trim(),
      })

      setProfileForm({
        agencyName: profile.name,
        nip: profile.nip,
        address: profile.address,
        phone: profile.phone,
      })
      await fetchOrganizationProfile()
      setProfileSaveStatus('Zmiany zostały zapisane.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać profilu agencji.'
      setProfileSaveStatus(message)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleTemplateSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (templates.length >= maxTemplates) {
      const isReplacement = templates.some((template) => template.filename === file.name)

      if (!isReplacement) {
        setTemplateUploadStatus(
          `Osiągnięto limit ${maxTemplates} szablonów. Usuń istniejący szablon, aby dodać nowy plik.`,
        )
        return
      }
    }

    setIsUploadingTemplate(true)
    setTemplateUploadStatus('')

    try {
      const result = await uploadTemplate(file)
      setTemplateUploadStatus(
        result.builder_token
          ? `Szablon "${result.filename}" został przesłany. Otwórz konstruktor pól i zapisz układ dokumentu.`
          : `Szablon "${result.filename}" został przesłany do Supabase Storage.`,
      )
      if (result.builder_token) {
        openBuilder(
          result.filename,
          result.builder_token,
          result.builder_host ?? null,
        )
      }
      await loadTemplates()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się przesłać szablonu.'
      setTemplateUploadStatus(message)
    } finally {
      setIsUploadingTemplate(false)
    }
  }

  const handleOpenBuilder = async (template: AgencyTemplate) => {
    if (!template.docuseal_template_id) {
      setTemplateUploadStatus('Ten szablon nie ma jeszcze powiązanego dokumentu DocuSeal. Prześlij go ponownie.')
      return
    }

    setOpeningBuilderFor(template.filename)
    setTemplateUploadStatus('')

    try {
      const response = await getTemplateBuilderToken(
        template.docuseal_template_id,
        template.name || template.filename,
      )
      openBuilder(template.filename, response.builder_token, response.builder_host ?? null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nie udało się otworzyć konstruktora pól DocuSeal.'
      setTemplateUploadStatus(message)
    } finally {
      setOpeningBuilderFor(null)
    }
  }

  const handleSetDefaultSendTemplate = async (template: AgencyTemplate) => {
    if (template.is_default_send || defaultTemplateId === template.id) {
      return
    }

    setSettingDefaultFor(template.filename)
    setTemplateUploadStatus('')

    try {
      await setDefaultSendTemplate(template.id)
      await loadTemplates()
      setTemplateUploadStatus(`"${template.filename}" jest teraz domyślnym szablonem do wysyłki.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nie udało się ustawić domyślnego szablonu do wysyłki.'
      setTemplateUploadStatus(message)
    } finally {
      setSettingDefaultFor(null)
    }
  }

  const handleDeleteTemplate = async (filename: string) => {
    setDeletingFilename(filename)
    setTemplateUploadStatus('')

    try {
      await deleteTemplate(filename)
      await loadTemplates()
      setTemplateUploadStatus(`Szablon "${filename}" został usunięty.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się usunąć szablonu.'
      setTemplateUploadStatus(message)
    } finally {
      setDeletingFilename(null)
    }
  }

  return (
    <>
      <Header
        title="Ustawienia agencji"
        subtitle="Konfiguracja limitów, danych firmy i ustawień wysyłki dokumentów."
      />

      <section className="page-card">
        <div className="page-card-icon">
          <SettingsIcon />
        </div>
        <div>
          <h2>Konfiguracja agencji</h2>
          <p>W tym miejscu możesz później podpiąć dane agencji, szablony i ustawienia SMTP.</p>
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-tabs" role="tablist" aria-label="Ustawienia agencji">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'settings-tab-active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {activeTab === 'profile' && (
            <div className="settings-section-grid">
              <article className="settings-info-card">
                <div className="settings-section-icon">
                  <Building2 />
                </div>
                <h2>Profil agencji</h2>
                <p>Dane widoczne w dokumentach, wiadomościach OTP i panelu kandydata.</p>
              </article>

              <form
                className="settings-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSaveProfile()
                }}
              >
                <label>
                  <span>Nazwa agencji</span>
                  <input
                    value={profileForm.agencyName}
                    onChange={(event) => setProfileForm({ ...profileForm, agencyName: event.target.value })}
                    disabled={isLoadingProfile || isSavingProfile}
                  />
                </label>
                <label>
                  <span>NIP</span>
                  <input
                    value={profileForm.nip}
                    onChange={(event) => setProfileForm({ ...profileForm, nip: event.target.value })}
                    disabled={isLoadingProfile || isSavingProfile}
                  />
                </label>
                <label>
                  <span>Adres</span>
                  <input
                    value={profileForm.address}
                    onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })}
                    disabled={isLoadingProfile || isSavingProfile}
                  />
                </label>
                <label>
                  <span>Telefon</span>
                  <input
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                    disabled={isLoadingProfile || isSavingProfile}
                  />
                </label>
                <button type="submit" disabled={isLoadingProfile || isSavingProfile}>
                  {isSavingProfile ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </button>
                {profileSaveStatus && <p className="create-invite-feedback">{profileSaveStatus}</p>}
              </form>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="settings-table-card">
              <div className="settings-card-toolbar">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0 }}>Zespół</h2>
                    <span className="status-pill status-warning">W rozwoju</span>
                  </div>
                  <p>Użytkownicy z dostępem do dokumentów i statusów kandydatów.</p>
                </div>
                <button type="button" disabled title="Funkcja jest w przygotowaniu">
                  <Plus />
                  Zaproś rekrutera
                </button>
              </div>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Imię i nazwisko</th>
                    <th>Email</th>
                    <th>Rola</th>
                    <th>Data dodania</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.length === 0 ? (
                    <EmptyState
                      variant="table"
                      colSpan={4}
                      message="Lista zespołu jest pusta"
                      description="Zarządzanie zespołem rekruterów będzie dostępne wkrótce."
                    />
                  ) : (
                    teamMembers.map((member) => (
                      <tr key={member.email}>
                        <td>
                          <div className="recruiter-cell">
                            <span className="recruiter-avatar">
                              {member.name
                                .split(' ')
                                .map((part) => part[0])
                                .join('')}
                            </span>
                            <strong>{member.name}</strong>
                          </div>
                        </td>
                        <td>{member.email}</td>
                        <td>
                          <span className={member.role === 'Admin' ? 'role-pill role-pill-admin' : 'role-pill'}>
                            {member.role}
                          </span>
                        </td>
                        <td>{member.addedAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="templates-layout">
              <div className="templates-list-panel">
                <div className="templates-list-header">
                  <div>
                    <h2>Przesłane szablony</h2>
                    <p>
                      Pliki PDF przypisane do Twojej agencji w Supabase Storage. Możesz przechowywać do{' '}
                      {maxTemplates} szablonów. Oznacz jeden jako domyślny do wysyłki kandydatom.
                    </p>
                  </div>
                  <span className="templates-count-pill">
                    {templates.length}/{maxTemplates}
                  </span>
                </div>

                {isLoadingTemplates ? (
                  <p className="templates-loading">Ładowanie szablonów...</p>
                ) : templates.length === 0 ? (
                  <EmptyState
                    message="Brak szablonów umów"
                    description="Prześlij pierwszy plik PDF, aby rozpocząć pracę z dokumentami."
                  />
                ) : (
                  <ul className="templates-file-list">
                    {templates.map((template) => (
                      <li
                        key={template.path}
                        className={`template-file-item${template.is_default_send ? ' template-file-item-default' : ''}`}
                      >
                        <div className="template-file-icon">
                          <FileText />
                        </div>
                        <div className="template-file-copy">
                          <div className="template-file-title-row">
                            <strong>{template.filename}</strong>
                            {template.is_default_send && (
                              <span className="template-default-badge">
                                <Star />
                                Domyślny do wysyłki
                              </span>
                            )}
                          </div>
                          <span>
                            {formatTemplateSize(template.size)} • {formatTemplateDate(template.updated_at)}
                          </span>
                        </div>
                        <div className="template-file-actions">
                          {!template.is_default_send && (
                            <button
                              className="template-default-button"
                              type="button"
                              disabled={settingDefaultFor === template.filename}
                              onClick={() => void handleSetDefaultSendTemplate(template)}
                            >
                              <Star />
                              {settingDefaultFor === template.filename ? 'Zapisywanie...' : 'Ustaw do wysyłki'}
                            </button>
                          )}
                          <button
                            className="template-edit-button"
                            type="button"
                            disabled={!template.docuseal_template_id || openingBuilderFor === template.filename}
                            onClick={() => void handleOpenBuilder(template)}
                          >
                            <Pencil />
                            {openingBuilderFor === template.filename ? 'Otwieranie...' : 'Edytuj pola'}
                          </button>
                          <button
                            className="template-delete-button"
                            type="button"
                            aria-label={`Usuń szablon ${template.filename}`}
                            disabled={deletingFilename === template.filename}
                            onClick={() => void handleDeleteTemplate(template.filename)}
                          >
                            <Trash2 />
                            {deletingFilename === template.filename ? 'Usuwanie...' : 'Usuń'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                className={`upload-dropzone${templates.length >= maxTemplates ? ' upload-dropzone-limit' : ''}`}
                type="button"
                disabled={isUploadingTemplate}
                onClick={() => templateInputRef.current?.click()}
              >
                <UploadCloud />
                <strong>
                  {isUploadingTemplate
                    ? 'Przesyłanie szablonu...'
                    : templates.length >= maxTemplates
                      ? `Limit ${maxTemplates} szablonów osiągnięty`
                      : 'Przeciągnij i upuść plik PDF'}
                </strong>
                <span>
                  {templates.length >= maxTemplates
                    ? 'Możesz zastąpić istniejący plik o tej samej nazwie lub usunąć szablon'
                    : 'albo kliknij, aby wybrać nowy szablon umowy'}
                </span>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={handleTemplateSelected}
                />
              </button>
              {templateUploadStatus && <p className="create-invite-feedback">{templateUploadStatus}</p>}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section-grid">
              <article className="settings-info-card">
                <div className="settings-section-icon">
                  <Mail />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>Gmail SMTP</h2>
                  <span className="status-pill status-warning">W rozwoju</span>
                </div>
                <p>Skonfiguruj własną skrzynkę do wysyłki kodów OTP i przypomnień do kandydatów.</p>
                <p>Konfiguracja SMTP będzie dostępna wkrótce.</p>
              </article>

              <form className="settings-form">
                <label>
                  <span>SMTP Host</span>
                  <input value={smtpForm.host} disabled />
                </label>
                <label>
                  <span>Port</span>
                  <input value={smtpForm.port} disabled />
                </label>
                <label>
                  <span>Email nadawcy</span>
                  <input value={smtpForm.senderEmail} disabled />
                </label>
                <label>
                  <span>Hasło aplikacji</span>
                  <input type="password" value={smtpForm.appPassword} disabled />
                </label>
                <button type="button" disabled title="Funkcja jest w przygotowaniu">
                  Zapisz konfigurację SMTP
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      <TemplateBuilderModal
        isOpen={builderModal !== null}
        templateName={builderModal?.templateName ?? ''}
        builderToken={builderModal?.builderToken ?? null}
        builderHost={builderModal?.builderHost}
        onClose={closeBuilder}
        onSaved={() => {
          setTemplateUploadStatus('Układ pól szablonu został zapisany.')
          void loadTemplates()
        }}
      />
    </>
  )
}
