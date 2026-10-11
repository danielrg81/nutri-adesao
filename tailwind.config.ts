/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- ESSENCIAL: Permite alternar via classe 'dark' no HTML
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
