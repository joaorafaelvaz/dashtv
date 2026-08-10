import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /**
         * Ouro amostrado do logo oficial (public/logo-barbearia-vip.png):
         * #D9B437 é a cor dominante do arquivo. Os valores anteriores
         * (#D4AF37 / #FFD700) não correspondiam à marca.
         */
        gold: {
          DEFAULT: '#D9B437',
          light: '#E9CC6B',
          dim: 'rgba(217,180,55,0.20)',
          faint: 'rgba(217,180,55,0.06)',
        },
        ink: '#0A0A0B',
        surface: '#101013',
        surface2: '#16161A',
        fg: {
          DEFAULT: '#FAFAFA',
          muted: '#9A9AA2',
          dim: '#5E5E66',
        },
        /**
         * Semântica em duas cores. O âmbar é território da marca — usá-lo para
         * "atenção" competiria com o accent, então o estado intermediário fica
         * neutro (branco).
         */
        pos: '#4EC77F',
        neg: '#F0584A',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
