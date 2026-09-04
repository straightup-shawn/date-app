// ============================================================
// Flow v7.1 — Theme: default to OS preference, allow manual toggle.
// ============================================================
import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b0b0f' : '#f6f6f4')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('flow-theme') as Theme | null
    return saved ?? systemTheme()
  })

  useEffect(() => {
    apply(theme)
  }, [theme])

  // Follow OS changes only when the user hasn't chosen manually.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!localStorage.getItem('flow-theme')) setTheme(systemTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('flow-theme', next)
      return next
    })
  }, [])

  return { theme, toggle }
}
