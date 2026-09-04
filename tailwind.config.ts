import type { Config } from 'tailwindcss'

/**
 * Flow design tokens (Section 2A.9-2A.11).
 * Colors are driven by CSS variables so light/dark mode is a single source of truth.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-contrast': 'var(--accent-contrast)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
      },
      borderRadius: {
        control: '11px',
        card: '18px',
        sheet: '26px',
        capsule: '9999px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        hero: ['33px', { lineHeight: '1.1', fontWeight: '700' }],
        title: ['26px', { lineHeight: '1.15', fontWeight: '650' }],
        section: ['19px', { lineHeight: '1.25', fontWeight: '620' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '450' }],
        meta: ['13.5px', { lineHeight: '1.4', fontWeight: '500' }],
        micro: ['11.5px', { lineHeight: '1.3', fontWeight: '600' }],
      },
      boxShadow: {
        float: '0 8px 30px rgba(0,0,0,.10)',
        sheet: '0 -8px 40px rgba(0,0,0,.16)',
      },
    },
  },
  plugins: [],
} satisfies Config
