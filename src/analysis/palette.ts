/**
 * Everyday colours, with the names people actually use for them.
 *
 * The report's most useful section tells someone which colours they are likely to
 * mix up. For that to land, the colours have to be ones they meet in real life
 * and the names have to be ones they would use themselves. "Olive green and
 * brick red look the same to you" is a sentence someone can check against their
 * own experience; "#808000 and #9c4a3c have a simulated delta-E of 0.011" is not.
 *
 * The set is deliberately weighted toward the regions where red-green
 * deficiencies bite: the browns, olives, dull reds and khakis that collapse into
 * one muddy family, and the purple/blue/grey group that collapses into another.
 * `where` gives a concrete place the colour shows up, which is what makes the
 * result feel like a description of someone's life rather than a chart.
 */
import { srgbFromHex, type Srgb } from '../color/srgb';

export type PaletteCategory =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'brown'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'neutral';

export interface NamedColor {
  readonly name: string;
  readonly hex: string;
  readonly category: PaletteCategory;
  /** Where this colour turns up, for the "why it matters" line. */
  readonly where?: string;
}

export const PALETTE: readonly NamedColor[] = [
  // Reds -- the family that collides with greens and browns.
  { name: 'Traffic-light red', hex: '#d32f2f', category: 'red', where: 'traffic signals, stop signs' },
  { name: 'Brick red', hex: '#9c4a3c', category: 'red', where: 'brickwork, terracotta pots' },
  { name: 'Blood red', hex: '#8a1c1c', category: 'red', where: 'cuts, raw meat' },
  { name: 'Tomato red', hex: '#e14c34', category: 'red', where: 'ripe tomatoes' },
  { name: 'Cherry red', hex: '#c21e3a', category: 'red' },
  { name: 'Rust', hex: '#8b3e2a', category: 'red', where: 'corroded metal' },
  { name: 'Maroon', hex: '#6d1f2c', category: 'red' },
  { name: 'Crimson', hex: '#b01030', category: 'red' },
  { name: 'Coral', hex: '#f4796b', category: 'red' },
  { name: 'Salmon', hex: '#e58a76', category: 'red', where: 'smoked salmon' },
  { name: 'Wine red', hex: '#5c1a2b', category: 'red', where: 'red wine' },
  { name: 'Paprika', hex: '#b5462a', category: 'red' },

  // Oranges
  { name: 'Bright orange', hex: '#f57c00', category: 'orange', where: 'safety vests, cones' },
  { name: 'Carrot orange', hex: '#e07b39', category: 'orange' },
  { name: 'Burnt orange', hex: '#b25a20', category: 'orange' },
  { name: 'Amber', hex: '#e8a33d', category: 'orange', where: 'traffic lights, warning lamps' },
  { name: 'Apricot', hex: '#e8a87c', category: 'orange' },
  { name: 'Terracotta', hex: '#c66a4a', category: 'orange', where: 'roof tiles' },

  // Yellows
  { name: 'Lemon yellow', hex: '#f2e14c', category: 'yellow' },
  { name: 'Golden yellow', hex: '#e5b73b', category: 'yellow' },
  { name: 'Mustard', hex: '#c9a227', category: 'yellow', where: 'mustard, autumn leaves' },
  { name: 'Straw', hex: '#ddd08a', category: 'yellow', where: 'dry grass, hay' },
  { name: 'Cream', hex: '#f0e6c8', category: 'yellow' },
  { name: 'Ochre', hex: '#b8860b', category: 'yellow' },

  // Greens -- the other half of the classic red-green collision.
  { name: 'Traffic-light green', hex: '#2e9e4f', category: 'green', where: 'traffic signals, go lights' },
  { name: 'Grass green', hex: '#5a9e3a', category: 'green', where: 'lawns, playing fields' },
  { name: 'Leaf green', hex: '#4c8b2b', category: 'green' },
  { name: 'Forest green', hex: '#245c34', category: 'green' },
  { name: 'Olive green', hex: '#7b7d33', category: 'green', where: 'olives, army surplus' },
  { name: 'Moss green', hex: '#6b7d4a', category: 'green', where: 'damp stone, tree bark' },
  { name: 'Sage green', hex: '#9caa8b', category: 'green' },
  { name: 'Mint green', hex: '#8fd4a8', category: 'green' },
  { name: 'Lime green', hex: '#a5cc3d', category: 'green' },
  { name: 'Emerald', hex: '#1f9c6f', category: 'green' },
  { name: 'Teal', hex: '#1f7a7a', category: 'green' },
  { name: 'Pea green', hex: '#8a9a3b', category: 'green' },
  { name: 'Avocado', hex: '#657a3c', category: 'green', where: 'ripe avocado flesh' },
  { name: 'Unripe green', hex: '#7d8f4d', category: 'green', where: 'unripe fruit' },
  { name: 'Khaki', hex: '#8f8558', category: 'green', where: 'uniforms, chinos' },

  // Browns -- the family people with red-green deficiency name most often.
  { name: 'Chocolate brown', hex: '#5b3a24', category: 'brown' },
  { name: 'Milk chocolate', hex: '#7a5230', category: 'brown' },
  { name: 'Coffee brown', hex: '#6b4630', category: 'brown' },
  { name: 'Tan', hex: '#b08b5e', category: 'brown', where: 'leather, sand' },
  { name: 'Camel', hex: '#c19a6b', category: 'brown' },
  { name: 'Chestnut', hex: '#7c4a2d', category: 'brown', where: 'horse coats, conkers' },
  { name: 'Mud brown', hex: '#6d5a3f', category: 'brown' },
  { name: 'Dark walnut', hex: '#4a3524', category: 'brown', where: 'furniture, floorboards' },
  { name: 'Sand', hex: '#d4c19c', category: 'brown' },
  { name: 'Bark brown', hex: '#5f4a35', category: 'brown', where: 'tree trunks' },
  { name: 'Cinnamon', hex: '#9c663c', category: 'brown' },
  { name: 'Dried-blood brown', hex: '#6a2f24', category: 'brown', where: 'old stains, scabs' },

  // Blues
  { name: 'Sky blue', hex: '#6fb4e8', category: 'blue' },
  { name: 'Royal blue', hex: '#2b4fa8', category: 'blue' },
  { name: 'Navy blue', hex: '#1c2a52', category: 'blue', where: 'suits, uniforms' },
  { name: 'Denim blue', hex: '#4a6b96', category: 'blue', where: 'jeans' },
  { name: 'Turquoise', hex: '#2fb4b4', category: 'blue' },
  { name: 'Cyan', hex: '#3fc4d8', category: 'blue' },
  { name: 'Steel blue', hex: '#4682b4', category: 'blue' },
  { name: 'Slate blue', hex: '#5a6b8c', category: 'blue' },
  { name: 'Powder blue', hex: '#b0c9dd', category: 'blue' },
  { name: 'Petrol blue', hex: '#255a6b', category: 'blue' },

  // Purples -- collides with blue and grey for red-green deficiency.
  { name: 'Violet', hex: '#7a4fc4', category: 'purple' },
  { name: 'Lavender', hex: '#b9a5dd', category: 'purple' },
  { name: 'Lilac', hex: '#c8a2c8', category: 'purple' },
  { name: 'Deep purple', hex: '#4a2a6b', category: 'purple' },
  { name: 'Plum', hex: '#6b3a5c', category: 'purple', where: 'plums, aubergine skin' },
  { name: 'Aubergine', hex: '#452a4a', category: 'purple' },
  { name: 'Mauve', hex: '#a08bab', category: 'purple' },
  { name: 'Magenta', hex: '#c83f9c', category: 'purple' },
  { name: 'Indigo', hex: '#3a3a8c', category: 'purple' },
  { name: 'Heather', hex: '#967a9c', category: 'purple', where: 'moorland, knitwear' },

  // Pinks
  { name: 'Hot pink', hex: '#e84a96', category: 'pink' },
  { name: 'Rose pink', hex: '#dd8296', category: 'pink' },
  { name: 'Dusty pink', hex: '#c69a9c', category: 'pink' },
  { name: 'Pale pink', hex: '#f0cdd4', category: 'pink' },
  { name: 'Skin pink', hex: '#e0a48c', category: 'pink', where: 'pale skin, rashes' },
  { name: 'Flushed skin', hex: '#d68b7a', category: 'pink', where: 'sunburn, blushing, fever' },

  // Neutrals -- worth including because purples and pinks fall into them.
  { name: 'White', hex: '#f5f5f5', category: 'neutral' },
  { name: 'Light grey', hex: '#c4c4c4', category: 'neutral' },
  { name: 'Mid grey', hex: '#8f8f8f', category: 'neutral' },
  { name: 'Slate grey', hex: '#6b7280', category: 'neutral' },
  { name: 'Charcoal', hex: '#3a3f45', category: 'neutral' },
  { name: 'Warm grey', hex: '#9c9284', category: 'neutral' },
  { name: 'Greenish grey', hex: '#8a928a', category: 'neutral' },
  { name: 'Pinkish grey', hex: '#a89494', category: 'neutral' },
  { name: 'Black', hex: '#1a1a1a', category: 'neutral' },
];

export interface PaletteEntry extends NamedColor {
  readonly color: Srgb;
}

export const PALETTE_COLORS: readonly PaletteEntry[] = PALETTE.map((c) => ({
  ...c,
  color: srgbFromHex(c.hex),
}));

export const CATEGORY_LABEL: Record<PaletteCategory, string> = {
  red: 'Reds',
  orange: 'Oranges',
  yellow: 'Yellows',
  green: 'Greens',
  brown: 'Browns',
  blue: 'Blues',
  purple: 'Purples',
  pink: 'Pinks',
  neutral: 'Neutrals',
};
