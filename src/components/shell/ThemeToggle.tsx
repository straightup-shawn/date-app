import { Sun, MoonStar } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { useTheme } from '@/lib/useTheme'

/** Reusable light/dark toggle for any screen header. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <IconButton
      label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun size={20} /> : <MoonStar size={20} />}
    </IconButton>
  )
}
