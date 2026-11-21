/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        calm: {
          bg: 'var(--bg-base)',
          card: 'var(--bg-card)',
          surface: 'var(--bg-surface)',
          border: 'var(--border-color)',
          text: 'var(--text-primary)',
          muted: 'var(--text-secondary)',
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
        },
        navy: {
          950: '#0B1120',
          900: '#1E293B',
          800: '#263449',
          700: '#334155',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
