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
        'custom-gray': 'rgba(158, 158, 158, 0.1)',
        'send-btn-bg': '#9b9b9b',
        'not-send-btn-bg': '#2d2d2d',
        'chat-input': '#3c3b3b' 
      },
    },
  },
  plugins: [],
}

