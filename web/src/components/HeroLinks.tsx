"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { LinkedInIcon, PngIcon } from "@/components/Icons";

gsap.registerPlugin(ScrambleTextPlugin);

const LINKS = [
  { label: "GitHub",   href: "https://github.com/onyxmytrojin",         color: "#1b1f24", Icon: () => <PngIcon src="/icons/git.png" size={16} /> },
  { label: "LinkedIn", href: "https://linkedin.com/in/shubhanmehrotra", color: "#164a7a", Icon: () => <LinkedInIcon size={16} /> },
  { label: "Email",    href: "mailto:shubhanmehrotra@gmail.com",       color: "#a8632f", Icon: () => <PngIcon src="/icons/send-email.png" size={16} /> },
  { label: "API Docs", href: "https://api.shubhanmehrotra.com/docs",   color: "#3f6b5e", Icon: () => <PngIcon src="/icons/api-cloud.png" size={16} /> },
];

export default function HeroLinks() {
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const btnRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // Lock each button to its natural (real-label) width once, before paint —
  // the scramble effect swaps in random characters whose glyphs can render
  // narrower OR wider than the real label, which was nudging each button's
  // own width and, in a wrapping flex row, bumping the last button down for
  // a frame while it scrambled. An exact width (not min-width, which only
  // stops shrinking) means the button's box can never move in either
  // direction regardless of what the scramble animation renders inside it.
  useLayoutEffect(() => {
    btnRefs.current.forEach((el) => {
      if (!el) return;
      el.style.width = `${el.getBoundingClientRect().width}px`;
    });
  }, []);

  const handleEnter = (i: number, label: string) => {
    const el = textRefs.current[i];
    if (!el) return;
    gsap.to(el, {
      duration: 0.6,
      scrambleText: { text: label, chars: "upperCase", revealDelay: 0.15, speed: 0.4 },
      ease: "none",
      overwrite: true,
      // ScrambleTextPlugin can occasionally leave the last character off by
      // one at short durations — force the exact label once the tween ends.
      onComplete: () => { el.textContent = label; },
    });
  };

  // Belt-and-suspenders reset: relying only on onComplete/onInterrupt left
  // text stuck garbled sometimes (killing a tween via a new overwriting
  // tween doesn't reliably fire onInterrupt) — so leaving the button at all,
  // regardless of what state the scramble tween was in, always kills it and
  // restores the real label.
  const handleLeave = (i: number, label: string) => {
    const el = textRefs.current[i];
    if (!el) return;
    gsap.killTweensOf(el);
    el.textContent = label;
  };

  return (
    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "22px" }}>
      {LINKS.map((l, i) => (
        <a
          key={l.label}
          ref={(el) => { btnRefs.current[i] = el; }}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="hero-btn-color"
          style={{ background: l.color }}
          onMouseEnter={() => handleEnter(i, l.label)}
          onMouseLeave={() => handleLeave(i, l.label)}
        >
          <l.Icon />
          <span ref={(el) => { textRefs.current[i] = el; }}>{l.label}</span>
        </a>
      ))}
    </div>
  );
}
