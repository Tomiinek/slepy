/** Minimal 3x3 / 3-vector linear algebra. Row-major: m[row][col]. */

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out as unknown as Mat3;
}

export function determinant(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

export function invert(m: Mat3): Mat3 {
  const det = determinant(m);
  if (Math.abs(det) < 1e-18) throw new Error('Matrix is singular and cannot be inverted');
  const d = 1 / det;
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * d,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * d,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * d,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * d,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * d,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * d,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * d,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * d,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * d,
    ],
  ];
}

export const IDENTITY3: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Element-wise interpolation between two matrices, t = 0 gives `a`. */
export function lerpMat3(a: Mat3, b: Mat3, t: number): Mat3 {
  const out: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) out[i][j] = a[i][j] + (b[i][j] - a[i][j]) * t;
  }
  return out as unknown as Mat3;
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
