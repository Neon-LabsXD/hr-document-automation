interface EmptyStateProps {
  message: string
  description?: string
  variant?: 'standalone' | 'table'
  colSpan?: number
}

export function EmptyState({ message, description, variant = 'standalone', colSpan = 1 }: EmptyStateProps) {
  if (variant === 'table') {
    return (
      <tr className="empty-state-row">
        <td colSpan={colSpan}>
          <div className="empty-state empty-state-table">
            <p className="empty-state-message">{message}</p>
            {description ? <p className="empty-state-description">{description}</p> : null}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <section className="empty-state">
      <p className="empty-state-message">{message}</p>
      {description ? <p className="empty-state-description">{description}</p> : null}
    </section>
  )
}
