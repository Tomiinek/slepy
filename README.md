# Colour vision test

A thorough (~6 minute) colour vision test that runs entirely in the browser, with a detailed
personalised report: estimated per-cone discrimination, the specific colour families you confuse,
two-way vision simulators, and your own confusion lines drawn on a chromaticity diagram.

It is a fun, fairly rigorous estimate rather than a clinical instrument — results depend on an
uncalibrated display in unknown lighting, and monochromacy is covered poorly.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | Types only, no build |
| `npm run preview:stimuli` | Render stimuli to PNGs in `preview/` for visual inspection |
| `npm run preview:report` | Render the report's charts to PNGs (needs the rasteriser, see below) |

The build uses a relative base, so `dist/` can be served from any subdirectory, or opened straight
from disk.

## Sharing a result

The report has one output: a link. It encodes the measurements in the URL hash, so there is nothing
stored anywhere and no expiry.

Opening that link does **not** show a copy of the sharer's own report. It renders a separate page
written for the recipient: who it is about, what they confuse, the situations rendered through their
vision, and direct answers to the questions people actually ask — traffic lights first, because it
is always first. The point is to replace the conversation, not to document it.

An optional first name goes in the link so the page can say "Tomas has moderate deuteranomaly"
rather than "they have". It is the only personal detail in the URL. Links are around 220 characters.

Which person the page addresses comes from `src/copy/voice.ts`, so a component can serve both
audiences without duplicated copy.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Enable
it once, under **Settings → Pages → Build and deployment → Source → GitHub Actions**. The workflow
runs the test suite first, so a failing test blocks the deploy.

No configuration depends on the repository name: the Vite base is relative, so the site works at
`https://<user>.github.io/<repo>/` as well as at a domain root. Test state lives in the URL hash
rather than in routed paths, so no SPA 404 fallback is needed.

Any other static host works the same way — build and serve `dist/`.

## Reviewing the charts without a browser

The report leans on charts, and a chart that renders as an empty box passes every unit test. To look
at them directly, install the rasteriser and render them to PNGs:

```bash
npm install --no-save @resvg/resvg-js
npm run preview:report      # writes preview/*.png
```

It is deliberately not a dependency: it is a native binary used only for local review, and CI never
runs it. `tests/report.test.tsx` covers the same components by asserting each chart has real content.

## Why the stimuli are generated rather than scanned

Shipping scanned Ishihara plates would mean copyright problems, a test that can be memorised, and
pass/fail output with no notion of degree. Generating every stimulus from colour science instead
gives three things that make the rest of the app possible:

1. **Amplitude is a free parameter**, so the test *measures* severity rather than only detecting a
   deficiency.
2. **Nothing is memorisable** — the dot layout and the digits differ on every run.
3. **Correctness is testable.** Figure and background are placed on a confusion line derived from
   the same cone fundamentals the simulator uses, so "invisible to a deuteranope" is asserted in a
   unit test rather than hoped for.

Everything works in a Smith–Pokorny LMS space. A protanope cannot distinguish colours differing only
in L-cone excitation, a deuteranope only in M, a tritanope only in S — so for each deficiency there
is a **confusion direction** in the chromaticity plane at fixed luminance. Hide a figure using only
that direction and it is invisible to the affected observer and obvious to everyone else. How small a
displacement along it someone can still detect *is* their severity.

## The four stages

| Stage | What it measures | Method |
| --- | --- | --- |
| Hidden figures | Detection, and a coarse severity ladder | ~17 generated pseudoisochromatic plates: one control, three amplitudes × three axes, plus hidden-digit reverse plates |
| Colour sensitivity | The quantitative core | Dotted Landolt C, 4-alternative forced choice, three interleaved 2-down/1-up staircases targeting ~70.7% correct |
| Brightness match | Protan versus deutan | Red-luminance matching against a neutral reference, four repeats alternating start direction |
| Colour ordering | Independent corroboration | 15-cap hue arrangement, yielding a total error score and a confusion-axis angle |

Absolute thresholds on an uncalibrated display are unreliable, so the classifier's primary signals
are **ratios between axes**, which cancel most display, blur and attention effects. Prior diagnosis
is asked only *after* the test, and never feeds scoring.

### Two design details that matter

**The adaptation field.** The app chrome is dark, but valid colour testing needs a controlled
mid-grey adaptation state. Stimulus screens therefore render a neutral surround at fixed `Y ≈ 0.20`,
with a short adaptation pause on entry. The dark theme lives in the chrome, intro and report. Without
this, the first trials of each stage are measured in a different adaptation state from the rest —
and since the main signal is the ratio *between* axes, that drift maps straight onto a wrong answer.

**Dot luminance noise.** A confusion pair still carries a small residual brightness difference for
the affected observer, and hundreds of dots let them pool it. So figure luminance is corrected to be
isoluminant *for the target dichromat* rather than for a normal observer, and every dot additionally
gets bounded, slowly drifting luminance noise.

## Layout

```
src/
  color/        sRGB, XYZ, u'v', Smith-Pokorny LMS, OKLab, CVD simulation,
                confusion lines, gamut mapping, daltonisation
  stimuli/      plate generator, digit masks, Landolt C, arrangement caps
  engine/       staircase, threshold block, luminance probe, arrangement
                scoring, normative values, classifier
  analysis/     named colour palette and confusion-family clustering
  scenes/       procedural simulator scenes
  session/      state machine, share-link encoding
  components/   screens and report sections
tests/          vitest
scripts/        spectral data generation, plate PNG preview
```

Colour maths is pure, dependency-free and unit-tested. The only runtime dependency is React.

### Constants and citations

Normative reference values live in `src/engine/normative.ts` with citations, marked as tunable.
Confusion directions are **derived from the LMS matrices**, not from hard-coded copunctal points, so
stimuli are exactly consistent with the simulation; the published copunctal points are used only as
unit-test cross-checks. Dichromacy simulation follows Brettel et al. (1997) and Viénot et al. (1999),
with severity as a linear interpolation in LMS. Out-of-gamut results are desaturated toward white
rather than clipped.

`src/color/spectralData.ts` is generated from CVRL reference datasets:

```bash
node scripts/generate-spectral-data.mjs
```

## Testing

```bash
npm test
```

Beyond round-trip colour maths, two checks carry most of the weight:

- **Plate correctness** — every generated plate's figure/background pair must have near-zero ΔE
  *under the target deficiency simulation*, and a large ΔE for normal vision.
- **Synthetic observers** — virtual protanope, deuteranomalous, tritanope and normal observers are
  built from the CVD model and run programmatically through the real engine, asserting the classifier
  recovers the right type and severity. This is what makes the result trustworthy rather than
  plausible-looking.

There is also a full-session component test that drives the real state machine from the intro screen
through to the report, which catches the class of failure that typechecks and passes every unit test
but breaks on screen.

To inspect stimulus appearance without a browser:

```bash
npm run preview:stimuli   # writes PNGs to preview/
```

This exists because the stimuli have had two bugs that were *purely visual* — correct maths,
correct colours, passing tests, and wrong on screen. Plates once covered only 42% of the disc and
looked like a washed-out scatter; the brightness-match reference patch was once rendered in exactly
the surround colour, so observers saw a single red square with nothing to match against. Rendering
the real code path to a PNG catches that class of problem.

## Accessibility

The audience for this app is people who cannot rely on hue, so hue is never the only carrier of
meaning: everything a colour distinguishes also carries a border, icon, position or label.

- Every stage is fully operable from the keyboard, including the cap arrangement, where the keyboard
  path is a first-class equal rather than a fallback.
- Focus moves to the new screen on each stage change, and a live region announces it.
- Canvas stimuli carry text alternatives.
- `prefers-reduced-motion` replaces the drifting dot noise with a single static frame.
