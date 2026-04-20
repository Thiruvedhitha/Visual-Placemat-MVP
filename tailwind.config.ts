import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd7ff",
          300: "#8ebfff",
          400: "#599dff",
          500: "#3478f6",
          600: "#1d5aeb",
          700: "#1545d8",
          800: "#1839af",
          900: "#1a338a",
          950: "#142154",
        },
        navy: {
          700: "#2c3e5a",
          800: "#1e3050",
          900: "#1a2a44",
          950: "#0f1b2d",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
