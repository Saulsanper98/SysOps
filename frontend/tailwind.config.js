/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      maxWidth: {
        content: "min(100%, 88rem)",
        prose: "65ch",
      },
      zIndex: {
        dropdown: "50",
        "cmd-palette": "60",
        modal: "70",
        toast: "80",
        tooltip: "90",
      },
      boxShadow: {
        "elev-1": "0 1px 2px rgba(0,0,0,0.35)",
        "elev-2": "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
        "elev-3": "0 24px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05)",
      },
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
        "shimmer": "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(8px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
    },
  },
  plugins: [],
};
