"use client";

import React from "react";

// A single periodic hump (period 720) drawn twice back-to-back (0-720,
// 720-1440) so the two halves are pixel-identical — animating the whole
// <svg> by exactly -50% therefore loops with no visible seam, instead of
// snapping back to a start frame that looks different from the last one.
const WAVE_UNIT_DOUBLED =
  "M0,100 C90,60 270,60 360,100 C450,140 630,140 720,100 " +
  "C810,60 990,60 1080,100 C1170,140 1350,140 1440,100 " +
  "L1440,200 L0,200 Z";

function WaveLayer({
  color,
  duration,
  direction,
  top,
}: {
  color: string;
  duration: number;
  direction: 1 | -1;
  top: string;
}) {
  return (
    <div
      className="absolute left-0 w-[200%] h-full animate-wave"
      style={{
        top,
        animationDuration: `${duration}s`,
        animationDirection: direction === 1 ? "normal" : "reverse",
      }}
    >
      <svg viewBox="0 0 1440 200" width="100%" height="100%" preserveAspectRatio="none">
        <path fill={color} d={WAVE_UNIT_DOUBLED} />
      </svg>
    </div>
  );
}

type WaveBackgroundProps = {
  colors?: [string, string, string, string];
  speeds?: [number, number, number]; // seconds per loop, back to front
  children?: React.ReactNode;
  // Extra classes for the outer wrapper — lets a caller swap `relative
  // w-full h-full` for e.g. `absolute inset-0` when this is used as a
  // backdrop behind separately-sized content rather than a self-contained
  // block. Kept out of the prompt's original API but harmless additively.
  className?: string;
};

// The site's exact dark yellow (#d38a21) is the dominant/base color here —
// it's what the hero and every other surface already use, so this has to
// read as "the same background, now with waves in it" rather than a
// different, lighter palette bleeding in around the hero. The three
// animated layers are subtle variations within the same narrow range
// (not the light-pale-to-dark spread this started as), just enough to be
// visible as waves without ever looking like a different background.
const DEFAULT_COLORS: [string, string, string, string] = ["#d38a21", "#c17f1e", "#dd9a35", "#e8ac4d"];
const DEFAULT_SPEEDS: [number, number, number] = [24, 17, 10];

export default function WaveBackground({
  colors = DEFAULT_COLORS,
  speeds = DEFAULT_SPEEDS,
  children,
  className = "relative w-full h-full",
}: WaveBackgroundProps) {
  const [base, mid1, mid2, front] = colors;
  const [d1, d2, d3] = speeds;

  return (
    <div className={`${className} overflow-hidden isolate`} style={{ background: base }}>
      <WaveLayer color={mid1} duration={d1} direction={1} top="20%" />
      <WaveLayer color={mid2} duration={d2} direction={-1} top="40%" />
      <WaveLayer color={front} duration={d3} direction={1} top="60%" />
      {children}
    </div>
  );
}
