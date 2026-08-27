# Colour vision test

A colour vision test that runs in the browser and gives you a proper report at the end: how strong
your deficiency is, which colours you actually mix up, and what everyday scenes look like through
your eyes.

## Why

If you are colour blind you have answered the same three questions a hundred times. *So you can't
see traffic lights? Do you see in black and white? What colour is this then?*

That is what the share link is for. The page it opens is not a copy of your report — it is written
for whoever you send it to. It says who it is about, shows the colours you confuse, puts real
scenes through your vision, and answers the usual questions up front, traffic lights first. There
is also a section on what to expect if you have children together, since that one comes up too.

The idea is to replace the conversation rather than to document it.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm test` | Run the tests |
| `npm run preview:stimuli` | Render the test stimuli to PNGs, to look at them directly |
| `npm run preview:link` | Print a share link for a fake result, handy for working on that page |

## The test

Four stages, about six minutes.

| Stage | What it is |
| --- | --- |
| Hidden figures | Read the number in a field of coloured dots |
| Colour sensitivity | Say which side the gap in a ring is on, as the colours get fainter |
| Brightness match | Make a red patch as bright as a grey one |
| Colour ordering | Sort sixteen swatches into a smooth run |

The second one does most of the work: it narrows in on the faintest colour difference you can still
see along each of the three cone axes, and the report is built from those numbers.

Nothing is a scanned Ishihara plate. Every stimulus is generated from colour science, which means
the dots and digits change every run so it cannot be memorised, and the difficulty is a dial rather
than pass/fail — that is what lets the test measure *how much* rather than just *whether*.

It is a fun project and a decent estimate, not a clinical instrument. Your screen is not calibrated
and your room lighting is unknown, so treat a borderline result as borderline.

## Sharing

The share link carries the measurements in the URL itself, so nothing is stored anywhere and links
never expire. They come out around 220 characters. You can put your first name in so the page says
"Tomas has moderate deuteranomaly" instead of "they have"; that is the only personal thing in it.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`. Turn it
on once under **Settings → Pages → Build and deployment → Source → GitHub Actions**. Tests run
first, so a failure blocks the deploy.

Any static host works just as well — build and serve `dist/`. The paths are relative, so it runs
from a subdirectory or straight off disk.

## Layout

```
src/
  color/        colour spaces, colour blindness simulation, confusion lines
  stimuli/      the dot plates, rings and swatches
  engine/       the staircase and the classifier that reads the results
  analysis/     named colours and which ones collapse together
  scenes/       the everyday scenes in the simulator
  session/      test flow and share links
  components/   screens and report sections
tests/
```

The colour maths is pure and unit-tested, and React is the only runtime dependency. If you want the
reasoning behind a particular choice, it is in a comment at the top of the file that makes it —
that is where the detail lives rather than in here.

## Testing

```bash
npm test
```

Two of the checks matter more than the rest. Every generated plate is verified to be invisible to
the deficiency it targets and obvious to everyone else, using the same cone model the simulator
uses. And synthetic observers — a fake protanope, deuteranomal, tritanope and normal observer — are
run through the real engine to confirm the classifier recovers the right answer. That is the part
that makes a result trustworthy rather than merely plausible.

There is also a test that drives the whole session from the intro screen to the report, because the
interesting failures are the ones that typecheck fine and break on screen.

## Accessibility

This app is for people who cannot rely on hue, so hue is never the only thing carrying meaning —
anything a colour distinguishes also has a border, an icon, a position or a label. Every stage works
entirely from the keyboard, including the sorting one. Canvas stimuli have text alternatives, and
`prefers-reduced-motion` stops the dots drifting.
