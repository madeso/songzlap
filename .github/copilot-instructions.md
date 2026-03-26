# Copilot Instructions

## Project

**tunes** — a web-based Digital Audio Workstation (DAW). Users create samples via a piano roll, select instruments, and lay out tracks. Built with React 19 + TypeScript + Vite.

## Commands

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check (tsc -b) then Vite production build
npm run lint      # ESLint (TypeScript + React hooks + react-refresh rules)
npm run preview   # preview production build locally
```

There is no test runner configured.

## Architecture

Currently early-stage — `src/App.tsx` is the single component and entry point. `src/main.tsx` mounts it inside React `StrictMode`. Global styles live in `src/index.css` (CSS custom properties / design tokens), component-scoped styles in `src/App.css`.


## Styling & Assets

- **Tailwind CSS** loaded via CDN (includes `forms` and `container-queries` plugins) — no PostCSS/Tailwind build step.
- **Fonts:** `Space Grotesk` for headings, `Inter` for body/data — both via Google Fonts.
- **Icons:** Material Symbols Outlined (Google Fonts icon font) — use the ligature syntax, not SVG sprites.
- **Graphics:** Inline SVG only for all diagrams and visualizations — no `<canvas>`, no third-party charting libraries.

## Key Conventions

- **TypeScript strict mode** is on with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `verbatimModuleSyntax` — imports must use `import type` where applicable.
- Target is **ES2023**, module resolution is `bundler` (Vite handles all imports; `.tsx` extensions are allowed in import paths).
- ESLint only lints `**/*.{ts,tsx}` — plain JS files are not linted.
