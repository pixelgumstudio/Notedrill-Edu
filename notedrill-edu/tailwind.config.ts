import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/layout/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'source-serif': ['var(--font-source-serif)', 'ui-serif', 'Georgia', 'serif'],
        'ibm-plex-mono': ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        edu: {
          ink: '#1c1917',
          paper: '#faf7f2',
          'paper-2': '#f0ebe0',
          line: '#e2d9cc',
          moss: '#3b7a57',
          'moss-dark': '#2a5c40',
          'moss-light': '#e8f4ed',
          gold: '#c28a27',
          'gold-light': '#fdf6e3',
          red: '#c0392b',
          'red-light': '#fde8e6',
          'blue-grey': '#64748b',
        },
        brand: {
          25: '#f2f7ff', 50: '#ecf3ff', 100: '#dde9ff', 200: '#c2d6ff',
          300: '#9cb9ff', 400: '#7592ff', 500: '#465fff', 600: '#3641f5',
          700: '#2a31d8', 800: '#252dae', 900: '#262e89', 950: '#161950',
        },
        success: {
          25: '#f6fef9', 50: '#ecfdf3', 100: '#d1fadf', 200: '#a6f4c5',
          300: '#6ce9a6', 400: '#32d583', 500: '#12b76a', 600: '#039855',
          700: '#027a48', 800: '#05603a', 900: '#054f31', 950: '#053321',
        },
        error: {
          25: '#fffbfa', 50: '#fef3f2', 100: '#fee4e2', 200: '#fecdca',
          300: '#fda29b', 400: '#f97066', 500: '#f04438', 600: '#d92d20',
          700: '#b42318', 800: '#912018', 900: '#7a271a', 950: '#55160c',
        },
        warning: {
          25: '#fffcf5', 50: '#fffaeb', 100: '#fef0c7', 200: '#fedf89',
          300: '#fec84b', 400: '#fdb022', 500: '#f79009', 600: '#dc6803',
          700: '#b54708', 800: '#93370d', 900: '#7a2e0e', 950: '#4e1d09',
        },
        gray: {
          25: '#fcfcfd', 50: '#f9fafb', 100: '#f2f4f7', 200: '#e4e7ec',
          300: '#d0d5dd', 400: '#98a2b3', 500: '#667085', 600: '#475467',
          700: '#344054', 800: '#1d2939', 900: '#101828', 950: '#0c111d',
          dark: '#1a2231',
        },
      },
      fontSize: {
        'theme-xs': ['12px', { lineHeight: '18px' }],
        'theme-sm': ['14px', { lineHeight: '20px' }],
        'theme-xl': ['20px', { lineHeight: '30px' }],
      },
      zIndex: {
        '9': '9', '99': '99', '999': '999',
        '9999': '9999', '99999': '99999', '999999': '999999',
      },
    },
  },
  plugins: [typography],
};

export default config;
