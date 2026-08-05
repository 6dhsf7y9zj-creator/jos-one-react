import type { ReactNode } from 'react'

type Tone = 'neutral' | 'positive' | 'warning' | 'urgent' | 'information'

type Props = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: Tone
  onClick?: () => void
  ariaLabel?: string
}

export function KpiCard({
  label,
  value,
  detail,
  tone = 'neutral',
  onClick,
  ariaLabel,
}: Props) {
  const content = (
    <>
      <span className="jos-kpi-label">{label}</span>
      <strong className="jos-kpi-value">{value}</strong>
      {detail && <small className="jos-kpi-detail">{detail}</small>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`jos-kpi-card jos-tone-${tone}`}
        onClick={onClick}
        aria-label={ariaLabel ?? label}
      >
        {content}
      </button>
    )
  }

  return <div className={`jos-kpi-card jos-tone-${tone}`}>{content}</div>
}
