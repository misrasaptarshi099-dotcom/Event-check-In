import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#FBF9F4',
          dim: '#DCDAD5',
          low: '#F6F3EE',
          container: '#F0EEE9',
          high: '#EAE8E3',
          highest: '#E4E2DD',
        },
        primary: {
          DEFAULT: '#0F0F0F',
          container: '#1C1B1B',
        },
        accent: {
          DEFAULT: '#D93614',
          hover: '#B32000',
        },
        'muted-text': '#8C8A85',
        'border-rigid': '#0F0F0F',
      },
      fontFamily: {
        serif: ['"PP Editorial New"', 'var(--font-playfair-display)', 'Playfair Display', 'Georgia', 'serif'],
        mono: ['var(--font-geist-mono)', 'Geist Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0px',
        none: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        full: '0px',
      },
      spacing: {
        'row-height': '80px',
        'input-height': '64px',
      },
    },
  },
  plugins: [],
};

export default config;
