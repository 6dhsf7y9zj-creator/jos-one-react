import type { ReactNode } from 'react'

type Tone = 'positive' | 'warning' | 'urgent' | 'information'

type Props = {
  title: string
  children?: ReactNode
  tone?: Tone
  onDismiss?: () => void
}

export function NoticeCard({
  title,
  children,
  tone = 'information',
  onDismiss,
}: Props) {
  return (
    <section className={`jos-notice jos-tone-${tone}`} role="status">
      <span className="jos-notice-dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {children && <div className="jos-notice-copy">{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss notice">×</button>
      )}
    </section>
  )
}
