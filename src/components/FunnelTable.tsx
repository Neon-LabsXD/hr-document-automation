import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCircle2, Download, MailCheck, MoreHorizontal, Send, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react'
import { DocumentDrawer } from './DocumentDrawer'
import { EmptyState } from './EmptyState'
import { useAppContext, type DocumentRecord, type DocumentStatus } from '../context/AppContext'
import { downloadSignedCandidateDocument } from '../lib/backend'

interface FunnelStage {
  label: string
  status: DocumentStatus
  icon: LucideIcon
}

const funnelStages: FunnelStage[] = [
  { label: 'Wysłano', status: 'SENT', icon: Send },
  { label: 'Otwarto', status: 'OPENED', icon: MailCheck },
  { label: 'Zweryfikowano OTP', status: 'OTP_VERIFIED', icon: ShieldCheck },
  { label: 'Podpisano', status: 'SIGNED', icon: CheckCircle2 },
]

const statusOrder: Record<DocumentStatus, number> = {
  PENDING_GENERATION: -1,
  DATA_COMPLETED: 0,
  SENT: 1,
  OPENED: 2,
  OTP_VERIFIED: 3,
  SIGNED: 4,
}

const statusLabels: Record<DocumentStatus, string> = {
  PENDING_GENERATION: 'oczekuje na generowanie',
  DATA_COMPLETED: 'dane uzupełnione',
  SENT: 'wysłano',
  OPENED: 'otwarto',
  OTP_VERIFIED: 'zweryfikowano OTP',
  SIGNED: 'podpisano',
}

function isPreFunnelStatus(status: DocumentStatus) {
  return status === 'PENDING_GENERATION' || status === 'DATA_COMPLETED'
}

function getStatusTone(status: DocumentStatus) {
  if (status === 'SIGNED' || status === 'DATA_COMPLETED') {
    return 'status-success'
  }

  if (status === 'OTP_VERIFIED' || status === 'PENDING_GENERATION') {
    return 'status-warning'
  }

  return 'status-info'
}

function getStageClass(document: DocumentRecord, stage: FunnelStage) {
  if (isPreFunnelStatus(document.status)) {
    return 'pipeline-dot-pending'
  }
  const documentIndex = statusOrder[document.status]
  const stageIndex = statusOrder[stage.status]

  if (stageIndex < documentIndex) {
    return 'pipeline-dot-complete'
  }

  if (stageIndex === documentIndex) {
    return document.status === 'OTP_VERIFIED' ? 'pipeline-dot-warning' : 'pipeline-dot-active'
  }

  return 'pipeline-dot-pending'
}

export function FunnelTable() {
  const { centralCandidatesList, deleteDocuments, deleteAllDocuments, updateDocumentStatus } = useAppContext()
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL')
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('ALL')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([])
  const [drawerDocument, setDrawerDocument] = useState<DocumentRecord | null>(null)
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null)
  const contractTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          centralCandidatesList
            .map((document) => document.contractType.trim())
            .filter((contractType) => contractType.length > 0),
        ),
      ).sort((left, right) => left.localeCompare(right, 'pl')),
    [centralCandidatesList],
  )
  const visibleDocuments = useMemo(
    () =>
      centralCandidatesList.filter((document) => {
        if (statusFilter !== 'ALL' && document.status !== statusFilter) {
          return false
        }

        if (contractTypeFilter !== 'ALL' && document.contractType !== contractTypeFilter) {
          return false
        }

        return true
      }),
    [centralCandidatesList, contractTypeFilter, statusFilter],
  )
  const allVisibleSelected =
    visibleDocuments.length > 0 && visibleDocuments.every((document) => selectedDocumentIds.includes(document.id))
  const selectedCount = selectedDocumentIds.length

  useEffect(() => {
    setSelectedDocumentIds((currentIds) =>
      currentIds.filter((documentId) => centralCandidatesList.some((document) => document.id === documentId)),
    )
  }, [centralCandidatesList])

  useEffect(() => {
    if (openActionMenuId === null) {
      return
    }

    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      const target = event.target

      if (target instanceof Element && target.closest('.row-actions')) {
        return
      }

      setOpenActionMenuId(null)
    }

    document.addEventListener('mousedown', closeMenuOnOutsideClick)

    return () => {
      document.removeEventListener('mousedown', closeMenuOnOutsideClick)
    }
  }, [openActionMenuId])

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedDocumentIds((currentIds) =>
        currentIds.filter((documentId) => !visibleDocuments.some((document) => document.id === documentId)),
      )
      return
    }

    setSelectedDocumentIds((currentIds) => Array.from(new Set([...currentIds, ...visibleDocuments.map((document) => document.id)])))
  }

  const toggleDocumentSelection = (documentId: number) => {
    setSelectedDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((selectedId) => selectedId !== documentId)
        : [...currentIds, documentId],
    )
  }

  const deleteDocument = async (documentId: number) => {
    const confirmed = window.confirm('Czy na pewno chcesz usunąć tego kandydata?')

    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      await deleteDocuments([documentId])
      setOpenActionMenuId(null)
      setSelectedDocumentIds((currentIds) => currentIds.filter((selectedId) => selectedId !== documentId))
    } catch (error) {
      console.error('Nie udało się usunąć kandydata:', error)
      window.alert('Nie udało się usunąć kandydata. Spróbuj ponownie.')
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteSelectedDocuments = async () => {
    const idsToDelete = centralCandidatesList
      .filter((document) => selectedDocumentIds.includes(document.id))
      .map((document) => document.id)

    if (idsToDelete.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć ${idsToDelete.length} zaznaczonych kandydatów?`,
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      await deleteDocuments(idsToDelete)
      setSelectedDocumentIds([])
    } catch (error) {
      console.error('Nie udało się usunąć zaznaczonych kandydatów:', error)
      window.alert('Nie udało się usunąć zaznaczonych kandydatów. Spróbuj ponownie.')
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteAllVisibleDocuments = async () => {
    if (centralCandidatesList.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć wszystkich ${centralCandidatesList.length} kandydatów? Tej operacji nie można cofnąć.`,
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      await deleteAllDocuments()
      setSelectedDocumentIds([])
    } catch (error) {
      console.error('Nie udało się usunąć wszystkich kandydatów:', error)
      window.alert('Nie udało się usunąć wszystkich kandydatów. Spróbuj ponownie.')
    } finally {
      setIsDeleting(false)
    }
  }

  const downloadDocument = async (document: DocumentRecord) => {
    if (document.status !== 'SIGNED' || !document.backendId) {
      window.alert('Dokument można pobrać dopiero po podpisaniu.')
      return
    }

    setDownloadingDocumentId(document.id)

    try {
      await downloadSignedCandidateDocument(document.backendId, `filled_${document.role}.pdf`)
      setOpenActionMenuId(null)
    } catch (error) {
      console.error('Nie udało się pobrać dokumentu:', error)
      window.alert('Nie udało się pobrać podpisanego dokumentu. Spróbuj ponownie za chwilę.')
    } finally {
      setDownloadingDocumentId(null)
    }
  }

  return (
    <section className="documents-panel">
      <div className="panel-header">
        <div>
          <h2>Lejek dokumentów</h2>
          <p>Śledź każdego kandydata od wysyłki do podpisu.</p>
        </div>
        {centralCandidatesList.length > 0 && (
          <button
            className="panel-danger-button"
            type="button"
            disabled={isDeleting}
            onClick={() => void deleteAllVisibleDocuments()}
          >
            <Trash2 />
            Usuń wszystkich
          </button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="bulk-actions-bar">
          <span>Zaznaczono: {selectedCount}</span>
          <button
            className="panel-danger-button"
            type="button"
            disabled={isDeleting}
            onClick={() => void deleteSelectedDocuments()}
          >
            <Trash2 />
            Usuń zaznaczonych
          </button>
        </div>
      )}

      <div className="filters-row">
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DocumentStatus | 'ALL')}>
            <option value="ALL">Wszystkie</option>
            <option value="PENDING_GENERATION">Oczekuje na generowanie</option>
            <option value="DATA_COMPLETED">Dane uzupełnione</option>
            <option value="SENT">Wysłano</option>
            <option value="OPENED">Otwarto</option>
            <option value="OTP_VERIFIED">Zweryfikowano OTP</option>
            <option value="SIGNED">Podpisano</option>
          </select>
        </label>
        <label>
          <span>Typ umowy</span>
          <select
            value={contractTypeFilter}
            onChange={(event) => setContractTypeFilter(event.target.value)}
          >
            <option value="ALL">Wszystkie</option>
            {contractTypeOptions.map((contractType) => (
              <option key={contractType} value={contractType}>
                {contractType}
              </option>
            ))}
          </select>
        </label>
      </div>

      <table className="documents-table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              <input
                type="checkbox"
                aria-label="Zaznacz wszystko"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
              />
            </th>
            <th>Kandydat</th>
            <th>Stanowisko / dokument</th>
            <th>Status lejka</th>
            <th>Ostatnia zmiana</th>
            <th className="action-head">Akcja</th>
          </tr>
        </thead>
        <tbody>
          {visibleDocuments.length === 0 ? (
            <EmptyState
              variant="table"
              colSpan={6}
              message="Brak dostępnych dokumentów"
              description={
                centralCandidatesList.length === 0
                  ? 'Dokumenty pojawią się po dodaniu kandydatów do lejka.'
                  : 'Brak dokumentów pasujących do wybranych filtrów.'
              }
            />
          ) : (
            visibleDocuments.map((document, rowIndex) => {
            const shouldOpenMenuUp = rowIndex >= Math.max(visibleDocuments.length - 2, 0)

            return (
            <tr key={document.id} className="clickable-table-row" onClick={() => setDrawerDocument(document)}>
              <td className="checkbox-cell">
                <input
                  type="checkbox"
                  aria-label={document.candidateName}
                  checked={selectedDocumentIds.includes(document.id)}
                  onChange={() => toggleDocumentSelection(document.id)}
                  onClick={(event) => event.stopPropagation()}
                />
              </td>
              <td>
                <div className="candidate-cell">
                  <div className="candidate-avatar">{document.initials}</div>
                  <div>
                    <a className="candidate-name-link" href={`#kandydat-${document.id}`}>
                      {document.candidateName}
                    </a>
                    <a className="candidate-email-link" href={`mailto:${document.candidateEmail}`}>
                      {document.candidateEmail}
                    </a>
                  </div>
                </div>
              </td>
              <td>
                <div className="role-cell">
                  <p>{document.role}</p>
                  {document.company ? <span>{document.company}</span> : null}
                </div>
              </td>
              <td>
                <div className="pipeline">
                  {funnelStages.map((stage, index) => {
                    const Icon = stage.icon

                    return (
                      <div key={stage.status} className="pipeline-step">
                        {index > 0 && <span className="pipeline-line" />}
                        <button
                          className={`pipeline-dot ${getStageClass(document, stage)}`}
                          title={stage.label}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            updateDocumentStatus(document.id, stage.status)
                          }}
                        >
                          <Icon />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </td>
              <td>
                <div className="change-cell">
                  <p>{document.lastChange}</p>
                  <span className={`status-pill ${getStatusTone(document.status)}`}>
                    {statusLabels[document.status]}
                  </span>
                </div>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="icon-link"
                    type="button"
                    aria-label={`Akcje dla ${document.candidateName}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenActionMenuId((currentId) => (currentId === document.id ? null : document.id))
                    }}
                  >
                    <MoreHorizontal />
                  </button>

                  {openActionMenuId === document.id && (
                    <div
                      className={`table-actions-menu ${shouldOpenMenuUp ? 'table-actions-menu-up' : ''}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={downloadingDocumentId === document.id || document.status !== 'SIGNED'}
                        onClick={() => void downloadDocument(document)}
                      >
                        <Download />
                        {downloadingDocumentId === document.id ? 'Pobieranie...' : 'Pobierz dokument'}
                      </button>
                      <a href={`sms:${document.candidateEmail}`}>
                        <Bell />
                        Wyślij przypomnienie SMS
                      </a>
                      <button type="button" disabled={isDeleting} onClick={() => void deleteDocument(document.id)}>
                        <Trash2 />
                        Usuń
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
            )
          })
          )}
        </tbody>
      </table>
      <DocumentDrawer document={drawerDocument} onClose={() => setDrawerDocument(null)} />
    </section>
  )
}
