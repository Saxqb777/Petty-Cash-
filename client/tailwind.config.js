/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f5f8ef',
          100: '#e8f1d9',
          200: '#d2e3b6',
          300: '#b5cf8a',
          400: '#98ba60',
          500: '#7ba046',
          600: '#62833a',
          700: '#4c6730',
          800: '#3e532a',
          900: '#354626',
          950: '#1a2611'
        },
        // Warm paper palette
        paper: {
          50:  '#FDFBF8',
          100: '#FAF8F4',
          200: '#F4F1EC',
          300: '#EDE8E0',
          400: '#E8E3DB',
          500: '#DDD6CB',
          600: '#C8C3BC',
        },
        // Warm ink palette
        ink: {
          900: '#1A1814',
          800: '#2C2820',
          700: '#3D3830',
          600: '#504A43',
          500: '#6B6560',
          400: '#857F79',
          300: '#9C9590',
          200: '#B5B0AA',
          100: '#C8C3BC',
        }
      },
      boxShadow: {
        card:         '0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.03)',
        'card-hover': '0 4px 16px 0 rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)',
        'modal':      '0 20px 60px -10px rgba(0,0,0,0.15)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' }
        },
      },
      animation: {
        shimmer:    'shimmer 1.8s infinite linear',
        'slide-up': 'slide-up 0.20s ease-out',
        'fade-in':  'fade-in 0.16s ease-out',
      }
    }
  },
  plugins: []
};
