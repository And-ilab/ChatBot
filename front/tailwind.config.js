/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nav-bg': '#0d0d0d',
        'custom-gray': 'rgba(158, 158, 158, 0.1)'
      },
    },
  },
  plugins: [],
}

