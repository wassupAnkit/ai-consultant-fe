import type { Config } from "tailwindcss";

/**
 * Tailwind v3 over the token layer in app/globals.css. Every colour here resolves to an HSL
 * variable so light/dark theming lives in CSS, not in class names; the Expert brand values
 * themselves are documented next to the variables.
 */
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Cambria", "Times New Roman", "serif"],
        heading: ["var(--font-heading)", "Georgia", "serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        // The chat's reading size: a touch larger than `sm`, with the looser leading long answers need.
        body: ["15px", { lineHeight: "1.65" }],
        greeting: ["2rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "greeting-lg": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        heading: "hsl(var(--heading))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          strong: "hsl(var(--primary-strong))",
          tint: "hsl(var(--primary-tint))",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        navy: { DEFAULT: "hsl(var(--navy))", foreground: "hsl(var(--navy-foreground))" },
        teal: { DEFAULT: "hsl(var(--teal))", foreground: "hsl(var(--teal-foreground))", tint: "hsl(var(--teal-tint))" },
        workspace: { DEFAULT: "hsl(var(--workspace))", foreground: "hsl(var(--workspace-foreground))", strong: "hsl(var(--workspace-strong))", tint: "hsl(var(--workspace-tint))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        sidebar: "hsl(var(--sidebar))",
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", tint: "hsl(var(--success-tint))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))", tint: "hsl(var(--warning-tint))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        /**
         * Compatibility ladder for the older `brand-*` classes: the Expert blue scale (500 = the
         * brand blue #1877F2, 900 = navy #063263). New code uses the semantic tokens above; this
         * exists so nothing renders the old education-platform blue while the migration lands.
         */
        brand: {
          50: "#eaf2fe",
          100: "#d3e4fc",
          200: "#a9c9f9",
          300: "#5da1ff",
          400: "#3b8cf7",
          500: "#1877f2",
          600: "#0f63d6",
          700: "#0b4fad",
          800: "#083a80",
          900: "#063263",
          950: "#041f3f",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) * 0.6)",
        md: "calc(var(--radius) * 0.8)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) * 1.4)",
        "2xl": "calc(var(--radius) * 1.8)",
        "3xl": "calc(var(--radius) * 2.2)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        cta: "var(--shadow-cta)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "fade-in-up": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "none" } },
        "scale-in": { "0%": { transform: "scale(0.96)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.18s ease-out both",
        "scale-in": "scale-in 0.15s ease-out",
      },
    },
  },
  // forms/aspect-ratio stay: their base-layer resets shape the search field and textarea.
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography"), require("@tailwindcss/forms"), require("@tailwindcss/aspect-ratio")],
} satisfies Config;
