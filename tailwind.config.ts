import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Syne", "system-ui", "sans-serif"],
      },
      colors: {
        bg: {
          primary: "#0F172A",
          secondary: "#1E293B",
          tertiary: "#162032",
          card: "#243044",
        },
        brand: {
          green: "#22C55E",
          green2: "#16A34A",
          green3: "#4ADE80",
          dark: "#14532D",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.35s ease forwards",
        "pulse-slow": "pulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
