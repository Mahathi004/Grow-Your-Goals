/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', "serif"],
        body: ['"Inter"', "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        accent: "hsl(var(--accent))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}

