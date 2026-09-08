---
name: coob-frontend
description: Design and code standards for the COOB Optique website (Next.js 16, Tailwind 4, French UI). Use when building, restyling or reviewing any page, section or component of this site, so that new work matches the brand and the quality bar.
---

# COOB frontend standards

Apply everything below when touching anything under `src/app` or `src/components`.
Read `src/app/globals.css` and `src/lib/config.ts` first: tokens and business facts live there, never inline them.

## Brand

- Identity: COOB, "Centre d'Optique et d'Optométrie du Burkina". Tagline "La garantie de bien voir". Three agencies (Koulouba, Gounghin, Bobo) from `AGENCIES`; never hard-code phone numbers.
- Palette (Tailwind tokens, see `@theme` in `globals.css`): `brand-500` lime `#afbb01` is the signature colour, used for accents, highlights and the wordmark, never for body text. Text-safe greens are `brand-700`/`brand-800`. Warm accent `accent-500` orange `#f0932b` for secondary calls to action. Neutrals: `paper`, `paper-2`, `ink`, `ink-2`, `ink-3`.
- Dark sections use `bg-ink` with lime accents; lime sections (`bg-brand-500`) use `text-ink` on white cards.
- Logo: `<LogoMark tone="color" | "white">` from `src/components/Logo.tsx`. Never recreate it.
- Photography: real COOB visuals from `public/images/`. Never use Google Maps user photos or stock images.

## Copy

- Everything user-facing is French, with proper accents and typographic apostrophes (`&apos;` in JSX). Tone: warm, direct, "vous". Prices as `formatFcfa()`. Dates via helpers in `src/lib/slots.ts`.
- SMS templates stay accent-free (GSM-7), see `src/lib/sms/templates.ts`.

## Layout and components

- Page shell: `<div className="container-x py-10">`. Eyebrow label (`.eyebrow`) above an `h1`/`h2` in `text-3xl font-bold tracking-tight`, then a `max-w-2xl text-ink-2` intro.
- Reuse the utility classes from `globals.css`: `.card`, `.btn-primary` (main action), `.btn-lime` (brand highlight), `.btn-accent`, `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.field`, `.label`, `.badge`. Add new shared patterns there, not as one-off Tailwind strings copied across files.
- Reuse existing components before writing new ones: `FrameCard`, `FrameViewer`, `TryOn`, `Glasses3D`, `BookingForm`, `OrderTracker`, `Reveal`, `Parallax`, `CountUp`, `StoreGallery`, admin `OrderRow`, `StatusBadge`, `FrameForm`, `ModelPreview`.
- Try-on: the 3D engine lives in `src/lib/tryon-3d.ts` (three.js layer over the video, head occluder, exposure from the camera) with tested geometry in `src/lib/tryon-3d-math.ts`; the photo fallback uses `src/lib/tryon-math.ts`. Keep pure maths in those modules with Vitest coverage; the React component only wires refs and effects.
- Data comes from `getCatalog()` (`src/lib/catalog.ts`) and `getStore()` (`src/lib/db`). Never import `BUILTIN_FRAMES` in a public page: the database catalog replaces the demo frames.
- Images: `next/image` with real `width`/`height`; `unoptimized` for SVGs and `/api/frames/*` photos; `sizes` on anything above the fold.
- Client components only where interaction requires it (`"use client"` at the top, keep them small). Server actions for admin mutations, with `requireAdmin()` first.

## Motion and polish

- Motion is subtle and purposeful: hover lifts (`transition`, `group-hover:scale-[1.04]`), soft fades, the 3D hero. No bouncing, no parallax on text, nothing longer than 300 ms for UI feedback.
- Always honour `prefers-reduced-motion` for anything continuous (see `Glasses3D`).
- Heavy libraries (three.js, MediaPipe) are loaded with dynamic `import()` inside the component and disposed on unmount.
- Empty states, loading states and error states are designed, not left blank: a short sentence plus the next action.

## Accessibility and responsiveness

- Mobile first: most COOB customers are on phones. Check at 390 px width before desktop. Tap targets at least 40 px; forms use `inputMode`, `autoComplete` and real `<label>`s.
- Semantic HTML: one `h1` per page, `nav` with `aria-label`, `role="tablist"`/`aria-selected` for toggles, `aria-pressed` for toggle buttons, `role="alert"` for form errors.
- Colour contrast at least 4.5:1 for text; lime is decoration only.

## Verification before delivering

1. `npm run check` (typecheck, lint, Vitest) and `npm run build` must pass.
2. Start `next start` on a spare port and screenshot the changed pages with Playwright (`/opt/node22/lib/node_modules/playwright` and `/opt/pw-browsers/chromium` in the web sandbox), at 1280 px and 390 px. For WebGL pages launch Chromium with `--use-gl=angle --use-angle=swiftshader` and click via `page.evaluate`.
3. Look at the screenshots. Fix anything that wraps badly, overflows, or looks unfinished before reporting.
4. New behaviour gets a unit test in `tests/` when it is pure logic (maths, parsing, formatting).

## Do not

- Do not add a UI library, icon set or font without a reason; the site is deliberately light.
- Do not put secrets, phone numbers or addresses in components: `config.ts` and environment variables only.
- Do not fabricate business facts (ratings, opening hours, addresses). Placeholders are documented in the README "À compléter" list.
