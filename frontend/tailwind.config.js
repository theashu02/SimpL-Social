import daisyui from 'daisyui'
import daisyUIThemes from 'daisyui/src/theming/themes'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [daisyui],

  daisyui: {
    themes: [
      "light",
      {
        black: {
          ...daisyUIThemes["coffee"],
          primary: "25D366",
          secondry: "rgb(24,24,24)",
        },
      },
    ],
  },
};
