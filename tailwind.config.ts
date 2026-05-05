import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        accent: "#10b981",
        "accent-bright": "#34d399",
        surface: "#08090f",
        "surface-2": "#0c0f1a",
        positive: "#10b981",
        negative: "#f43f5e"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Segoe UI", "system-ui", "sans-serif"]
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 0.25s ease both",
        shimmer: "shimmer 1.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
