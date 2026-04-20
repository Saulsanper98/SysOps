/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark ops base palette
        ops: {
          950: "#060a14",
          900: "#0a0e1a",
          850: "#0d1220",
          800: "#111827",
          750: "#141d2e",
          700: "#1a2540",
          600: "#1e2d45",
          500: "#243352",
          400: "#2d4066",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          light: "#60a5fa",
          dim: "#1d4ed8",
        },
        status: {
          ok: "#10b981",
          warning: "#f59e0b",
          critical: "#ef4444",
          unknown: "#6b7280",
          degraded: "#f97316",
        },
        severity: {
          critica: "#ef4444",
          alta: "#f97316",
          media: "#f59e0b",
          baja: "#3b82f6",
          info: "#6b7280",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-in",
        "slide-up": "slideUp 0.2s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(8px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
      },
    },
  },
  plugins: [],
};
