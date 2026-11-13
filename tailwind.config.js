const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        elevated: v('elevated'),
        line: v('line'),
        fg: v('fg'),
        muted: v('muted'),
        accent: v('accent'),
        accent2: v('accent2'),
        success: '#34d399',
        danger: '#f43f5e',
        warn: '#fbbf24'
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Inter Variable"', 'sans-serif']
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / .35), 0 8px 40px -8px rgb(var(--accent) / .55)',
        card: '0 10px 30px -12px rgb(0 0 0 / .6)'
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent2)) 100%)'
      }
    }
  },
  plugins: []
}
