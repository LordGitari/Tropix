# TROPIX

An interactive 3D storefront for **TROPIX**, a range of summer juice and kombucha drinks. Pick a bottle, spin it in any direction, and watch the drink slosh around inside the glass.

Built with React, Three.js (via React Three Fiber) and Framer Motion.

## Flavours

| Flavour | Tagline | Calories |
|---|---|---|
| Orange Burst | Organic kombucha & citrus | 45 kcal |
| Berry Pink | Antioxidant superfruit | 50 kcal |
| Strawberry Rush | Herbal refresher | 35 kcal |
| Matcha Green | Earthy wellness blend | 30 kcal |

## Features

**3D bottles**
- Each bottle is built from separate parts: refractive glass, the drink inside, the printed artwork and the cap.
- **Liquid physics:** the drink stays level with gravity and keeps the same volume whichever way the bottle is turned. Tip it over and the drink runs into the neck; lay it on its side and it spreads out evenly. Turn it quickly and it sloshes, then settles.
- A sharp flavour headline is redrawn over the original bottle artwork, so the flavour can be read even on the small carousel bottles.

**Landing page**
- Ambient background of slowly drifting flavour-coloured glows, grain and vignette.
- Hovering a bottle sends a colour ripple across the page and shows the flavour name in giant type behind it.
- Bottles sway gently and turn to face you on hover, so the label is always readable.
- On phones the carousel becomes a swipeable row that snaps to each bottle.

**Detail view**
- Clicking a bottle floods the screen with its colour, then opens the detail view.
- Drag to rotate the bottle freely: left/right spins it, up/down flips it end over end, with no limits and with momentum.
- Animated title, count-up nutrition facts, and ingredient chips that explain each ingredient on hover or tap.
- Arrows or ← / → keys switch flavour with a spin transition; Esc goes back.

**Shop**
- Cart drawer with quantities, saved between visits.
- A mix pack discount (15% off) when three or more different flavours are in the cart.
- A demo checkout with an order confirmation. No payment is taken.
- Contact form (no backend yet; it shows a thank-you message).

**Extras**
- Loading screen with a filling-bottle animation.
- Synthesised sound effects (cork pop, swoosh, glass clink) with a mute toggle.

## Performance

The site is built to run on any device and to look its best on powerful ones.

- **One 3D canvas for the whole page.** Every bottle is drawn by a single shared WebGL canvas, so models, textures and shaders are loaded once and opening a bottle is instant.
- **Quality that adapts to the device.** A starting quality (high, medium or low) is picked from the device's memory, CPU and screen type, then adjusted live from the frame rate. High quality adds refractive glass, sharper rendering and detailed shadows; low quality keeps the same look with lighter effects.
- **Smarter loading.** All the 3D code is downloaded separately from the page (the main bundle is about 365 KB), the print layers and drink colours are prepared ahead of time, and shaders are compiled in the background so the page doesn't freeze on first view.
- **Draws only when needed.** Nothing is drawn while the bottles are off screen or the tab is hidden. When the visitor isn't interacting, weaker devices run the idle motion at half speed to save power.
- **Lighter effects.** Background glows use soft gradients instead of blur filters; frosted-glass blurs are kept only on high quality.
- **Silent fallback.** If a browser can't run 3D at all, or the 3D crashes, the bottle photos are shown instead, so the store always works.

## Getting started

Requires [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (needed by Vite).

```bash
git clone https://github.com/LordGitari/Tropix.git
cd Tropix
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Three.js](https://threejs.org/), [React Three Fiber](https://r3f.docs.pmnd.rs/) and [drei](https://drei.docs.pmnd.rs/)
- [Framer Motion](https://motion.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)

## Project structure

```
public/                 3D bottle models (.glb, meshopt + WebP compressed) and images
  print/                Pre-made print layers for the bottles (see scripts/)
scripts/
  make-print-masks.py   Builds public/print/ from the full-resolution models
src/
  App.tsx               Landing page, carousel, header, story section, footer
  components/
    SharedCanvas.tsx    The single WebGL canvas, frame driver and quality watcher
    SceneView.tsx       A placeholder div that the shared canvas draws a scene into
    BottleModel.tsx     Carousel bottle scene, detail scene, free rotation, bubbles
    LiquidBottle.tsx    Glass, liquid physics, printed artwork and flavour headline
    DrinkDetail.tsx     Detail view card
    CartDrawer.tsx      Cart, mix pack discount and checkout
    ContactPanel.tsx    Contact form
    Loader.tsx          Loading screen
    LiteBottle.tsx      Photo bottles used when 3D isn't available
    OrderConfirmation.tsx, SidePanel.tsx
  data/drinks.ts        Flavours, prices and ingredient info
  hooks/useCart.ts      Cart state (saved in localStorage)
  lib/quality.ts        Device quality tiers and the 2D fallback
  lib/sceneViews.ts, lib/sceneStatus.ts   Shared-canvas view registry and loading status
  lib/sound.ts          Web Audio sound effects
```

## Notes

- This is a demo store: checkout and the contact form do not send anything.
- The full liquid and glass effects need a graphics card; other devices get a lighter quality level automatically.
