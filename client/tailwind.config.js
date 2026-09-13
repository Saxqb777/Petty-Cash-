/** @type {import('tailwindcss').Config} */

// ── OVERPRINT ────────────────────────────────────────────────────────────────
// Two-ink risograph logic. Flat spot colours that multiply where they cross,
// hard rectangles at zero radius, 2px structural rules instead of hairlines,
// and no shadow anywhere on the surface.
//
// Rules that are not negotiable per-component:
//   · borderRadius is 0. Everything is a rectangle. No pills, no rounded cards.
//   · boxShadow is none. Depth comes from ink weight and background steps.
//   · No gradients. Flat fills only.
//   · Three inks total: blue (primary), flare (attention), green (resolved).
//     "Waiting" is deliberately uncoloured — an ink outline on paper.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // Overridden, not extended — kills Tailwind's default rounded/shadow scales
    // so a stray `rounded-lg` or `shadow-md` cannot creep back in.
    borderRadius: { none: '0', DEFAULT: '0', sm: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '0' },
    boxShadow:    { none: 'none', DEFAULT: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none' },

    extend: {
      fontFamily: {
        sans: ['Archivo', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Fragment Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      colors: {
        // ── Paper: the ground. Cool-warm neutral, biased slightly toward the blue ink.
        paper: {
          50:  '#F7F6F3', // alternating ledger row
          100: '#EDECE8', // base canvas
          200: '#E5E3DD',
          300: '#D8D5CD',
          400: '#C6C2B8', // light rules
          500: '#ABA69B',
        },

        // ── Ink: the black. Very slightly blue so it sits with the primary ink.
        // Contrast measured against paper-100 (#EDECE8). Do not use a lighter
        // step than the one noted for each role — the muted greys were darkened
        // specifically so secondary text still clears WCAG AA.
        ink: {
          900: '#14141A', // 15.8:1 — body, headings, structural rules
          800: '#22222A', // 13.2:1
          700: '#31313B', // 10.2:1
          600: '#43434E', //  7.4:1 — strong secondary
          500: '#57575F', //  5.6:1 — SECONDARY TEXT FLOOR
          400: '#6B6B75', //  4.3:1 — meta, still passes AA
          300: '#8A8A93', //  3.0:1 — placeholders and large text ONLY
          200: '#B0B0B8', //  decorative rules / disabled. Never text.
        },

        // ── Ink 1: federal blue. Primary actions, nav, ordinary spend.
        blue: {
          50:  '#EFF2FA',
          100: '#DDE3F3',
          200: '#B9C4E4',
          300: '#8B9AC6',
          400: '#4A5FA5',
          500: '#2E4489',
          600: '#22356F', // base
          700: '#1C2D5E',
          800: '#182750',
          900: '#101B3C',
        },

        // ── Ink 2: flare. Attention, over-cap, destructive, the second plate.
        flare: {
          50:  '#FFF1EB',
          100: '#FFE2D7',
          200: '#FFC2AC',
          300: '#FF9470',
          400: '#FF6B40',
          500: '#FF4A17', // base
          600: '#E63F12',
          700: '#C4340D',
          800: '#9C2909',
        },

        // ── Ink 3: riso green. Used sparingly — resolved, approved, saved.
        green: {
          50:  '#E8F7EF',
          100: '#C9EDDA',
          200: '#8EDCB5',
          300: '#4DC78D',
          400: '#12B36B',
          500: '#00A95C', // base (Riso Green)
          600: '#00904E',
          700: '#00753F',
          800: '#005C32',
        },
      },

      borderWidth: {
        DEFAULT: '1px',
        2: '2px', // structural
        3: '3px',
      },

      fontSize: {
        // Readability floor: `sm` (13px) is the smallest size allowed for text a
        // user actually has to read. `xs` and `2xs` are for uppercase labels and
        // incidental metadata only, and both carry tracking to stay legible.
        '2xs': ['10px',  { lineHeight: '1.35', letterSpacing: '0.14em' }],
        xs:    ['11.5px',{ lineHeight: '1.45', letterSpacing: '0.01em' }],
        sm:    ['13px',  { lineHeight: '1.5' }],
        base:  ['14.5px',{ lineHeight: '1.55' }],
        lg:    ['16px',  { lineHeight: '1.45' }],
        xl:    ['19px',  { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '2xl': ['23px',  { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        '3xl': ['29px',  { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        '4xl': ['38px',  { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        '5xl': ['50px',  { lineHeight: '0.98', letterSpacing: '-0.035em' }],
      },

      keyframes: {
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'rise':     { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'sweep':    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        // 120ms, ease-out, opacity + 4px. No spring, no bounce, no scale.
        'fade-in': 'fade-in 120ms ease-out',
        rise:      'rise 140ms ease-out',
        sweep:     'sweep 1.4s infinite linear',
      },
    },
  },
  plugins: [],
};
