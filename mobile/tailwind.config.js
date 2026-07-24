/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A56DB',
          dark: '#1344B3',
          soft: '#EBF2FF',
        },
        success: { DEFAULT: '#16A34A', soft: '#DCFCE7' },
        danger:  { DEFAULT: '#DC2626', soft: '#FEE2E2' },
        warning: { DEFAULT: '#D97706', soft: '#FEF3C7' },
        ink: {
          DEFAULT: '#111827',
          muted:   '#6B7280',
          subtle:  '#9CA3AF',
        },
        border:  '#E5E7EB',
        canvas:  '#F9FAFB',
        surface: '#FFFFFF',
      },
    },
  },
  plugins: [],
};
