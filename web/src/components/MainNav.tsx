"use client";

import { useRef, useState } from "react";

// Single nav bar now (the old icon rail is gone) — plain text links, docked
// top-center in every scroll state, including the hero itself.
const NAV_LINKS = [
  { href: "#top",                          label: "Home",        download: false },
  { href: "#skills",                       label: "Skills",      download: false },
  { href: "#experience",                   label: "Experience",  download: false },
  { href: "#projects",                     label: "Projects",    download: false },
  { href: "/Shubhan_Mehrotra_Resume.pdf",  label: "Download CV", download: true },
  { href: "/server",                       label: "Server",      download: false },
];

type BlobRect = { left: number; top: number; width: number; height: number };

export default function MainNav() {
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [blob, setBlob] = useState<BlobRect | null>(null);
  const [morphing, setMorphing] = useState(false);
  const activeIndex = useRef<number | null>(null);

  const moveBlobTo = (i: number) => {
    const nav = navRef.current;
    const el = itemRefs.current[i];
    if (!nav || !el) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const alreadyShowing = activeIndex.current !== null;
    activeIndex.current = i;
    setBlob({
      left: elRect.left - navRect.left,
      top: elRect.top - navRect.top,
      width: elRect.width,
      height: elRect.height,
    });
    // Only wobble when hopping from one link to another — the very first
    // appearance should just fade in, not squish out of nowhere.
    if (alreadyShowing) {
      setMorphing(true);
      window.setTimeout(() => setMorphing(false), 380);
    }
  };
  const hideBlob = () => {
    activeIndex.current = null;
    setBlob(null);
  };

  return (
    <nav className="landing-nav" aria-label="Primary" ref={navRef} onMouseLeave={hideBlob}>
      {blob && (
        <div
          className={morphing ? "nav-liquid-blob morphing" : "nav-liquid-blob"}
          onAnimationEnd={() => setMorphing(false)}
          style={{ left: blob.left, top: blob.top, width: blob.width, height: blob.height }}
        />
      )}
      {NAV_LINKS.map(({ href, label, download }, i) => (
        <a
          key={href}
          href={href}
          download={download ? "Shubhan_Mehrotra_Resume.pdf" : undefined}
          ref={(el) => { itemRefs.current[i] = el; }}
          onMouseEnter={() => moveBlobTo(i)}
          onFocus={() => moveBlobTo(i)}
          onBlur={hideBlob}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
