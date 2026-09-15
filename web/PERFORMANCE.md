# Scroll-transition performance investigation (2026-09-15)

Reported: the hero scroll-transition animation felt janky on production
(shubhanmehrotra.com). This document records the investigation, what was
found, what was fixed, and the measurements behind each fix.

## Methodology

All measurements were taken against the **live production site**, not the
local dev server — dev mode (unminified code, HMR, React dev-mode checks)
has enough of its own overhead to make absolute numbers there unrepresentative
of what a real visitor experiences. Two techniques were used:

1. **Frame-time sampling** — a small script injected via Playwright records
   `requestAnimationFrame` deltas while a scripted interaction (scroll,
   mouse movement, or both) runs, then reports average frame time, the
   percentage of frames that blew the 16.7ms/60fps budget, the worst frame
   time, and how many frames exceeded 50ms (a stall severe enough to read as
   a stutter, not just a dropped frame).
2. **Raw Chrome DevTools tracing** (via `CDPSession` → `Tracing.start` /
   `Tracing.dataCollected`) — captures actual browser-internal events
   (`Layout`, `UpdateLayoutTree`, `Paint`, `GPUTask`, etc.) with real
   durations, used to find *what* was consuming time rather than guessing.

Root causes were confirmed by isolating one suspect at a time — injecting a
CSS override or a JS monkey-patch that disables just that one thing, then
re-running the same scripted interaction — rather than fixing something and
hoping.

## Baseline (before any fixes)

Scripted scroll through the hero transition:

| Metric | Value |
|---|---|
| Average frame time | ~19ms (60fps budget is 16.7ms) |
| Frames over 16.7ms | 52.2% |
| Worst frame | 183.5ms |
| Frames over 50ms | 9–11 per run |

## Issue 1 — redundant `will-change` hints on the background video

**Found via:** isolating suspects one at a time (video blur filter, nav
backdrop-filter, wave animation, forced GPU layers) against the live site.
Removing `will-change` + `translateZ(0)` together on `.bg-video` and
`.bg-video-inner` took the average to ~16.67ms (exactly 60fps) with zero
frames over 50ms — the single biggest win of the investigation.

**Root cause:** `.bg-video` had both `transform: translateZ(0)` (forces a
GPU compositing layer — genuinely needed, see below) *and*
`will-change: opacity, transform`. `.bg-video-inner` had
`will-change: filter`. But GSAP is already tweening exactly those
properties (opacity, transform, filter) on those elements every single
scroll frame throughout the pinned hero transition. `will-change` is a hint
that tells the browser "prepare in advance for this to change" — applying
it to something *already* continuously changing is pure bookkeeping
overhead with nothing to optimize for, not a speedup.

**Fix:** removed both `will-change` declarations. Kept
`transform: translateZ(0)` on `.bg-video` — that one is independently
justified (documented in the existing code comment): without it, Chrome can
composite the multiple stacked fixed elements in the wrong order relative
to z-index during the scroll-triggered transition.

**File:** `src/app/globals.css` (`.bg-video`, `.bg-video-inner`)

**Result (live, re-measured):** `will-change` computes to `auto` on both
elements (confirmed via `getComputedStyle`); frame-drop rate down from
52.2% to ~34%; the routine 100ms+ stalls were gone.

## Issue 2 — the hero video itself: oversized, sparse keyframes, unused audio

**Found via:** raw CDP trace analysis on the *already-fixed* site (after
Issue 1) still showed paired `RunTask`/`GPUTask` stalls up to 76ms,
correlated with high GPU memory-usage samples (~90-100MB). Cross-referenced
against `BackgroundVideo.tsx`, which — this is not a passively looping
background clip — **scrubs the video to an arbitrary timestamp on every
`requestAnimationFrame` tick while the mouse moves** (cursor X position
maps linearly to video time). Confirmed the interaction mattered: a
scripted scroll+mouse-movement test measured 45.8% of frames over budget
with spikes to 66.7ms, versus ~33% and no >50ms spikes for scroll alone.

**Root cause, three compounding issues in the source file:**
- **6609 kb/s bitrate** on a video that's frequently displayed at 24px blur
  or fading through opacity during the transition — fine detail being
  decoded and then immediately thrown away.
- **Sparse default keyframe interval.** Seeking to an arbitrary timestamp
  requires decoding forward from the nearest *prior* keyframe; with
  keyframes spaced far apart, an arbitrary seek could require decoding a
  large chunk of intermediate frames just to land on the target.
- **An embedded (unused) audio track** — the element is always `muted`, but
  browsers still allocate demux/decode resources for an audio track that's
  present in the container, whether or not it's audible.

**Fix:** re-encoded with ffmpeg —
`-an -c:v libx264 -crf 26 -g 6 -keyint_min 6 -sc_threshold 0`. Keyframe
every 6 frames (~0.25s at 24fps) means any seek lands near a keyframe
regardless of target time. Same resolution/fps/crop, so no code changes
needed beyond the file itself. Quality-checked by extracting matching
frames from both files and comparing — visually indistinguishable.

**File:** `public/media/hero_vid_yellow.mp4` → re-encoded and renamed to
`hero_vid_yellow_v2.mp4` (see Issue 3 for why it was renamed), referenced
from `src/components/BackgroundVideo.tsx`.

**Result:** 8.4MB → 1.5MB (82% smaller, also helps initial load). Combined
with Issue 3 below, eliminated the routine 130-180ms stalls that remained
after Issue 1's fix; occasional smaller stalls (50-85ms) remained until
Issue 3.

## Issue 3 — stale CDN cache after redeploying the video

**Found via:** after deploying Issue 2's fix, `curl` against the live URL
still returned the *old* 8.4MB file. SSH'd into the origin server and
confirmed the file on disk was correctly updated (1.5MB) — so the deploy
itself worked; the problem was purely Cloudflare's edge cache still serving
a stale copy under the same filename.

**Root cause:** Next's own build output (`/_next/static/...`) gets
content-hashed filenames, so every deploy is automatically a new URL with
no existing cache entry. Files under `public/` (like this video) keep a
fixed filename across deploys, so a CDN has no signal that the content
changed and keeps serving its cached copy until the TTL expires or someone
purges it. This environment doesn't have Cloudflare API/cache-purge
credentials configured (only the `cloudflared` tunnel client, which is a
different thing).

**Fix:** renamed the file to `hero_vid_yellow_v2.mp4` (and updated the one
reference in `BackgroundVideo.tsx`) — same trick as content-hashing, done
by hand. New URL, no existing cache entry, immediately fresh from origin.

**Note for future asset updates:** anything under `public/` that gets
updated in place (not through Next's own hashed build output) will hit this
same staleness issue. Either rename the file on every meaningful update, or
get Cloudflare cache-purge access configured for this project so it can be
purged directly instead.

## Issue 4 — seek threshold too fine-grained

**Found via:** even after Issues 1-3, isolating the video-scrub mechanism
itself (temporarily disabling `video.currentTime` writes entirely, via a
property-setter monkey-patch, and re-running the same test) still showed a
gap: fully disabled seeking reached 0 frames over 50ms consistently, while
seeking left on (even on the re-encoded video) still occasionally spiked to
50-85ms. Something about the seek *mechanism itself*, independent of file
encoding, still carried a cost per seek.

**Root cause:** the diff threshold gating when a new seek fires was `0.01`
(10ms of video time). At the video's time-to-pixel mapping, roughly 1-2px
of mouse movement already exceeds that — meaning essentially *any*
perceptible cursor movement triggered a fresh seek attempt on the very next
animation frame. Seeking is inherently not free even with dense keyframes;
doing it near-continuously during natural mouse movement adds up.

**Fix:** raised the threshold to `0.1` (100ms of video time, ~13px of
cursor movement per step at a typical hero width) — coarse enough to
meaningfully cut how often a seek fires, fine enough that the scrub still
reads as responsive rather than steppy.

**File:** `src/components/BackgroundVideo.tsx` (`SEEK_THRESHOLD` constant,
used in both `requestSeek` and `handleSeeked`)

**Verification:** confirmed the scrub still correctly spans the full clip
(measured `currentTime` ≈ 0 at the left edge of the hero, ≈9.2s at the
right edge, on a 10s clip) — the feature still works, just triggers less
often.

## Investigated and NOT changed

- **Nav `backdrop-filter: blur(10px)`** — an early isolation test (before
  Issues 1-4 were fixed) showed removing it improved things measurably.
  Re-tested *after* the video-related fixes: the remaining difference was
  negligible (~42.7% vs 42.0% frames over budget) — the video was the real
  cost center, and blur wasn't worth trading away the frosted-glass nav
  design for a gain that's now within noise.
- **Wave background animation** (`.animate-wave`) — modest, secondary
  contributor in early isolation testing; not revisited after the video
  fixes since its `will-change: transform` is arguably justified (the
  transform genuinely changes continuously, unlike the video's case where
  GSAP was already doing the work will-change was hinting about).

## Final state (measured on live production, several repeated runs)

| Metric | Baseline | After all fixes |
|---|---|---|
| Average frame time | ~19ms | ~16.7-17.2ms |
| Frames over 16.7ms | 52.2% | ~34-44% (run-to-run variance on remote testing) |
| Frames over 50ms | 9-11 per run | 0-2 per run |
| Worst frame observed | 183.5ms | 17.5-83ms |

The routine, severe freeze-like stalls (100ms+) that made the hero
transition feel broken are gone. Some frames still exceed the strict 60fps
budget — largely inherent to how much GSAP is tweening simultaneously
during the pinned hero morph (opacity, transform, padding, background-color
across several elements at once) plus remote-network test noise, rather
than a single remaining bug. Further improvement here would mean reducing
how much the scroll-scrubbed animation actually does per frame (fewer
simultaneously-tweened properties, or a simpler morph), which is a design
tradeoff rather than a bug fix.
