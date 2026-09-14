export type SkillItem = { label: string; highlight?: boolean };

export const PROJECTS = [
  {
    name: "Phoneix",
    badge: { label: "LIVE", color: "#22c55e" },
    desc: "Personal API + live dashboard + self-healing 3-node distributed cache running on a Pixel 7a. FastAPI backend with versioned endpoints, Go cache with consistent hashing and gossip-based failure detection.",
    tags: ["FastAPI", "Go", "Nginx", "Distributed Systems"],
    links: [
      { label: "Live", href: "/cluster" },
      { label: "GitHub", href: "https://github.com/onyxmytrojin/phoneix" },
    ],
  },
  {
    name: "Pixel Server",
    badge: { label: "RUNNING", color: "#4c8ef7" },
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
      { label: "GitHub", href: "https://github.com/onyxmytrojin/Deciphering-Ridership-and-Travel-Demand-Patterns-from-Kochi-Metro-s-5-Year-Ticketing-Data" },
      { label: "Paper", href: "#" },
    ],
  },
  {
    name: "Baby Cry Detection — 2D CNN + LSTM",
    badge: null,
    desc: "Trained 2D CNN and LSTM models to classify baby cries into 5 health categories achieving 94.57% and 91.47% accuracy. Spectrogram features via STFT for audio signal classification.",
    tags: ["TensorFlow", "Keras", "LSTM", "CNN", "Python"],
    links: [
      { label: "GitHub", href: "https://github.com/onyxmytrojin/Baby-Cry-Sound-Detection-for-Baby-Health-and-Wellness-Monitoring-using-2D-CNN-and-LSTM" },
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
  {
    name: "Ollive — LLM Inference Logger",
    badge: null,
    desc: "LLM inference observability: a decorator auto-instruments any provider call, streaming logs through HTTP → Kafka → ClickHouse decoupled from the request path, with PII redacted before it ever leaves the process.",
    tags: ["Python", "Django", "React", "Kafka", "ClickHouse", "Kubernetes"],
    links: [{ label: "GitHub", href: "https://github.com/onyxmytrojin/ollive-inference-logger" }],
  },
  {
    name: "SecureLife CRM",
    badge: null,
    desc: "AI-powered insurance CRM — conversational lead qualification, Claude-driven PDF policy extraction, and LLM coverage-gap analysis, wrapped in a Kanban pipeline board for the sales team.",
    tags: ["Next.js", "TypeScript", "Supabase", "Groq", "Claude"],
    links: [{ label: "GitHub", href: "https://github.com/onyxmytrojin/securelife-crm" }],
  },
];

export const SKILLS: Record<string, SkillItem[]> = {
  "Languages":           [{ label: "Python 3" }, { label: "Go", highlight: true }, { label: "TypeScript" }, { label: "SQL" }, { label: "Java" }, { label: "C / C++" }],
  "Backend":             [{ label: "FastAPI" }, { label: "Django" }, { label: "RESTful APIs" }, { label: "Microservices" }, { label: "Event-Driven Architecture" }, { label: "Billing Systems" }],
  "Cloud & DevOps":      [{ label: "AWS Lambda" }, { label: "SQS / EventBridge" }, { label: "ECS / EC2" }, { label: "IAM / CloudWatch" }, { label: "Docker" }, { label: "Nginx" }, { label: "CI/CD" }, { label: "Cloudflare" }],
  "Databases":           [{ label: "PostgreSQL" }, { label: "MySQL" }, { label: "DynamoDB" }, { label: "SQLite" }, { label: "Redis" }],
  "Distributed Systems": [{ label: "Consistent Hashing", highlight: true }, { label: "Gossip Protocol", highlight: true }, { label: "Replication", highlight: true }, { label: "Structured Logging" }, { label: "Rate Limiting" }, { label: "Health Checks" }],
  "Data & Analytics":    [{ label: "SQL Optimization" }, { label: "ETL Pipelines" }, { label: "CSV / Pivot Reports" }],
  "Tools":               [{ label: "Git" }, { label: "PostHog" }, { label: "HubSpot" }, { label: "Chargebee" }, { label: "Slack API" }],
};
