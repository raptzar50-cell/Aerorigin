/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mantis Chart Palette (from codedthemes mantis-free-react-admin-template)
        mantis: {
          primary: '#1677ff',
          'primary-hover': '#0958d9',
          'primary-light': 'rgba(22, 119, 255, 0.12)',
          'primary-subtle': 'rgba(22, 119, 255, 0.05)',
          secondary: '#13c2c2',
          'secondary-light': 'rgba(19, 194, 194, 0.12)',
          success: '#52c41a',
          'success-light': 'rgba(82, 196, 26, 0.12)',
          warning: '#faad14',
          'warning-light': 'rgba(250, 173, 20, 0.12)',
          danger: '#ff4d4f',
          'danger-light': 'rgba(255, 77, 79, 0.12)',
          purple: '#722ed1',
          'purple-light': 'rgba(114, 46, 209, 0.12)',
          slate: '#8c8c8c',
          band: 'rgba(22, 119, 255, 0.14)',
        },
        // AdminKit Layout Surfaces (from adminkit admin template)
        adminkit: {
          bg: '#f5f7fb',
          'bg-dark': '#0f0f0e',
          card: '#ffffff',
          'card-dark': '#1a1a18',
          sidebar: '#1D1D1B',
          'sidebar-hover': 'rgba(255, 255, 255, 0.07)',
          'sidebar-active': 'rgba(255, 230, 0, 0.12)',
          border: 'rgba(226, 232, 240, 0.8)',
          'border-dark': '#2e2e2a',
        },
      },
      boxShadow: {
        'adminkit': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.05)',
        'adminkit-md': '0 0.5rem 1.25rem rgba(0, 0, 0, 0.06)',
        'mantis-tooltip': '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        'adminkit': '0.75rem',
      },
    },
  },
  plugins: [],
}
