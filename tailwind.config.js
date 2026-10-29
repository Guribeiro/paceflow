/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'media' segue o tema do sistema operacional.
  darkMode: 'media',
  theme: {
    extend: {},
  },
  plugins: [],
};
