const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,tsx}',
    './src/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}'
  ],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        // Only specify Inter_400Regular, remove fallback spread
        sans: ['Inter_400Regular'], 
      },
    },
  },
  plugins: [],
};
