/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' em vez de 'media': o NativeWind 4 lança erro na web com 'media'.
  // No nativo o tema segue o sistema; na web, useSyncWebColorScheme aplica a classe.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
