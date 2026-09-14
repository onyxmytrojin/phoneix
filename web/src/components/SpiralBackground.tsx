import type { CSSProperties } from "react";
import { spiralCoilPath } from "@/lib/spiral";

const BLUE = "#2f3774";
const MID_BLUE = "#4c6394";
const TEAL = "#7ea4b0";

// Outer strand deepest, inner strand lightest — same "outer-to-inner, dark
// to light" logic used elsewhere on the site's layered accents.
const STRAND_COLORS = [BLUE, MID_BLUE, TEAL];
// Each strand is a scaled (self-similar) copy of the same base spiral, so
// they wind inward together as parallel threads rather than three
// independent spirals — "coinciding" the way twisted strands of a cable do.
const STRAND_SCALES = [1, 0.9, 0.8];

type CoilProps = {
  cx: number;
  cy: number;
  turns: number;
  startR: number;
  endR: number;
  strokeWidth: number;
  startAngleDeg?: number;
  direction?: 1 | -1;
  durationSeconds: number;
  spinDirection?: "normal" | "reverse";
};

// One tightly-wound coil made of three parallel colored strands — the same
// shape family as the small spiral "stars" in classic Starry-Night-style
// icon art: a compact wound coil, not a pinwheel of separate blades. Spins
// slowly around its own center.
function Coil({
  cx, cy, turns, startR, endR, strokeWidth,
  startAngleDeg = 0, direction = 1, durationSeconds, spinDirection = "normal",
}: CoilProps) {
  return (
    <g
      className="spiral-spin"
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        "--spiral-duration": `${durationSeconds}s`,
        "--spiral-direction": spinDirection,
      } as CSSProperties}
    >
      {STRAND_SCALES.map((scale, i) => (
        <path
          key={i}
          d={spiralCoilPath({
            cx, cy, turns, direction, startAngleDeg,
            startR: startR * scale,
            endR: endR * scale,
          })}
          fill="none"
          stroke={STRAND_COLORS[i]}
          strokeWidth={strokeWidth * 0.85}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </g>
  );
}

// Eight coils, spread across the FULL width now — free to sit behind the
// hero's own content (avatar included), since everything here is well
// behind it in stacking order and content is opaque where it needs to be.
// The main thing to avoid is evenly-spaced rows: cy is deliberately
// irregular (not just two flat bands) so they don't read as a grid or a
// single line. Confined to the top half (cy <= 480) so they still sit
// above the existing yellow wave bands. Sizes vary (small/medium/one
// larger) but capped at startR 150 — big enough to read as varied, never
// so big it dominates.
const COILS: CoilProps[] = [
  { cx: 100,  cy: 60,  turns: 3.0, startR: 70,  endR: 11, strokeWidth: 6,  durationSeconds: 45 },
  { cx: 350,  cy: 380, turns: 3.0, startR: 100, endR: 15, strokeWidth: 8,  durationSeconds: 50 },
  { cx: 620,  cy: 130, turns: 3.2, startR: 115, endR: 17, strokeWidth: 9,  durationSeconds: 55, spinDirection: "reverse" },
  { cx: 830,  cy: 340, turns: 2.8, startR: 75,  endR: 12, strokeWidth: 6,  durationSeconds: 40,  spinDirection: "reverse" },
  { cx: 1060, cy: 50,  turns: 2.8, startR: 70,  endR: 11, strokeWidth: 6,  durationSeconds: 42 },
  { cx: 1260, cy: 400, turns: 3.0, startR: 100, endR: 15, strokeWidth: 8,  durationSeconds: 47 },
  { cx: 1460, cy: 160, turns: 3.4, startR: 150, endR: 22, strokeWidth: 11, durationSeconds: 65, spinDirection: "reverse" },
  { cx: 1560, cy: 440, turns: 2.8, startR: 75,  endR: 12, strokeWidth: 6,  durationSeconds: 37,  spinDirection: "reverse" },
  // Two more filling the emptier lower-middle gap beneath the hero content.
  { cx: 590,  cy: 560, turns: 3.0, startR: 90,  endR: 14, strokeWidth: 7,  durationSeconds: 48 },
  { cx: 1080, cy: 570, turns: 2.8, startR: 85,  endR: 13, strokeWidth: 7,  durationSeconds: 44,  spinDirection: "reverse" },
  // Two small ones filling out the left side, which was sparser than the right.
  { cx: 230,  cy: 250, turns: 2.8, startR: 65,  endR: 11, strokeWidth: 5,  durationSeconds: 38 },
  { cx: 200,  cy: 550, turns: 3.0, startR: 70,  endR: 11, strokeWidth: 5,  durationSeconds: 41,  spinDirection: "reverse" },
];

export default function SpiralBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: -6, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        {COILS.map((c, i) => (
          <Coil key={i} {...c} />
        ))}
      </svg>
    </div>
  );
}
