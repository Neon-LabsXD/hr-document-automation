import { useCallback, useMemo, useState } from 'react'
import { Check, Copy, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { buildDocusealBuilderSrcDoc } from '../utils/docusealBuilder'

const DOCUSEAL_FIELD_VARIABLES = [
  { key: 'Full Name', description: 'Imię i nazwisko kandydata' },
  { key: 'PESEL', description: 'PESEL z ankiety' },
  { key: 'Email', description: 'Email kandydata' },
  { key: 'Phone', description: 'Telefon' },
  { key: 'Birth Date', description: 'Data urodzenia' },
  { key: 'Address', description: 'Ulica, numer domu, kod pocztowy, miasto' },
  { key: 'Agency Name', description: 'Nazwa agencji' },
  { key: 'Agency NIP', description: 'NIP agencji' },
  { key: 'Agency Address', description: 'Adres agencji' },
] as const

interface TemplateBuilderModalProps {
  isOpen: boolean
  templateName: string
  builderToken: string | null
  builderHost?: string | null
  onClose: () => void
  onSaved?: () => void
}

export function TemplateBuilderModal({
  isOpen,
  templateName,
  builderToken,
  builderHost,
  onClose,
  onSaved,
}: TemplateBuilderModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isVariablesOpen, setIsVariablesOpen] = useState(false)

  const finishEditing = useCallback(() => {
    onSaved?.()
    setIsClosing(true)
    window.setTimeout(() => {
      onClose()
      setIsClosing(false)
      setIsVariablesOpen(false)
    }, 180)
  }, [onClose, onSaved])

  const iframeSrcDoc = useMemo(() => {
    if (!builderToken) {
      return null
    }

    return buildDocusealBuilderSrcDoc(builderToken, builderHost)
  }, [builderHost, builderToken])

  const copyFieldKey = useCallback(async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 1600)
    } catch {
      setCopiedKey(null)
    }
  }, [])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`template-builder-backdrop ${isClosing ? 'template-builder-backdrop-closing' : ''}`}
    >
      <section
        className={`template-builder-modal ${isClosing ? 'template-builder-modal-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-builder-title"
      >
        <header className="template-builder-header">
          <div className="template-builder-header-copy">
            <span className="template-builder-step">Konstruktor pól</span>
            <h2 id="template-builder-title">
              {templateName}
            </h2>
            <p>
              Zmiany zapisują się automatycznie. Otwórz <strong>Zmienne pól</strong>, gdy potrzebujesz
              skopiować nazwę pola.
            </p>
          </div>
          <div className="template-builder-header-actions">
            <button
              className="template-builder-variables-toggle"
              type="button"
              aria-expanded={isVariablesOpen}
              onClick={() => setIsVariablesOpen((current) => !current)}
            >
              {isVariablesOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
              {isVariablesOpen ? 'Ukryj zmienne' : 'Zmienne pól'}
            </button>
            <button className="template-builder-finish" type="button" onClick={finishEditing}>
              <Check />
              Zakończ edycję
            </button>
            <button
              className="template-builder-close"
              type="button"
              aria-label="Zamknij konstruktor"
              onClick={finishEditing}
            >
              <X />
            </button>
          </div>
        </header>

        <div
          className={`template-builder-body${isVariablesOpen ? '' : ' template-builder-body-expanded'}`}
        >
          {isVariablesOpen && (
            <aside className="template-builder-variables" aria-label="Lista zmiennych pól DocuSeal">
              <h3 className="template-builder-variables-title">Zmienne pól</h3>
              <p className="template-builder-variables-note">
                <strong>Ważne:</strong> aby dane zostały wstawione automatycznie, w konstruktorze DocuSeal
                zmień nazwę pola dokładnie tak, jak podano w lewej kolumnie.
              </p>

              <div className="template-builder-variables-table" role="table">
                <div className="template-builder-variables-header" role="row">
                  <span role="columnheader">Klucz DocuSeal</span>
                  <span role="columnheader">Opis</span>
                </div>

                <ul className="template-builder-variables-list">
                  {DOCUSEAL_FIELD_VARIABLES.map((variable) => {
                    const isCopied = copiedKey === variable.key

                    return (
                      <li key={variable.key} className="template-builder-variable-row" role="row">
                        <button
                          type="button"
                          className={`template-builder-variable-key${isCopied ? ' template-builder-variable-key-copied' : ''}`}
                          title="Kliknij, aby skopiować klucz"
                          onClick={() => void copyFieldKey(variable.key)}
                        >
                          <code>{variable.key}</code>
                          {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                          <span className="sr-only">Kopiuj {variable.key}</span>
                        </button>
                        <span className="template-builder-variable-description" role="cell">
                          {variable.description}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </aside>
          )}

          <div className="template-builder-frame-wrap">
            {iframeSrcDoc ? (
              <iframe
                className="template-builder-frame"
                title={`DocuSeal builder: ${templateName}`}
                srcDoc={iframeSrcDoc}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <p className="template-builder-loading">Ładowanie konstruktora...</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
