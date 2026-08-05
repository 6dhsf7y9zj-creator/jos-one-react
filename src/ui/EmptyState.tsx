import type { ReactNode } from 'react'

type Props = {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon = '◇' }: Props) {
  return (
    <section className="jos-empty-state">
      <span className="jos-empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="jos-empty-action">{action}</div>}
    </section>
  )
}
