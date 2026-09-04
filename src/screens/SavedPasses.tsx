import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, MapPin } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { CollapsingHeader } from '@/components/shell/CollapsingHeader'
import { PageTransition } from '@/components/shell/PageTransition'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { Surface } from '@/components/ui/Surface'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { listSavedPasses } from '@/lib/api'
import { formatMYR } from '@/lib/format'
import type { SavedPassRow } from '@/lib/types'

export function SavedPasses() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<SavedPassRow[] | null>(null)

  useEffect(() => {
    let alive = true
    listSavedPasses().then((r) => {
      if (alive) setRows(r)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <AppShell>
      <PageTransition>
        <CollapsingHeader title="My Passes" compactTitle="My Passes" right={<ThemeToggle />} />

        <div className="space-y-3 px-5">
          {rows === null && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}

          {rows !== null && rows.length === 0 && (
            <EmptyState
              icon={<Bookmark size={32} aria-hidden />}
              title="No passes yet"
              description="Every Date Pass you create shows up here so you can reopen or reshare it."
              action={<Button onClick={() => navigate('/create')}>Create your first pass</Button>}
            />
          )}

          {rows?.map((row) => (
            <Surface
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/pass/${row.share_hash}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/pass/${row.share_hash}`)}
              className="cursor-pointer p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-section text-text-primary">
                    {row.title ?? row.neighborhood}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-meta text-text-secondary">
                    <MapPin size={13} aria-hidden />
                    {row.neighborhood} · {row.pax} pax
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-section tabular text-text-primary">
                    {formatMYR(row.total_budget_estimate)}
                  </span>
                  <span className="text-micro text-text-tertiary">
                    {row.overall_confidence ?? '—'}% conf.
                  </span>
                </span>
              </div>
            </Surface>
          ))}
        </div>
      </PageTransition>
    </AppShell>
  )
}
