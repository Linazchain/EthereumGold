import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        black: '#0A0A0A',
        surface: '#111111',
        'surface-2': '#171717',
        gold: '#F0B90B',
        'gold-dim': '#C99A08',
        white: '#F5F5F5',
        muted: '#8A8A8A',
        'muted-2': '#5A5A5A',
        border: '#252525',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['48px', '56px'],
        'section': ['24px', '32px'],
        'body': ['14px', '21px'],
        'metadata': ['11px', '16px'],
        'numbers': ['32px', '40px'],
      },
    },
  },
  plugins: [],
}
export default config
