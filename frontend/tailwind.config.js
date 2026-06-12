/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas) / <alpha-value>)',
          raised:  'rgb(var(--color-canvas-raised) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          muted:   'rgb(var(--color-surface-muted) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--color-line) / <alpha-value>)',
          strong:  'rgb(var(--color-line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          muted:   'rgb(var(--color-ink-muted) / <alpha-value>)',
          faint:   'rgb(var(--color-ink-faint) / <alpha-value>)',
        },
        sidebar: {
          bg:     'rgb(var(--sidebar-bg) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border) / <alpha-value>)',
        },
        // Brand: Tailwind `orange` palette. Every existing `bg-primary-*`,
        // `text-primary-*`, `border-primary-*`, `ring-primary-*` class in the
        // app keeps working — only the resolved color changes. Use the dark
        // mode picks from this palette via `dark:bg-primary-400` etc.
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        success: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
      fontFamily: {
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Cascadia Code"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        card:  '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.04)',
        soft:  '0 4px 12px -2px rgb(0 0 0 / 0.08)',
        panel: '0 0 0 1px rgb(0 0 0 / 0.04), 0 8px 24px -4px rgb(0 0 0 / 0.08)',
        glow:  '0 0 0 3px rgb(249 115 22 / 0.25)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer:  'shimmer 1.5s infinite linear',
        'fade-in': 'fade-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
