"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(ScrollTrigger, Flip);

// In-page nav clicks (rail links to #experience/#projects/#skills) need a
// smooth scroll — but native `scroll-behavior: smooth` fights ScrollTrigger's
// own scroll tracking and gets interrupted mid-flight (the pinned hero
// recalculates layout as it scrolls). A plain rAF loop driving window.scrollTo
// on every frame is exactly what a manual scroll looks like to ScrollTrigger,
// so it cooperates correctly instead of racing it.
function smoothScrollTo(targetY: number, duration = 900) {
  const startY = window.scrollY;
  const delta = targetY - startY;
  if (Math.abs(delta) < 1) return;
  const startTime = performance.now();
  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function step(now: number) {
    const t = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + delta * easeInOutCubic(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export default function ScrollTransition() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!link) return;
      const id = link.getAttribute("href")!.slice(1);
      e.preventDefault();
      // "#top" (used by the Contact link, which really just means "back to
      // the hero buttons") targets an absolute position instead of an
      // element inside the pinned hero. Anything in there keeps reflowing
      // *during* the scroll-up animation itself (avatar shrinking,
      // buttons/npx swapping order back) as the morph reverses, so a
      // target measured once up front stops matching reality by the time
      // the animation arrives — landing short or long depending on how
      // much the layout still had to collapse.
      if (id === "top") {
        smoothScrollTo(0);
        return;
      }
      const el = id && document.getElementById(id);
      if (!el) return;
      smoothScrollTo(window.scrollY + el.getBoundingClientRect().top);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const heroPin = document.getElementById("hero-pin");
    const heroLeft = document.getElementById("hero-left");
    const video = document.getElementById("hero-bg-video");
    const videoInner = video?.querySelector("video") ?? null;
    const overlay = document.getElementById("transition-overlay");
    const scrim = document.querySelector<HTMLElement>(".bg-video-scrim");
    if (!heroPin || !heroLeft || !video || !videoInner || !overlay || !scrim) return;

    const ctx = gsap.context(() => {
      // .hero-scroll-cue is deliberately excluded: it's meant to invite the
      // very first scroll, so it needs to just be visible from page load
      // rather than fading in as a byproduct of Flip's captured before/after
      // opacity for this element (which pinned it at its pre-scroll value —
      // 0 — until the scrub timeline had almost finished, i.e. after the
      // user had already scrolled most of the way through the hero). Since
      // its own order/size never differs between compact and expanded, it
      // still rides along correctly with heroLeft's own tracked transform —
      // this only opts it out of Flip's per-child opacity tween.
      const heroChildren = Array.from(heroLeft.children).filter(
        (el) => !el.classList.contains("hero-scroll-cue")
      ) as HTMLElement[];
      const avatar = heroLeft.querySelector<HTMLElement>(".hero-avatar");
      const avatarInfo = heroLeft.querySelector<HTMLElement>(".hero-avatar-info");

      // Content that morphs position/size/order in place: the hero block
      // and its pieces (reorder + resize via Flip's own diffing), the
      // avatar specifically (it resizes 64px -> 120px, independent of any
      // parent scale), and its sibling info block. Both of those last two
      // have to be listed TOGETHER, not just the avatar alone: `nested:
      // true` already propagates a compensating transform to arbitrary
      // descendants automatically, so an element that also gets its OWN
      // explicit correction (the avatar, for its size change) ends up
      // with two corrections that don't quite agree with a sibling that
      // only got the automatic one (the name/role text) — the two drift
      // apart and the gap between them stretches or shrinks incorrectly.
      // Tracking both explicitly keeps their corrections consistent with
      // each other. The nav bars are separate fixed-position elements
      // outside .landing-left entirely (not Flip targets at all) — they no
      // longer move or resize between scroll states, so there's nothing
      // for Flip to track for them.
      const flipTargets = [heroLeft, ...heroChildren, ...(avatar ? [avatar] : []), ...(avatarInfo ? [avatarInfo] : [])];

      // Capture the compact layout before touching any classes.
      // backgroundColor/padding are listed explicitly — Flip only
      // auto-tweens transform/width/height by default, so without this
      // they'd switch instantly the moment the end-state class is applied
      // below (which happens once, synchronously, up front) instead of
      // scrubbing in sync with everything else.
      const state = Flip.getState(flipTargets, {
        props: "opacity,backgroundColor,paddingTop,paddingLeft,paddingRight,paddingBottom",
      });

      // Apply the end state synchronously — Flip diffs against the state
      // captured above, so this doesn't cause a visible jump; it becomes
      // the tween's target instead.
      heroLeft.classList.add("landing-left--expanded");

      const flipTl = Flip.from(state, {
        targets: flipTargets,
        duration: 1,
        ease: "none",
        nested: true,
        absolute: false,
      });

      // Morph runs over timeline-time 0-1; timeline-time 1-1.5 is a pure
      // hold with nothing animating. Extending the pin's scroll distance
      // to match (150% instead of 100%) means there's a real chunk of
      // scroll where the hero sits fully expanded, at rest, before it
      // unpins — otherwise the very next scroll pixel after the morph
      // finished immediately started pushing hero text underneath the
      // fixed nav pill, with no beat to actually see the settled layout.
      const MORPH_FRACTION = 1 / 1.5;

      const master = gsap.timeline({
        scrollTrigger: {
          trigger: heroPin,
          start: "top top",
          // Shortened from +=150% — same relative morph:hold split
          // (MORPH_FRACTION is a ratio, independent of the actual pixel
          // distance), just compressed into less scrolling overall.
          end: "+=100%",
          // A numeric value (seconds of catch-up lag) instead of `true`
          // (zero-lag, exact 1:1 tracking) — that exact tracking is what
          // reads as choppy on fast/automated scrolling, since the visual
          // state jumps frame-to-frame with raw scroll deltas instead of
          // easing toward them. This also happens to be what gives
          // scrolling back up its "little friction" — the animation now
          // trails slightly behind rather than reversing instantly.
          scrub: 0.5,
          pin: true,
          // Without this, letting go of the scroll mid-transition leaves
          // the page resting in a half-morphed frame indefinitely (wrong
          // avatar size, pill mid-fade, padding not caught up yet) until
          // the user scrolls again. Snapping to whichever end is closer
          // means the hero always finishes the motion on its own, in
          // either scroll direction. The threshold sits at the morph's
          // own halfway point (not 0.5 of the whole trigger, which would
          // include the hold and snap back too easily).
          snap: {
            snapTo: (value: number) => (value < MORPH_FRACTION / 2 ? 0 : 1),
            duration: { min: 0.35, max: 0.7 },
            ease: "power2.inOut",
          },
          onUpdate: (self) => {
            // Real settledness (Flip's own morph has actually finished, not
            // just "the --expanded class is on") — gates .hero-intro's
            // text-align in globals.css. See the comment there for why
            // --expanded alone can't drive this.
            heroLeft.classList.toggle("landing-left--settled", self.progress >= MORPH_FRACTION);
          },
        },
      });

      // Handing the Flip-generated tween to the master timeline means
      // ScrollTrigger scrubs the *entire* hero morph (position, size,
      // reflow, color) continuously with scroll — properly reversible on
      // scroll-up too, rather than a discrete snap at either end.
      master.add(flipTl, 0);
      // overlay is opaque by default (globals.css) and sits behind the
      // video in the DOM, so fading the video out alone already reveals
      // it as a clean dissolve — no separate fade-in tween needed here
      // (that used to double up with the video's own fade, reading as a
      // translucent color wash sitting on top of it instead).
      // Blur lives on videoInner only, opacity+scale on the wrapper — the
      // dark "shadow" reported during the transition turned out to be an
      // unrelated GPU-compositing flicker (see the .bg-video-scrim /
      // .transition-bg-overlay translateZ(0) notes in globals.css), not
      // this blur/fade combo, so it's back.
      master.to(video, { opacity: 0, scale: 1.08, ease: "none", duration: 1 }, 0);
      master.to(videoInner, { filter: "blur(24px)", ease: "none", duration: 1 }, 0);
      master.to({}, { duration: 0.5 }); // pure hold — see MORPH_FRACTION note above

      // EXPERIMENTAL: reveals WaveBackground behind the hero's own
      // expanded/settled state, not just in Skills/Experience/Projects —
      // fades overlay+scrim out right as the hold begins (position 1,
      // i.e. right after the morph completes and the video has long since
      // faded), instead of waiting until #skills scrolls into view.
      // Requires .landing-left--expanded's own background (globals.css)
      // to also be transparent, or this would just reveal that flat color
      // instead of the wave. Revert together: restore both those flat
      // background-colors, and swap this back to the #skills-triggered,
      // non-pinned version:
      //   gsap.to([overlay, scrim], { opacity: 0, ease: "none",
      //     scrollTrigger: { trigger: "#skills", start: "top bottom",
      //       end: "top center", scrub: true } });
      master.to([overlay, scrim], { opacity: 0, ease: "none", duration: 0.3 }, 1);

      // ScrollTrigger normally computes its pixel-based start/end on the
      // window "load" event — but by the time this effect runs (after
      // hydration), that event has often already fired, so the trigger's
      // measurements are silently never (re)computed and it stays inert
      // (pin never engages, tweens never advance) despite being created
      // successfully. Forcing one explicit refresh here is what actually
      // makes it measure the page and start responding to scroll.
      ScrollTrigger.refresh();
    });

    return () => {
      // classList changes aren't GSAP-tracked, so ctx.revert() alone won't
      // undo them — without this, React 18 Strict Mode's dev-only double
      // mount leaves the classes stuck "on" from the first effect run, so
      // the second mount's Flip.getState() captures an already-expanded
      // layout and has nothing left to animate.
      heroLeft.classList.remove("landing-left--expanded");
      heroLeft.classList.remove("landing-left--settled");
      ctx.revert();
    };
  }, []);

  return null;
}
