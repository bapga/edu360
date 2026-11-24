/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 950: '#071a33', 900: '#0b2545', 800: '#13315c', 700: '#1b4278', 600: '#2a5a9b' },
        brand: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        surface: '#f4f6fa',
      },
    },
  },
  plugins: [],
}
