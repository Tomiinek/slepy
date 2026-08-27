/**
 * "Where it bites" as a grid of simulated scenes.
 *
 * This replaces a bullet list of situations with the situations themselves,
 * drawn as the visitor actually sees them. A sentence saying "unripe versus ripe
 * fruit relies on the red-green difference you are missing" asks the reader to
 * imagine the effect; five tomatoes that all look the same colour demonstrate it.
 *
 * One toggle flips every tile between typical vision and the visitor's, which is
 * the whole explanation -- so each tile needs a label rather than a paragraph.
 */
import { useMemo, useState } from 'react';
import { SCENES, type Paint, type Scene } from '../../scenes';
import { simulateSrgb, type Vision } from '../../color/cvd';
import { hexFromSrgb, srgbFromHex } from '../../color/srgb';

/** Short risk labels, keyed by scene. Long-form detail lives in the simulator. */
const RISK: Record<string, string> = {
  fruit: 'Ripeness, doneness',
  leds: 'Status lights',
  chart: 'Charts, heatmaps',
  whiteboard: 'Red pen, dark slides',
  resistors: 'Wires, resistor bands',
  traffic: 'Signals at a distance',
  colormaps: 'Rainbow colour scales',
  terrain: 'Maps, contours',
};

const RED_GREEN_SCENES = ['fruit', 'leds', 'chart', 'whiteboard', 'resistors', 'traffic'];
const TRITAN_SCENES = ['colormaps', 'chart', 'terrain', 'whiteboard'];

function memoPaint(vision: Vision): Paint {
  const cache = new Map<string, string>();
  return (hex) => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const out = hexFromSrgb(simulateSrgb(srgbFromHex(hex), vision));
    cache.set(hex, out);
    return out;
  };
}

interface Props {
  readonly vision: Vision;
  readonly redGreen: boolean;
}

export function SceneGrid({ vision, redGreen }: Props) {
  const [typical, setTypical] = useState(false);

  const scenes = useMemo(() => {
    const wanted = redGreen ? RED_GREEN_SCENES : TRITAN_SCENES;
    return wanted
      .map((id) => SCENES.find((s) => s.id === id))
      .filter((s): s is Scene => Boolean(s));
  }, [redGreen]);

  const paint = useMemo(() => memoPaint(vision), [vision]);
  const identity: Paint = (hex) => hex;

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <h3>Where it bites</h3>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setTypical((v) => !v)}
          aria-pressed={typical}
        >
          {typical ? 'Showing typical vision' : 'Showing your vision'}
        </button>
      </div>

      <div className="scene-grid">
        {scenes.map((scene) => (
          <figure key={scene.id} className="scene-tile">
            <div className="scene-tile__art" role="img" aria-label={scene.name}>
              {scene.render(typical ? identity : paint)}
            </div>
            <figcaption>{RISK[scene.id] ?? scene.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
