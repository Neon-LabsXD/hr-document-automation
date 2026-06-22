import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  description: string
  delta: string
  icon: LucideIcon
}

export function MetricCard({ label, value, description, delta, icon: Icon }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-header">
        <p>{label}</p>
        <div className="metric-icon">
          <Icon />
        </div>
      </div>
      <div className="metric-body">
        <div>
          <strong>{value}</strong>
          <span>{description}</span>
        </div>
        <em>{delta}</em>
      </div>
    </article>
  )
}
