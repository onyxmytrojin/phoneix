export type Pt = [number, number];

// Uniform Catmull-Rom -> cubic-Bezier: threads one smooth continuous curve
// through a list of sampled points, so a spiral reads as a single flowing
// line rather than a jagged polyline of straight segments.
function bezierThrough(points: Pt[]): string {
  let out = "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    out += `C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} `;
  }
  return out.trim();
}

export type SpiralCoilOptions = {
  cx: number;
  cy: number;
  startAngleDeg: number;
  /** Number of full turns the coil winds through — 2.5-4 is what actually
      reads as a tightly wound coil with several visible rings, like a
      spiral-galaxy icon, rather than a single loose hook. */
  turns: number;
  startR: number;
  endR: number;
  direction?: 1 | -1;
  steps?: number;
};

// A logarithmic (equiangular) spiral: r(theta) = startR * e^(k*theta) — the
// self-similar curve family behind a nautilus shell. Radius shrinks by a
// constant *ratio* per turn rather than a constant amount, so consecutive
// rings stay evenly, proportionally spaced apart as they wind inward
// instead of bunching up or crossing themselves.
export function spiralCoilPath(opts: SpiralCoilOptions): string {
  const { cx, cy, startAngleDeg, turns, startR, endR, direction = 1, steps = 160 } = opts;
  const totalAngle = turns * 2 * Math.PI;
  const k = Math.log(endR / startR) / totalAngle;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = totalAngle * t;
    const r = startR * Math.exp(k * theta);
    const angle = (startAngleDeg * Math.PI) / 180 + direction * theta;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} ${bezierThrough(pts)}`;
}
