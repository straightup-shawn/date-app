import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Sun, MoonStar, Users } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { CollapsingHeader } from '@/components/shell/CollapsingHeader'
import { PageTransition } from '@/components/shell/PageTransition'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { Surface } from '@/components/ui/Surface'
import { Button } from '@/components/ui/Button'
import { springMicro } from '@/lib/motion'

const IDEAS = [
  { icon: MoonStar, title: 'What should we do tonight?', hint: 'Evening · nearby · relaxed' },
  { icon: Sun, title: 'Plan tomorrow afternoon', hint: 'Daytime · explore · walkable' },
  { icon: Users, title: 'Something for the group', hint: 'Activity-focused · 4+ pax' },
]

/** Explore: content-first landing. One clear action: start creating. */
export function Explore() {
  const navigate = useNavigate()

  const greeting = getGreeting()

  return (
    <AppShell>
      <PageTransition>
        <CollapsingHeader
          title={greeting}
          subtitle="Plan something worth going out for."
          compactTitle="Explore"
          right={<ThemeToggle />}
        />

        <div className="space-y-3 px-5">
          {IDEAS.map((idea, i) => (
            <motion.div
              key={idea.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springMicro, delay: i * 0.04 }}
            >
              <Surface
                className="flex cursor-pointer items-center gap-4 p-4"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/create')}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/create')}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent/12 text-accent">
                  <idea.icon size={22} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-section text-text-primary">
                    {idea.title}
                  </span>
                  <span className="block text-meta text-text-secondary">{idea.hint}</span>
                </span>
              </Surface>
            </motion.div>
          ))}

          <div className="pt-4">
            <Button fullWidth onClick={() => navigate('/create')}>
              <Sparkles size={18} aria-hidden />
              Create a Date Pass
            </Button>
            <p className="mt-3 text-center text-meta text-text-tertiary">
              Plan a night out in any city or neighborhood.
            </p>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
