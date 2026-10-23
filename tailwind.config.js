/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{vue,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#09090b',   // zinc-950
          panel: '#18181b',     // zinc-900
          elevated: 'rgba(39, 39, 42, 0.6)', // zinc-800/60
          border: '#27272a'     // zinc-800
        },
        accent: {
          DEFAULT: '#6366f1',   // indigo-500
          hover: '#818cf8',     // indigo-400
          muted: 'rgba(99, 102, 241, 0.15)'
        },
        success: {
          DEFAULT: '#10b981',   // emerald-500
          hover: '#34d399',     // emerald-400
          muted: 'rgba(16, 185, 129, 0.15)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
