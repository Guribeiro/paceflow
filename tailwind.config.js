/** @type {import('tailwindcss').Config} */
// Tons claro (DEFAULT) e escuro (-dark) de cada cor: `bg-surface dark:bg-surface-dark`.
// Os mesmos hex ficam em src/components/ui/palette.ts para o que só aceita cor em JS;
// palette.test.ts confere que batem e que o contraste continua AA.
const tone = (light, dark) => ({ DEFAULT: light, dark });

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' em vez de 'media': o NativeWind 4 lança erro na web com 'media'.
  // No nativo o tema segue o sistema; na web, useSyncWebColorScheme aplica a classe.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: tone('#F4F4F5', '#0B0B0C'),
        surface: tone('#FFFFFF', '#1A1A1D'),
        'surface-2': tone('#E9E9EC', '#26262A'),
        ink: tone('#111111', '#FFFFFF'),
        muted: tone('#4A4A4F', '#C8C8CC'),
        bar: tone('#8A8A90', '#6E6E75'),
        // Laranja PaceFlow: `brand` é fundo com texto branco; `brand-ink` é o laranja
        // usado como texto, ícone ou barra; `brand-soft` é fundo de destaque leve.
        brand: tone('#D1440C', '#D1440C'),
        'brand-ink': tone('#B33A0A', '#FF7A3D'),
        'brand-soft': tone('#FFE8DD', '#3A1A0C'),
      },
    },
  },
  plugins: [],
};
