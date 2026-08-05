import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0b1020", 800: "#111831", 700: "#1a2340", 600: "#243154" },
        signal: { red: "#f0526d", amber: "#f5a524", green: "#3ecf8e", blue: "#57a6ff" },
        pivot: { 500: "#2dd4bf", 600: "#14b8a6" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
