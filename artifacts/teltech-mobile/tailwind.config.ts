import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // === Teltech Dark Mode System ===
        background: "#111113",       // hsl(240 3% 7%)
        foreground: "#fafafa",       // hsl(0 0% 98%)
        card: {
          DEFAULT: "#2b2b2e",        // hsl(240 3% 18%)
          foreground: "#fafafa",
        },
        popover: {
          DEFAULT: "#1d1d20",        // hsl(240 4% 12%)
          foreground: "#fafafa",
        },
        border: "#313136",           // hsl(240 4% 20%)
        input: "#232326",            // hsl(240 4% 15%)
        muted: {
          DEFAULT: "#36363c",        // hsl(240 4% 22%)
          foreground: "#a1a1aa",     // hsl(240 5% 65%)
        },
        // === Brand Accents ===
        primary: {
          DEFAULT: "#7C5AC2",        // hsl(265 85% 62%) — Tarcísio/CEO
          foreground: "#fafafa",
          glow: "#9B7AD8",           // lighter for gradients
        },
        secondary: {
          DEFAULT: "#4080d6",        // hsl(220 70% 55%) — Spiri/CMO
          foreground: "#fafafa",
        },
        success: {
          DEFAULT: "#27a06b",        // hsl(152 65% 45%) — Lucas/CTO
          foreground: "#fafafa",
        },
        destructive: {
          DEFAULT: "#d44040",        // hsl(0 70% 58%) — Danger
          foreground: "#fafafa",
        },
        // === Semantic Aliases ===
        accent: {
          DEFAULT: "#36363c",
          foreground: "#fafafa",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      fontFamily: {
        sans: ["System"],  // iOS SF Pro / Android Roboto
      },
    },
  },
  plugins: [],
} satisfies Config;
