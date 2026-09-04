import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}

/** Explain the empty state and offer the next action (Section 2A.14). */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-text-tertiary">{icon}</div>}
      <h2 className="text-section text-text-primary">{title}</h2>
      <p className="max-w-[32ch] text-body text-text-secondary">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
