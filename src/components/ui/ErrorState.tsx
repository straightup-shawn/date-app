import type { ReactNode } from 'react'

interface ErrorStateProps {
  title: string
  /** Human explanation. Never raw API/provider wording (Section 2A.14). */
  description: string
  action?: ReactNode
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <h2 className="text-section text-text-primary">{title}</h2>
      <p className="max-w-[36ch] text-body text-text-secondary">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
