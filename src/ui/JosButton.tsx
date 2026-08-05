import type { ButtonHTMLAttributes, ReactNode } from 'react'

type JosButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: JosButtonVariant
  fullWidth?: boolean
  icon?: ReactNode
}

export function JosButton({
  variant = 'secondary',
  fullWidth = false,
  icon,
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      className={`jos-button jos-button-${variant} ${fullWidth ? 'jos-button-full' : ''} ${className}`.trim()}
      {...props}
    >
      {icon && <span className="jos-button-icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
