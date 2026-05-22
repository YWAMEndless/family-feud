/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        feud: {
          navy: '#0B1437',
          blue: '#1a3c7f',
          bright: '#1d5db8',
          gold: '#f5c842',
          darkgold: '#c99a00',
          red: '#dc2626',
        },
      },
      fontFamily: {
        display: ['Impact', 'Arial Black', 'sans-serif'],
      },
      animation: {
        'reveal': 'reveal 0.5s ease-out forwards',
        'strike': 'strike 0.3s ease-out forwards',
        'pulse-gold': 'pulseGold 1s ease-in-out infinite',
        'slide-down': 'slideDown 0.4s ease-out forwards',
        'score-pop': 'scorePop 0.4s ease-out forwards',
      },
      keyframes: {
        reveal: {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        strike: {
          '0%': { transform: 'scale(0) rotate(-45deg)', opacity: '0' },
          '60%': { transform: 'scale(1.3) rotate(5deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 10px #f5c842' },
          '50%': { boxShadow: '0 0 25px #f5c842, 0 0 50px #f5c842' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scorePop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
