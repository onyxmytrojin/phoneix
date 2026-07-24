import Image from "next/image";
import Nav from "@/components/Nav";
import ExperienceTabs from "@/components/ExperienceTabs";
import HeroStatus from "@/components/HeroStatus";
import GitHubActivity from "@/components/GitHubActivity";

type SkillItem = { label: string; highlight?: boolean };

const PROJECTS = [
  {
    name: "Phoneix",
    badge: { label: "LIVE", color: "#22c55e", rgb: "34,197,94" },
    desc: "Personal API + live dashboard + self-healing 3-node distributed cache running on a Pixel 7a. FastAPI backend with versioned endpoints, Go cache with consistent hashing and gossip-based failure detection.",
    tags: ["FastAPI", "Go", "Nginx", "Distributed Systems"],
    links: [
      { label: "Live", href: "/cluster" },
      { label: "GitHub", href: "https://github.com/onyxmytrojin/phoneix" },
    ],
  },
  {
    name: "Pixel Server",
    badge: { label: "RUNNING", color: "#4c8ef7", rgb: "76,142,247" },
    desc: "Turned a Google Pixel 7a into a 24/7 Linux server. GrapheneOS + Magisk root + Debian via proot-distro + Dropbear SSH + Cloudflare Tunnel. Serves real traffic at shubhanmehrotra.com.",
    tags: ["Linux", "GrapheneOS", "Cloudflare", "Nginx", "ARM64"],
    links: [{ label: "GitHub", href: "https://github.com/onyxmytrojin/pixel-server" }],
  },
  {
    name: "Weather App for Scientists",
    badge: null,
    desc: "Full-stack weather monitoring system processing 1,000+ hourly sensor data points with 99.9% ingestion uptime. Django backend + React Native frontend, integrating 8+ RESTful APIs from 20+ ground sensors.",
    tags: ["Django", "React Native", "PostgreSQL", "Redis", "Docker"],
    links: [{ label: "Paper", href: "#" }],
  },
  {
    name: "Kochi Metro Ridership Analysis",
    badge: null,
    desc: "Standardised 30M+ ticketing data points using SQL and Python, uncovering commute patterns that drove a 15% increase in targeted ridership. 5-year dataset analysis for Kerala's metro system.",
    tags: ["PostgreSQL", "Python", "Pandas", "Matplotlib"],
    links: [
      { label: "GitHub", href: "https://github.com/onyxmytrojin/kochi-metro" },
      { label: "Paper", href: "#" },
    ],
  },
  {
    name: "Baby Cry Detection — 2D CNN + LSTM",
    badge: null,
    desc: "Trained 2D CNN and LSTM models to classify baby cries into 5 health categories achieving 94.57% and 91.47% accuracy. Spectrogram features via STFT for audio signal classification.",
    tags: ["TensorFlow", "Keras", "LSTM", "CNN", "Python"],
    links: [
      { label: "GitHub", href: "https://github.com/onyxmytrojin/baby-cry" },
      { label: "Paper", href: "#" },
    ],
  },
  {
    name: "Pathway — Inter IIT Tech Meet 13.0",
    badge: null,
    desc: "Modular Agentic RAG pipeline with dynamic query classification and multi-tier retrievers. Benchmarked colBERT and BGE-m3 on MS MARCO achieving 43% NDCG@10. Top 10 finish at national competition.",
    tags: ["RAG", "colBERT", "BGE-m3", "LLM", "Python"],
    links: [
      { label: "GitHub", href: "https://github.com/onyxmytrojin/pathway" },
      { label: "Paper", href: "#" },
    ],
  },
];

const SKILLS: Record<string, SkillItem[]> = {
  "Languages":           [{ label: "Python 3" }, { label: "Go", highlight: true }, { label: "TypeScript" }, { label: "SQL" }, { label: "Java" }, { label: "C / C++" }],
  "Backend":             [{ label: "FastAPI" }, { label: "Django" }, { label: "RESTful APIs" }, { label: "Microservices" }, { label: "Event-Driven Architecture" }, { label: "Billing Systems" }],
  "Cloud & DevOps":      [{ label: "AWS Lambda" }, { label: "SQS / EventBridge" }, { label: "ECS / EC2" }, { label: "IAM / CloudWatch" }, { label: "Docker" }, { label: "Nginx" }, { label: "CI/CD" }, { label: "Cloudflare" }],
  "Databases":           [{ label: "PostgreSQL" }, { label: "MySQL" }, { label: "DynamoDB" }, { label: "SQLite" }, { label: "Redis" }],
  "Distributed Systems": [{ label: "Consistent Hashing", highlight: true }, { label: "Gossip Protocol", highlight: true }, { label: "Replication", highlight: true }, { label: "Structured Logging" }, { label: "Rate Limiting" }, { label: "Health Checks" }],
};

export default function Home() {

  return (
    <>
      <Nav />
      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "0 24px 100px" }}>

        {/* ── Hero ── */}
        <section id="home" style={{ paddingTop: "80px", textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(32px,6vw,52px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "16px", letterSpacing: "-0.02em" }}>
            Hi 👋 Shubhan here
          </h1>
          <p style={{ fontSize: "16px", color: "#9aa3b8", marginBottom: "40px", lineHeight: 1.7 }}>
            I am a <span style={{ color: "#4c8ef7", fontWeight: 600 }}>23</span> yo Software Engineer from India.
            <br />I love solving problems and building things that run on real hardware.
          </p>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
            {gh?.avatar_url && (
              <div style={{ width: "88px", height: "88px", borderRadius: "50%", overflow: "hidden", border: "3px solid #1e2030", boxShadow: "0 0 0 4px rgba(76,142,247,0.12)" }}>
                <Image src={gh.avatar_url} alt="Shubhan Mehrotra" width={88} height={88} style={{ objectFit: "cover" }} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: "18px" }}>Shubhan Mehrotra</div>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                Software Engineer ·{" "}
                <a href="https://entrupy.com" target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>Entrupy</a>
              </div>
              {gh && (
                <div style={{ fontSize: "12px", color: "#363650", marginTop: "4px" }}>
                  {gh.public_repos} repos · {gh.followers} followers
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "36px" }}>
            {[
              { label: "GitHub",   href: "https://github.com/onyxmytrojin" },
              { label: "LinkedIn", href: "https://linkedin.com/in/shubhanmehrotra" },
              { label: "Email",    href: "mailto:shubhanmehrotra@gmail.com" },
              { label: "API Docs", href: "https://api.shubhanmehrotra.com/docs" },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="hero-btn">{l.label}</a>
            ))}
          </div>

          <HeroStatus />
        </section>

        {/* ── Currently Building ── */}
        <section style={{ paddingTop: "56px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#4c8ef7", marginBottom: "14px" }}>Currently Building</h2>
          <div style={{ border: "1px solid #1a1a28", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", alignItems: "center", padding: "16px 20px", gap: "16px" }}>
              <div style={{ borderLeft: "3px solid #4c8ef7", paddingLeft: "12px" }}>
                <div style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#4c8ef7", fontWeight: 600 }}>Currently</div>
                <div style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#4c8ef7", fontWeight: 600 }}>Building</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "2px" }}>Phoneix</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Personal API + distributed cache running on a Pixel 7a</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" }}>
                {["FastAPI", "Go", "Distributed Systems"].map(t => (
                  <span key={t} style={{ fontSize: "11px", color: "#4c8ef7", background: "rgba(76,142,247,0.08)", border: "1px solid rgba(76,142,247,0.2)", borderRadius: "4px", padding: "2px 8px" }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── GitHub Activity ── */}
        <GitHubActivity />

        {/* ── Experience ── */}
        <section id="experience" style={{ paddingTop: "72px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>Experience</h2>
          <ExperienceTabs />
        </section>

        {/* ── Projects ── */}
        <section id="projects" style={{ paddingTop: "72px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>Projects</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
            {PROJECTS.map((p, i) => (
              <div key={i} className="project-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "15px" }}>{p.name}</span>
                  {p.badge && (
                    <span style={{
                      fontSize: "10px", color: p.badge.color,
                      background: `rgba(${p.badge.rgb},0.1)`,
                      border: `1px solid rgba(${p.badge.rgb},0.25)`,
                      borderRadius: "4px", padding: "1px 6px",
                      letterSpacing: "0.06em", fontWeight: 600,
                    }}>{p.badge.label}</span>
                  )}
                </div>
                <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.65, flex: 1 }}>{p.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {p.tags.map(t => (
                    <span key={t} style={{ fontSize: "11px", color: "#9aa3b8", background: "rgba(255,255,255,0.04)", border: "1px solid #1e2030", borderRadius: "4px", padding: "2px 8px" }}>{t}</span>
                  ))}
                </div>
                {p.links.length > 0 && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    {p.links.map(l => (
                      <a key={l.label} href={l.href}
                        target={l.href.startsWith("http") ? "_blank" : undefined}
                        rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                        className="proj-link-btn"
                      >{l.label}</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Skills ── */}
        <section id="skills" style={{ paddingTop: "72px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>Skills</h2>
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "12px", padding: "24px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {Object.entries(SKILLS).map(([cat, items]) => (
              <div key={cat} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "12px", alignItems: "start" }}>
                <span style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "3px" }}>{cat}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {items.map(s => (
                    <span key={s.label} style={{
                      fontSize: "12px",
                      color: s.highlight ? "#22c55e" : "#e8eaf0",
                      background: s.highlight ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.05)",
                      border: s.highlight ? "1px solid rgba(34,197,94,0.25)" : "1px solid #1e2030",
                      borderRadius: "5px", padding: "3px 10px",
                    }}>
                      {s.label}{s.highlight ? " ↑" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" style={{ paddingTop: "72px", textAlign: "center" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "24px" }}>Get in Touch</h2>
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "16px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#4c8ef7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: "#fff" }}>SM</div>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>Shubhan Mehrotra</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "300px" }}>
              <a href="mailto:shubhanmehrotra@gmail.com" className="contact-link" style={{ textAlign: "center" }}>✉ shubhanmehrotra@gmail.com</a>
              <a href="https://github.com/onyxmytrojin" target="_blank" rel="noreferrer" className="contact-link" style={{ textAlign: "center" }}>GitHub</a>
              <a href="https://linkedin.com/in/shubhanmehrotra" target="_blank" rel="noreferrer" className="contact-link" style={{ textAlign: "center" }}>LinkedIn</a>
              <a href="https://api.shubhanmehrotra.com/v1/cv" target="_blank" rel="noreferrer" className="contact-link" style={{ textAlign: "center" }}>Resume (JSON)</a>
            </div>
          </div>
          <p style={{ marginTop: "48px", fontSize: "12px", color: "#2a2a3a" }}>served from a Pixel 7a in Lucknow, India</p>
        </section>

      </main>
    </>
  );
}
