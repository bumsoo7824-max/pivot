import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#bcd3ff",
          300: "#8fb6ff",
          400: "#5c8fff",
          500: "#3466f6",
          600: "#2247e0",
          700: "#1c37b5",
          800: "#1c3092",
          900: "#1c2c73",
        },
      },
    },
  },
  plugins: [],
};

export default config;
