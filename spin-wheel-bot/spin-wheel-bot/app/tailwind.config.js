/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        festiveRed: '#C62828',
        festiveGold: '#F9A825',
        festiveDark: '#4E342E',
      },
    },
  },
  plugins: [],
};
