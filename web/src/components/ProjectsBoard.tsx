"use client";

import { useRef, useState } from "react";
import { PROJECTS } from "@/lib/data";
import { seeded } from "@/lib/seeded";

const NOTE_COLORS = ["#f6d55c", "#e8998d", "#8fbc94", "#f4a261", "#e0c097", "#e76f51"];

const COLS = 3;
const ROW_HEIGHT = 300;
const COL_WIDTH_PCT = 100 / COLS;

// Rounded to 2dp — without this, the raw float (e.g. 20.180753248466015)
// serializes into the SSR'd HTML at full precision, but the browser's own
// style re-serialization on the client can round it differently, which
// React flags as a hydration mismatch even though the values are the same.
function round(n: number) {
  return Math.round(n * 100) / 100;
}

function initialLayout(i: number) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const jitterX = (seeded(i * 2 + 1) - 0.5) * (COL_WIDTH_PCT * 0.25);
  const jitterY = (seeded(i * 2 + 2) - 0.5) * 30;
  return {
    xPct: round(col * COL_WIDTH_PCT + COL_WIDTH_PCT / 2 + jitterX),
    y: round(row * ROW_HEIGHT + 30 + jitterY),
    rotate: round((seeded(i * 3 + 5) - 0.5) * 10),
  };
}

type Project = (typeof PROJECTS)[number];

function StickyNote({
  project,
  layout,
  color,
  z,
  onFocus,
}: {
  project: Project;
  layout: { xPct: number; y: number; rotate: number };
  color: string;
  z: number;
  onFocus: () => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Captured once per drag: the note's position relative to the board's
  // inner (padding-box) edge *before* this drag's movement, plus the
  // board/note sizes needed to keep the note fully inside — measured live
  // via the DOM rather than tracked in state, since it only matters while
  // a drag is in progress.
  const dragStart = useRef<{
    mouseX: number; mouseY: number;
    noteLeft: number; noteTop: number;
    maxLeft: number; maxTop: number;
    startOffset: { x: number; y: number };
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const noteEl = e.currentTarget as HTMLElement;
    noteEl.setPointerCapture(e.pointerId);
    const boardEl = noteEl.offsetParent as HTMLElement; // .sticky-board (position: relative)
    const boardRect = boardEl.getBoundingClientRect();
    const noteRect = noteEl.getBoundingClientRect();
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      noteLeft: noteRect.left - boardRect.left,
      noteTop: noteRect.top - boardRect.top,
      maxLeft: boardRect.width - noteRect.width,
      maxTop: boardRect.height - noteRect.height,
      startOffset: offset,
    };
    setDragging(true);
    onFocus();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragStart.current;
    if (!d) return;
    const dx = e.clientX - d.mouseX;
    const dy = e.clientY - d.mouseY;
    // Clamp the note's would-be position to stay fully within the board
    // (never sliding under the frame or off the edge), then translate
    // that clamped position back into a drag offset.
    const clampedLeft = Math.min(Math.max(d.noteLeft + dx, 0), Math.max(d.maxLeft, 0));
    const clampedTop = Math.min(Math.max(d.noteTop + dy, 0), Math.max(d.maxTop, 0));
    setOffset({
      x: d.startOffset.x + (clampedLeft - d.noteLeft),
      y: d.startOffset.y + (clampedTop - d.noteTop),
    });
  };
  const onPointerUp = () => {
    dragStart.current = null;
    setDragging(false);
  };

  return (
    <div
      className="sticky-note"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        left: `${layout.xPct}%`,
        top: layout.y,
        background: color,
        transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px) rotate(${layout.rotate}deg) scale(${dragging ? 1.04 : 1})`,
        zIndex: z,
        boxShadow: dragging
          ? "10px 18px 30px rgba(0,0,0,0.45)"
          : "4px 8px 16px rgba(0,0,0,0.3)",
      }}
    >
      <span className="sticky-note-tape" />
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <span style={{ fontWeight: 700, fontSize: "15px", color: "#2b1a08" }}>{project.name}</span>
        {project.badge && (
          <span style={{
            fontSize: "9px", color: "#fff", background: project.badge.color,
            borderRadius: "4px", padding: "1px 6px", letterSpacing: "0.06em", fontWeight: 700,
          }}>{project.badge.label}</span>
        )}
      </div>
      <p style={{ fontSize: "12px", color: "rgba(30,18,6,0.75)", lineHeight: 1.55, marginBottom: "8px" }}>{project.desc}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
        {project.tags.map(t => (
          <span key={t} style={{ fontSize: "10px", color: "#2b1a08", border: "1px solid rgba(43,26,8,0.3)", borderRadius: "3px", padding: "1px 6px" }}>{t}</span>
        ))}
      </div>
      {project.links.length > 0 && (
        <div style={{ display: "flex", gap: "10px" }}>
          {project.links.map(l => (
            <a key={l.label} href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noreferrer" : undefined}
              style={{ fontSize: "11px", fontWeight: 600, color: "#2b1a08", textDecoration: "underline" }}
              // dragging the note shouldn't also fire the link underneath it
              onClick={(e) => { if (dragging) e.preventDefault(); }}
            >{l.label}</a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile version ── the desktop board's fixed 3-column percentage layout
// has nowhere to go on a phone-width screen (each note is still ~270px
// wide, so three of them massively overflow a ~350px board) — and free
// dragging isn't a great fit for touch anyway. Rather than trying to make
// the same absolute-positioned/draggable layout responsive, this is a
// separate, simpler version: a plain upright vertical stack, no drag, no
// rotation. Both this and the desktop board always render; CSS
// (`.sticky-board`/`.projects-mobile-list` in globals.css) shows exactly
// one of them per viewport width, at the same breakpoint the rest of the
// site already uses for its mobile layout (640px).
function MobileProjectList() {
  return (
    <div className="projects-mobile-list">
      {PROJECTS.map((p, i) => (
        <div key={p.name} className="projects-mobile-card" style={{ background: NOTE_COLORS[i % NOTE_COLORS.length] }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontWeight: 700, fontSize: "15px", color: "#2b1a08" }}>{p.name}</span>
            {p.badge && (
              <span style={{
                fontSize: "9px", color: "#fff", background: p.badge.color,
                borderRadius: "4px", padding: "1px 6px", letterSpacing: "0.06em", fontWeight: 700,
              }}>{p.badge.label}</span>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(30,18,6,0.75)", lineHeight: 1.55, marginBottom: "8px" }}>{p.desc}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
            {p.tags.map(t => (
              <span key={t} style={{ fontSize: "10px", color: "#2b1a08", border: "1px solid rgba(43,26,8,0.3)", borderRadius: "3px", padding: "1px 6px" }}>{t}</span>
            ))}
          </div>
          {p.links.length > 0 && (
            <div style={{ display: "flex", gap: "14px" }}>
              {p.links.map(l => (
                <a key={l.label} href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                  style={{ fontSize: "12px", fontWeight: 600, color: "#2b1a08", textDecoration: "underline" }}
                >{l.label}</a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProjectsBoard() {
  const [order, setOrder] = useState(PROJECTS.map((_, i) => i));
  const bringToFront = (i: number) => setOrder(o => [...o.filter(x => x !== i), i]);
  const boardHeight = Math.ceil(PROJECTS.length / COLS) * ROW_HEIGHT + 40;

  return (
    <>
      <div className="sticky-board" style={{ height: boardHeight }}>
        {PROJECTS.map((p, i) => (
          <StickyNote
            key={p.name}
            project={p}
            layout={initialLayout(i)}
            color={NOTE_COLORS[i % NOTE_COLORS.length]}
            z={order.indexOf(i)}
            onFocus={() => bringToFront(i)}
          />
        ))}
      </div>
      <MobileProjectList />
    </>
  );
}
