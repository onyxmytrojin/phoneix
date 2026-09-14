import HeroLinks from "@/components/HeroLinks";
import NpxCallout from "@/components/NpxCallout";
import BackgroundVideo from "@/components/BackgroundVideo";
import ScrollTransition from "@/components/ScrollTransition";
import ExperienceTabs from "@/components/ExperienceTabs";
import GitHubActivity from "@/components/GitHubActivity";
import ProjectsBoard from "@/components/ProjectsBoard";
import MainNav from "@/components/MainNav";
import WaveBackground from "@/components/WaveBackground";
import SpiralBackground from "@/components/SpiralBackground";
import { SKILLS } from "@/lib/data";
import { seeded } from "@/lib/seeded";
import { ProgrammingHoldCodeIcon, HandWaveIcon } from "@/components/Icons";

const SKILL_NOTE_COLORS = ["#f6d55c", "#e8998d", "#8fbc94", "#f4a261", "#e0c097", "#e76f51", "#c9a66b"];

export default function Landing() {
  return (
    <>
      <ScrollTransition />
      {/* DOM order matters here: the overlay must paint BEHIND the video
          (not on top of it) so fading the video out reveals the solid
          color underneath — a clean dissolve — rather than a translucent
          color wash sitting over a still-visible video. */}
      <div id="transition-overlay" className="transition-bg-overlay" aria-hidden="true" />
      <BackgroundVideo className="bg-video bg-video--right" />
      <div className="bg-video-scrim" aria-hidden="true" />

      {/* Single text-link nav bar, docked top-center in a fixed position
          across the whole page (including the hero) — replaces the old
          two-bar setup (icon rail up top + text links at the bottom). */}
      <MainNav />

      {/* ── Animated wave backdrop for Skills/Experience/Projects ── fixed
          to the viewport (not sized to the sections' combined scroll
          height) so the wave pattern stays proportioned correctly instead
          of being stretched into an unrecognizable gradient over a
          multi-thousand-pixel-tall box. Kept at the very back (-z-10, below
          .bg-video/.bg-video-scrim/#transition-overlay too) so it never
          competes with the hero video for visibility — ScrollTransition
          fades the overlay and scrim out at the end of the hero's scroll-
          hold instead, which is what actually reveals the waves once
          you're past the hero. */}
      <WaveBackground className="wave-bg-fixed" />
      {/* SpiralBackground disabled on prod — turned off by request, but the
          component is intentionally left in place (and still imported)
          rather than deleted, in case it comes back later. Small, slowly
          spinning multi-strand coils scattered across the top half only,
          well clear of the hero's own content — sat just above the yellow
          waves and still well behind all content (z-index -6, see the
          component). */}
      {/* <SpiralBackground /> */}

      <div className="landing-shell" id="hero-pin">

        <div className="landing-left" id="hero-left">

          {/* ── Hero (flattened — order/Flip targets must be direct
              siblings of .landing-left for CSS `order` to apply) ── */}
          <div className="hero-intro">
            <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "10px", letterSpacing: "-0.02em" }}>
              Hi <span className="wave-emoji"><HandWaveIcon size={34} /></span> Shubhan here
            </h1>
            {/* marginBottom below is generous (46px, not the ~16px it looks
                like it needs) deliberately: .landing-left's top padding
                differs a lot between compact/expanded states (20px vs
                96px, for top-docked-pill clearance), and Flip computes
                each child's compensating transform independently rather
                than as one rigid block — .hero-intro and .hero-avatar-row
                end up with noticeably different Y-corrections (measured
                ~28px apart), which otherwise eats into the margin between
                them and overlaps. This absorbs that gap without needing
                the corrections to line up exactly. */}
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.75)", marginBottom: "46px", lineHeight: 1.65 }}>
              I am a <span style={{ color: "#fff", fontWeight: 700 }}>23</span> yo Software Engineer from India.
              <br />I love solving problems and building things
              <br />that run on real hardware.
            </p>
          </div>

          <div className="hero-avatar-row" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <img
              src="/media/bali.jpg"
              alt="Shubhan Mehrotra"
              className="hero-avatar"
              style={{
                borderRadius: "50%", objectFit: "cover",
                border: "2px solid rgba(255,255,255,0.35)", flexShrink: 0,
              }}
            />
            <div className="hero-avatar-info">
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ fontWeight: 700, fontSize: "16px" }}>Shubhan Mehrotra</span>
                <ProgrammingHoldCodeIcon size={16} className="opacity-60" />
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                Software Engineer ·{" "}
                <a href="https://entrupy.com" target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: "#fff" }}>Entrupy</a>
              </div>
            </div>
          </div>

          <div className="hero-npx">
            <NpxCallout />
          </div>

          <div className="hero-links" id="hero-links">
            <HeroLinks />
          </div>

          {/* ── Currently Building ── the whole card is a link to the
              live project (matching what ProjectsBoard's own "Live" link
              on this same project points to), with a hover lift/glow so
              it reads as clickable rather than a static info box. */}
          <div className="hero-currently-building" style={{ paddingTop: "16px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "12px", opacity: 0.85 }}>Currently Building</h2>
            <a href="/cluster" className="hero-building-card">
              <div className="hero-building-card-body" style={{ display: "flex", flexDirection: "column", padding: "14px 18px", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ borderLeft: "3px solid #fff", paddingLeft: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "2px" }}>
                      <span style={{ fontWeight: 700, fontSize: "14px" }}>Phoneix</span>
                      <span style={{ fontSize: "9px", color: "#fff", background: "#22c55e", borderRadius: "4px", padding: "1px 6px", fontWeight: 700, letterSpacing: "0.05em" }}>LIVE</span>
                    </div>
                    <div className="hero-building-desc" style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Personal API + distributed cache running on a Pixel 7a</div>
                  </div>
                  <svg className="hero-building-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M17 7H9M17 7V15" />
                  </svg>
                </div>
                <div className="hero-building-tags" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {["FastAPI", "Go", "Distributed Systems"].map(t => (
                    <span key={t} style={{ fontSize: "11px", color: "#fff", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", padding: "2px 8px" }}>{t}</span>
                  ))}
                </div>
              </div>
            </a>
          </div>

          {/* ── Scroll cue ── only surfaces once the hero has settled into
              its expanded/centered state (the scroll-hold beat before the
              pin releases into Skills), where it isn't obvious there's
              more below. Purely decorative, so it's aria-hidden. */}
          <div className="hero-scroll-cue" aria-hidden="true">
            <span>Keep scrolling</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

        </div>
      </div>

      {/* ── Skills ── */}
      <section id="skills" className="scroll-section">
        <div className="scroll-section-inner">
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>Skills</h2>
          <div className="content-panel" style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
            {Object.entries(SKILLS).map(([cat, items], catIndex) => {
              const noteColor = SKILL_NOTE_COLORS[catIndex % SKILL_NOTE_COLORS.length];
              return (
                <div key={cat}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>{cat}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 12px" }}>
                    {items.map((s, i) => {
                      const rotate = Math.round((seeded(catIndex * 100 + i * 7 + 3) - 0.5) * 800) / 100;
                      return (
                        <span key={s.label} className="skill-note" style={{
                          color: "#2b1a08",
                          background: noteColor,
                          transform: `rotate(${rotate}deg)`,
                          outline: s.highlight ? "2px solid #1c7a3c" : "none",
                          outlineOffset: "2px",
                        }}>
                          {s.label}{s.highlight ? " ↑" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Experience ── */}
      <section id="experience" className="scroll-section">
        <div className="scroll-section-inner">
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>Experience</h2>
          <div className="content-panel">
            <ExperienceTabs />
          </div>
        </div>
      </section>

      {/* ── Projects ── a corkboard of freely draggable sticky notes rather
          than a static grid; see ProjectsBoard for the drag mechanics. ── */}
      <section id="projects" className="scroll-section">
        <div className="scroll-section-inner">
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>Projects</h2>
          <ProjectsBoard />
          <GitHubActivity />
        </div>
      </section>

      <footer style={{
        position: "relative", zIndex: 1,
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
        gap: "8px 20px", padding: "28px 24px 40px",
        fontSize: "12px", color: "rgba(255,255,255,0.5)",
      }}>
        <span>&copy; {new Date().getFullYear()} Shubhan Mehrotra</span>
        <a href="/privacy" style={{ color: "rgba(255,255,255,0.5)" }}>Privacy Policy</a>
        <a href="/terms" style={{ color: "rgba(255,255,255,0.5)" }}>Terms &amp; Conditions</a>
      </footer>
    </>
  );
}
