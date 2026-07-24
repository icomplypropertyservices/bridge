/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        riddle: {
          bg: '#07070c',
          card: '#111118',
          border: '#1f1f2e',
          muted: '#8b8ba3',
          violet: '#8b5cf6',
          fuchsia: '#d946ef',
          cyan: '#22d3ee',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(139, 92, 246, 0.45)',
      },
    },
  },
  plugins: [],
}
