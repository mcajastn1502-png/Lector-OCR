/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Habilitar modo oscuro manual
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
      }
    },
  },
  plugins: [],
}