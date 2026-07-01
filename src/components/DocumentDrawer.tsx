import { CheckCircle2, MailCheck, Send, ShieldCheck, X, type LucideIcon } from 'lucide-react'
import type { DocumentRecord, DocumentStatus } from '../context/AppContext'
import { formatStatusTime } from '../utils/formatStatusTime'

interface DocumentDrawerProps {
  document: DocumentRecord | null
  onClose: () => void
}

interface TimelineItem {
  label: string
  status: DocumentStatus
  description: string
  icon: LucideIcon
  timestampKey: 'sentAt' | 'openedAt' | 'otpVerifiedAt' | 'signedAt'
}

const timelineItems: TimelineItem[] = [
  {
    label: 'Wysłano',
    status: 'SENT',
    description: 'Dokument został wysłany na adres e-mail kandydata.',
    icon: Send,
    timestampKey: 'sentAt',
  },
  {
    label: 'Otwarto',
    status: 'OPENED',
    description: 'Kandydat otworzył bezpieczny link do dokumentu.',
    icon: MailCheck,
    timestampKey: 'openedAt',
  },
  {
    label: 'Zweryfikowano OTP',
    status: 'OTP_VERIFIED',
    description: 'Tożsamość została potwierdzona jednorazowym kodem OTP.',
    icon: ShieldCheck,
    timestampKey: 'otpVerifiedAt',
  },
  {
    label: 'Podpisano',
    status: 'SIGNED',
    description: 'Dokument został podpisany i zapisany w historii audytu.',
    icon: CheckCircle2,
    timestampKey: 'signedAt',
  },
]

const statusOrder: Record<DocumentStatus, number> = {
  PENDING_GENERATION: -1,
  DATA_COMPLETED: 0,
  SENT: 1,
  OPENED: 2,
  OTP_VERIFIED: 3,
  SIGNED: 4,
}

function getTimelineTime(document: DocumentRecord, item: TimelineItem): string {
  const rawTimestamp = document[item.timestampKey]
  return formatStatusTime(rawTimestamp)
}

export function DocumentDrawer({ document, onClose }: DocumentDrawerProps) {
  if (!document) {
    return null
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="document-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" type="button" aria-label="Zamknij szczegóły" onClick={onClose}>
          <X />
        </button>

        <div className="drawer-candidate">
          <div className="candidate-profile-avatar">{document.initials}</div>
          <div>
            <p>Szczegóły dokumentu</p>
            <h2>{document.candidateName}</h2>
            <span>{document.role} • {document.contractType}</span>
          </div>
        </div>

        <section className="drawer-section">
          <h3>Historia statusów</h3>
          <div className="drawer-timeline">
            {timelineItems.map((item) => {
              const Icon = item.icon
              const isPreFunnel = document.status === 'PENDING_GENERATION' || document.status === 'DATA_COMPLETED'
              const isReached = !isPreFunnel && statusOrder[item.status] <= statusOrder[document.status]
              const formattedTime = getTimelineTime(document, item)

              return (
                <article key={item.status} className={isReached ? 'timeline-item timeline-item-done' : 'timeline-item'}>
                  <div>
                    <Icon />
                  </div>
                  <main>
                    <strong>{item.label}</strong>
                    <span>{isReached ? formattedTime || '—' : 'oczekuje'}</span>
                    <p>{item.description}</p>
                  </main>
                </article>
              )
            })}
          </div>
        </section>
      </aside>
    </div>
  )
}
