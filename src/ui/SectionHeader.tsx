import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  compact = false,
}: Props) {
  return (
    <div className={`jos-section-header ${compact ? 'compact' : ''}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="jos-section-description">{description}</p>}
      </div>
      {action && <div className="jos-section-action">{action}</div>}
    </div>
  )
}
