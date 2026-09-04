import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'

interface CollapsingHeaderProps {
  /** Large title at rest. */
  title: string
  subtitle?: string
  /** Compact title shown after scrolling. Defaults to title. */
  compactTitle?: string
  showBack?: boolean
  right?: ReactNode
}

/**
 * Large contextual title at rest, compact title after scroll (Section 2A.4).
 * Continuous and subtle; back control stays in a consistent position.
 */
export function CollapsingHeader({
  title,
  subtitle,
  compactTitle,
  showBack,
  right,
}: CollapsingHeaderProps) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* Compact bar (sticky, appears after scroll). */}
      <div
        className="sticky top-0 z-20 flex items-center gap-2 px-2 transition-[opacity,transform] duration-200"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? 'auto' : 'none',
        }}
      >
        <div className="flow-material flex h-12 w-full items-center gap-2 rounded-capsule px-2">
          {showBack && (
            <IconButton label="Back" onClick={() => navigate(-1)}>
              <ChevronLeft size={22} aria-hidden />
            </IconButton>
          )}
          <span className="flex-1 truncate text-section">{compactTitle ?? title}</span>
          {right}
        </div>
      </div>

      {/* Large resting title. */}
      <header
        className="px-5 pb-2 pt-3 transition-opacity duration-200"
        style={{ opacity: collapsed ? 0 : 1 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {showBack && (
              <IconButton
                label="Back"
                className="-ml-2 mb-1"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft size={24} aria-hidden />
              </IconButton>
            )}
            <h1 className="text-hero text-text-primary">{title}</h1>
            {subtitle && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
          </div>
          {right && <div className="pt-1">{right}</div>}
        </div>
      </header>
    </>
  )
}
