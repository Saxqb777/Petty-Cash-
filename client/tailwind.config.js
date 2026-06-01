/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Agthia brand — sage/olive leaf green sampled from the logo mark
        brand: {
          50:  '#f5f8ef',
          100: '#e8f1d9',
          200: '#d2e3b6',
          300: '#b5cf8a',
          400: '#98ba60',
          500: '#7ba046',  // logo leaf green
          600: '#62833a',  // primary actions / buttons
          700: '#4c6730',
          800: '#3e532a',
          900: '#354626',
          950: '#1a2611'
        }
      },
      boxShadow: {
        card:         '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 24px 0 rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)',
        glow:         '0 0 24px 0 rgba(123,160,70,0.30)',
        'glow-sm':    '0 0 12px 0 rgba(123,160,70,0.22)',
      },
      backgroundImage: {
        'dots-pattern': "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23ffffff' fill-opacity='0.08'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' }
        },
      },
      animation: {
        shimmer:    'shimmer 1.8s infinite linear',
        'slide-up': 'slide-up 0.22s ease-out',
        'fade-in':  'fade-in 0.18s ease-out',
      }
    }
  },
  plugins: []
};
