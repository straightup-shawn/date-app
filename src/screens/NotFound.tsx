import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <AppShell>
      <EmptyState
        title="Nothing here"
        description="That page doesn't exist. Head back to Explore to plan something."
        action={<Button onClick={() => navigate('/')}>Go to Explore</Button>}
      />
    </AppShell>
  )
}
