import { useRef, useState, type ChangeEvent } from 'react'
import { Building2, FileText, Mail, Plus, Settings as SettingsIcon, UploadCloud } from 'lucide-react'
import { Header } from '../components/Header'
import { uploadTemplate } from '../lib/backend'

type SettingsTab = 'profile' | 'team' | 'templates' | 'integrations'

const settingsTabs: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profil agencji' },
  { id: 'team', label: 'Zespół' },
  { id: 'templates', label: 'Szablony umów' },
  { id: 'integrations', label: 'Integracje' },
]

const teamMembers = [
  { name: 'Andrii Matviyuk', email: 'andrii@talentbridge.pl', role: 'Admin', addedAt: '12.01.2026' },
  { name: 'Anna Kowalska', email: 'anna@talentbridge.pl', role: 'Rekruter', addedAt: '18.01.2026' },
  { name: 'Tomasz Nowak', email: 'tomasz@talentbridge.pl', role: 'Rekruter', addedAt: '03.02.2026' },
]

const contractTemplates = [
  { id: 'b2b', title: 'Umowa B2B (wersja 2026)', meta: 'DOCX • 184 KB • aktywny szablon' },
  { id: 'zlecenie', title: 'Umowa Zlecenie (Kandydaci)', meta: 'DOCX • 156 KB • używana w kampaniach' },
]

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [selectedTemplateId, setSelectedTemplateId] = useState(contractTemplates[0].id)
  const [templateUploadStatus, setTemplateUploadStatus] = useState('')
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false)
  const templateInputRef = useRef<HTMLInputElement | null>(null)
  const [profileForm, setProfileForm] = useState({
    agencyName: 'TalentBridge Sp. z o.o.',
    nip: '521-194-81-12',
    address: 'ul. Prosta 20, 00-850 Warszawa',
    phone: '+48 600 400 200',
  })
  const [smtpForm, setSmtpForm] = useState({
    host: 'smtp.gmail.com',
    port: '587',
    senderEmail: 'otp@talentbridge.pl',
    appPassword: '•••• •••• •••• ••••',
  })
  const [smtpEnabled, setSmtpEnabled] = useState(true)

  const handleTemplateSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setIsUploadingTemplate(true)
    setTemplateUploadStatus('')

    try {
      const result = await uploadTemplate(file)
      setTemplateUploadStatus(`Szablon "${result.filename}" został przesłany do Supabase Storage.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się przesłać szablonu.'
      setTemplateUploadStatus(message)
    } finally {
      setIsUploadingTemplate(false)
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
          <h2>Konfiguracja TalentBridge</h2>
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

              <form className="settings-form">
                <label>
                  <span>Nazwa agencji</span>
                  <input
                    value={profileForm.agencyName}
                    onChange={(event) => setProfileForm({ ...profileForm, agencyName: event.target.value })}
                  />
                </label>
                <label>
                  <span>NIP</span>
                  <input
                    value={profileForm.nip}
                    onChange={(event) => setProfileForm({ ...profileForm, nip: event.target.value })}
                  />
                </label>
                <label>
                  <span>Adres</span>
                  <input
                    value={profileForm.address}
                    onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })}
                  />
                </label>
                <label>
                  <span>Telefon</span>
                  <input
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                  />
                </label>
                <button type="button">Zapisz zmiany</button>
              </form>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="settings-table-card">
              <div className="settings-card-toolbar">
                <div>
                  <h2>Zespół</h2>
                  <p>Użytkownicy z dostępem do dokumentów i statusów kandydatów.</p>
                </div>
                <button type="button">
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
                  {teamMembers.map((member) => (
                    <tr key={member.email}>
                      <td>
                        <div className="recruiter-cell">
                          <span className="recruiter-avatar">{member.name.split(' ').map((part) => part[0]).join('')}</span>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="templates-layout">
              <div className="templates-grid">
                {contractTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-card ${selectedTemplateId === template.id ? 'template-card-active' : ''}`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <span>
                      <FileText />
                    </span>
                    <strong>{template.title}</strong>
                    <small>{template.meta}</small>
                  </button>
                ))}
              </div>

              <button
                className="upload-dropzone"
                type="button"
                disabled={isUploadingTemplate}
                onClick={() => templateInputRef.current?.click()}
              >
                <UploadCloud />
                <strong>{isUploadingTemplate ? 'Przesyłanie szablonu...' : 'Przeciągnij i upuść plik DOCX'}</strong>
                <span>albo kliknij, aby wybrać nowy szablon umowy</span>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                <h2>Gmail SMTP</h2>
                <p>Skonfiguruj własną skrzynkę do wysyłki kodów OTP i przypomnień do kandydatów.</p>
                <button
                  className={smtpEnabled ? 'integration-toggle integration-toggle-on' : 'integration-toggle'}
                  type="button"
                  onClick={() => setSmtpEnabled((current) => !current)}
                >
                  {smtpEnabled ? 'Integracja aktywna' : 'Włącz integrację'}
                </button>
              </article>

              <form className="settings-form">
                <label>
                  <span>SMTP Host</span>
                  <input
                    value={smtpForm.host}
                    onChange={(event) => setSmtpForm({ ...smtpForm, host: event.target.value })}
                  />
                </label>
                <label>
                  <span>Port</span>
                  <input
                    value={smtpForm.port}
                    onChange={(event) => setSmtpForm({ ...smtpForm, port: event.target.value })}
                  />
                </label>
                <label>
                  <span>Email nadawcy</span>
                  <input
                    value={smtpForm.senderEmail}
                    onChange={(event) => setSmtpForm({ ...smtpForm, senderEmail: event.target.value })}
                  />
                </label>
                <label>
                  <span>Hasło aplikacji</span>
                  <input
                    type="password"
                    value={smtpForm.appPassword}
                    onChange={(event) => setSmtpForm({ ...smtpForm, appPassword: event.target.value })}
                  />
                </label>
                <button type="button">Zapisz konfigurację SMTP</button>
              </form>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
