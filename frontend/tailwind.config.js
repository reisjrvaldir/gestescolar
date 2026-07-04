/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base clara / off-white
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        // Azul primário
        primary: {
          DEFAULT: '#2563EB',
          soft: '#EFF4FF',
          hover: '#1D4ED8',
          ink: '#1E3A8A',
        },
        // Verde-água secundário
        accent: {
          DEFAULT: '#0EA5A4',
          soft: '#E6FAF8',
        },
        // Roxo (gradiente / destaques)
        purple: { DEFAULT: '#7C3AED', soft: '#F3EEFF' },
        // CTA verde
        cta: { DEFAULT: '#16A34A', hover: '#15803D' },
        // Texto azul-marinho escuro
        ink: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
          subtle: '#94A3B8',
        },
        // Estados
        success: { DEFAULT: '#16A34A', soft: '#E7F6EC' },
        warning: { DEFAULT: '#D97706', soft: '#FEF6E7' },
        danger:  { DEFAULT: '#DC2626', soft: '#FDECEC', hover: '#B91C1C' },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        'card-hover': '0 8px 24px rgba(15,23,42,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
