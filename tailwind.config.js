/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
colors: {
        canvas: "#07130D",
        panel: "#0B1B14",
        "panel-2": "#0F241A",
        "panel-3": "#143026",
        accent: "#10B981",
        "accent-deep": "#059669",
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(16,185,129,0.55)" },
          "50%": { opacity: "0.65", boxShadow: "0 0 12px 3px rgba(16,185,129,0.35)" },
        },
        "fade-slide-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 1.8s ease-in-out infinite",
        "fade-slide": "fade-slide 0.18s ease-out",
      },
    },
  },
  plugins: [],
};