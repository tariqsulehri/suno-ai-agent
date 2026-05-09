import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Segoe UI', '-apple-system', 'BlinkMacSystemFont',
          'Inter', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        // Page / shell
        surface: {
          DEFAULT: '#F8FAFC',
          card:    '#FFFFFF',
          raised:  '#F1F5F9',
          border:  '#E2E8F0',
          hover:   '#F8FAFC',
        },
        ms: {
          // Primary — driven by CSS vars so parent-page theme is inherited
          blue:      'rgb(var(--va-primary)    / <alpha-value>)',
          'blue-dk': 'rgb(var(--va-primary-dk) / <alpha-value>)',
          'blue-lt': 'rgb(var(--va-primary-lt) / <alpha-value>)',
          'blue-md': 'rgb(var(--va-primary-md) / <alpha-value>)',
          // Secondary — teal
          teal:      '#0D9488',
          'teal-dk': '#0F766E',
          'teal-lt': '#F0FDFA',
          'teal-md': '#CCFBF1',
          // Neutrals
          text:      '#0F172A',
          sub:       '#475569',
          muted:     '#64748B',
          border:    '#E2E8F0',
          red:       '#DC2626',
          green:     '#16A34A',
          amber:     '#D97706',
        },
      },
      boxShadow: {
        card:   '0 2px 8px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06)',
        bubble: '0 1px 2px rgba(0,0,0,0.08)',
        header: '0 2px 6px rgba(0,0,0,0.12)',
        input:  '0 -1px 0 #EDEBE9',
      },
      keyframes: {
        pulse_dot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
        ring: {
          '0%':   { boxShadow: '0 0 0 0 rgba(196,49,75,0.4)' },
          '70%':  { boxShadow: '0 0 0 12px rgba(196,49,75,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(196,49,75,0)' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%':           { transform: 'translateY(-4px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulse_dot: 'pulse_dot 1.4s ease-in-out infinite',
        ring:      'ring 1.4s ease-out infinite',
        typing:    'typing 1.2s ease-in-out infinite',
        'fade-up': 'fade-up 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
