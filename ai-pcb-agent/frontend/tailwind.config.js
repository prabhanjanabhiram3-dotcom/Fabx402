/** @type {import('tailwindcss').Config} */

/**
 * DESIGN TOKENS - grounded in the subject: a printed circuit board.
 *
 * The previous palette (near-black + bright teal) is a generic dark-dashboard
 * default that could belong to any product. This palette is taken from the
 * materials the product actually works with:
 *
 *   substrate  #0A0F0D  FR-4 laminate, a green-black rather than pure black
 *   raised     #141B17  solder-masked surface, one step up from the substrate
 *   copper     #C87137  the traces themselves - the primary accent
 *   copper-lt  #E09A5F  copper catching light - hover/active
 *   gold       #E5B769  ENIG pad plating - reserved ONLY for payment moments
 *   silkscreen #E8EDE9  component legend ink - primary text
 *
 * Token NAMES are unchanged (base-*, accent-*) so every existing component
 * inherits the new identity without being rewritten.
 */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0A0F0D",
          900: "#0F1512",
          850: "#141B17",
          800: "#1A231E",
          700: "#26332B",
          600: "#4A5A50",
        },
        accent: {
          400: "#E09A5F",
          500: "#C87137",
          600: "#A2562A",
        },
        // ENIG gold - the money colour. Used only for x402/payment surfaces,
        // so value has one visual home across the whole product.
        gold: {
          400: "#F0CC8C",
          500: "#E5B769",
          600: "#C29A49",
        },
      },
      fontFamily: {
        // Space Grotesk: mechanical, drafting-adjacent display face.
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        // IBM Plex: designed for technical documentation - the right register
        // for fab notes, tolerances and part numbers.
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(200,113,55,0.20), 0 0 28px rgba(200,113,55,0.10)",
        gold: "0 0 0 1px rgba(229,183,105,0.25), 0 0 28px rgba(229,183,105,0.10)",
      },
      backgroundImage: {
        // Faint copper trace grid - reads as substrate, not as decoration.
        traces:
          "linear-gradient(rgba(200,113,55,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(200,113,55,0.045) 1px, transparent 1px)",
      },
      backgroundSize: {
        traces: "48px 48px",
      },
    },
  },
  plugins: [],
};
