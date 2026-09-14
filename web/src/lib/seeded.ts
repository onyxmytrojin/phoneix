// Deterministic pseudo-random (sine hash) — used anywhere we want a
// consistent "random-looking" scatter (note rotation, position jitter)
// without actual Math.random(), which would differ between the server's
// render and re-renders/hydration and defeat static export besides.
export function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
