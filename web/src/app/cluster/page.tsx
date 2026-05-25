"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const API = "https://api.shubhanmehrotra.com";

type NodeData = {
  node_id?: string; id?: string; status?: string; port?: number;
  keys_held?: number; uptime_seconds?: number; requests_total?: number;
  user_ops?: number; get_p50_us?: number; memory_bytes?: number;
  hits?: number; misses?: number; recent_cmds?: string[];
  peer_states?: Record<string, string>; error?: string;
};
type ClusterData = {
  nodes: NodeData[];
  summary?: { alive?: number; total?: number; total_keys?: number };
  ring?: { ownership?: Record<string, number> };
};
type KeyData = { key: string; node_id: string; hits?: number; ttl_seconds?: number };
type Ev = { time: string; cls: string; text: string };

const C = {
  bg: "#0e1117", surf: "#161c27", border: "#252d3d",
  text: "#e4eaf5", muted: "#6e7d99",
  accent: "#4c8ef7", alive: "#34c47c", suspect: "#f0a500", dead: "#e05252",
};

const sc = (s?: string) => ["alive","suspect","dead"].includes(s ?? "") ? s! : "unreachable";
const sColor = (s: string) => s === "alive" ? C.alive : s === "suspect" ? C.suspect : C.dead;

function fmtUp(s?: number) {
  if (s == null) return "—";
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}
function fmtMem(b?: number) {
  if (!b) return "—";
  return b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`;
}
function fmtTTL(t?: number) {
  if (t == null) return "—";
  if (t < 0) return "∞";
  if (t < 60) return `${t}s`;
  if (t < 3600) return `${Math.floor(t/60)}m ${t%60}s`;
  return `${Math.floor(t/3600)}h`;
}
function fmtUs(us: number) {
  if (us < 1000) return `${us}µs`;
  return `${(us/1000).toFixed(2)}ms`;
}
function hhmm() { return new Date().toTimeString().slice(0,8); }
function dedupe(arr: string[]) {
  const out: {cmd:string;count:number}[] = [];
  for (const c of arr) {
    if (out.length && out[out.length-1].cmd === c) out[out.length-1].count++;
    else out.push({cmd:c,count:1});
  }
  return out;
}

// ── Hash Ring SVG ──────────────────────────────────────────────────
const NODE_COLORS = ["#4c8ef7","#34c47c","#f0a500"];
const ARC_DEFS = [{s:150,e:270},{s:270,e:30},{s:30,e:150}];
const toRad = (d: number) => d * Math.PI / 180;

function arcD(cx: number, cy: number, r: number, s: number, e: number) {
  const x1=cx+r*Math.cos(toRad(s)), y1=cy+r*Math.sin(toRad(s));
  const x2=cx+r*Math.cos(toRad(e)), y2=cy+r*Math.sin(toRad(e));
  const span = ((e-s)+360)%360, lg = span>180?1:0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function HashRing({ nodes }: { nodes: NodeData[] }) {
  const cx=96, cy=96, r=60;
  const angles = [-90, 30, 150];
  const pts = nodes.slice(0,3).map((n,i) => {
    const a = toRad(angles[i]);
    const x = cx+r*Math.cos(a), y = cy+r*Math.sin(a);
    const st = sc(n.status);
    const dead = st==="dead"||st==="unreachable";
    const lf = r+22;
    return { x, y, dead, dim: dead?0.35:1,
      lx: cx+lf*Math.cos(a), ly: cy+lf*Math.sin(a),
      short: (n.node_id||n.id||`n${i}`).replace("node-",""),
      color: NODE_COLORS[i]||C.accent, keys: n.keys_held??""
    };
  });
  return (
    <svg viewBox="0 0 192 192" style={{width:"100%",maxWidth:"172px"}}>
      {pts.map((p,i) => !p.dead && ARC_DEFS[i] && (
        <path key={i} d={arcD(cx,cy,r,ARC_DEFS[i].s,ARC_DEFS[i].e)}
          fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round" opacity="0.55"/>
      ))}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="1"/>
      {pts.map((a,i) => { const b=pts[(i+1)%pts.length]; const bd=a.dead&&b.dead; return (
        <line key={i} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)}
          stroke={C.border} strokeWidth="1" strokeDasharray={bd?"3 3":"none"} opacity={bd?0.3:0.45}/>
      );})}
      {pts.map((p,i) => (
        <g key={i} opacity={p.dim}>
          <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="10"
            fill={p.color} fillOpacity={p.dead?0.05:0.18} stroke={p.color} strokeWidth="1.5"/>
          {p.keys!=="" && <text x={p.x.toFixed(1)} y={(p.y+3.5).toFixed(1)}
            textAnchor="middle" fill={p.color} fontSize="8" fontFamily="monospace">{p.keys}</text>}
          <text x={p.lx.toFixed(1)} y={(p.ly+3).toFixed(1)}
            textAnchor="middle" fill={C.muted} fontSize="9" fontFamily="monospace">{p.short}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function ClusterPage() {
  const [data,      setData]      = useState<ClusterData|null>(null);
  const [keys,      setKeys]      = useState<KeyData[]>([]);
  const [events,    setEvents]    = useState<Ev[]>([]);
  const [ts,        setTs]        = useState<string>("connecting…");
  const [savings,   setSavings]   = useState("—");
  const [selKey,    setSelKey]    = useState<string|null>(null);
  const [keyVal,    setKeyVal]    = useState<string|null>(null);
  const [rebal,     setRebal]     = useState(false);

  const prevStates = useRef<Record<string,string>>({});
  const prevKeys   = useRef<Set<string>>(new Set());

  const push = (node: string, from: string, to: string) => {
    const cls = to==="alive"?"alive":to==="dead"?"dead":to==="suspect"?"suspect":"info";
    const text = from ? `${node}  ${from} → ${to}` : `${node}  ${to}`;
    setEvents(p => [{time:hhmm(),cls,text},...p].slice(0,30));
  };

  const fetchCluster = async () => {
    const d = await fetch(`${API}/v1/cluster`,{cache:"no-store"}).then(r=>r.json()).catch(()=>null);
    if (!d) return;
    setData(d);
    setTs(new Date().toTimeString().slice(0,8));
    const ps = prevStates.current;
    (d.nodes||[]).forEach((n: NodeData) => {
      const id = n.node_id||n.id||"";
      if (ps[id] !== undefined && ps[id] !== n.status) push(id, ps[id], n.status||"");
      ps[id] = n.status||"";
      if (n.peer_states) Object.entries(n.peer_states).forEach(([pid,pst]) => {
        const k=`${id}→${pid}`;
        if (ps[k]!==undefined && ps[k]!==pst) push(`${id} sees ${pid}`, ps[k], pst as string);
        ps[k] = pst as string;
      });
    });
    prevStates.current = ps;
  };

  const fetchKeys = async () => {
    const d = await fetch(`${API}/v1/cluster/keys`,{cache:"no-store"}).then(r=>r.json()).catch(()=>null);
    if (!d?.keys) return;
    const kl: KeyData[] = d.keys;
    const cur = new Set(kl.map((k:KeyData)=>k.key));
    const pk = prevKeys.current;
    cur.forEach(k => { if (!pk.has(k)) { const own=kl.find(e=>e.key===k)?.node_id||"?"; push(`key:${k}`,"",`cached on ${own}`); }});
    pk.forEach(k => { if (!cur.has(k)) push(`key:${k}`,"","expired / evicted"); });
    prevKeys.current = cur;
    setKeys(kl);
    const gh = kl.filter(k=>k.key.startsWith("gh:")).reduce((s,k)=>s+(k.hits||0),0);
    setSavings(gh>0?`${gh} · ~${gh*3}s`:"—");
  };

  useEffect(() => {
    push("cluster","","connecting…");
    fetchCluster(); fetchKeys();
    const ci = setInterval(fetchCluster, 5000);
    const ki = setInterval(fetchKeys, 5000);
    return () => { clearInterval(ci); clearInterval(ki); };
  }, []);

  const triggerRebal = async () => {
    setRebal(true);
    try {
      await fetch(`${API}/v1/cluster/rebalance`,{method:"POST"});
      push("rebalance","","triggered");
    } catch { push("rebalance","","failed"); } finally { setRebal(false); }
  };

  // Aggregate
  let tHits=0, tMiss=0, p50s=0, p50n=0;
  (data?.nodes||[]).forEach(n => {
    if (n.status==="alive") {
      tHits+=n.hits||0; tMiss+=n.misses||0;
      if (n.get_p50_us && n.get_p50_us>0) { p50s+=n.get_p50_us; p50n++; }
    }
  });
  const cTotal=tHits+tMiss;
  const hr = cTotal>0?(tHits/cTotal*100).toFixed(1)+"%":"—";
  const avgP50us = p50n>0?p50s/p50n:0;
  const avgP50ms = avgP50us/1000;
  const p50Str = avgP50us>0?fmtUs(Math.round(avgP50us)):null;
  const speedup = avgP50ms>0?Math.round(3000/avgP50ms):0;
  const latPct  = (ms: number) => {
    if (ms<=0) return 0;
    const lo=Math.log10(0.001), hi=Math.log10(3000);
    return Math.max(0.5,Math.min(96,(Math.log10(ms)-lo)/(hi-lo)*100));
  };

  // Group keys
  const grouped: Record<string,KeyData[]> = {};
  keys.forEach(k => { (grouped[k.key]||(grouped[k.key]=[])).push(k); });
  const ukeys = Object.keys(grouped);

  const ring = data?.ring?.ownership||{};
  const alive = data?.summary?.alive, total = data?.summary?.total, totalK = data?.summary?.total_keys;

  const ROW = ({ l, v, sm }: { l: string; v: React.ReactNode; sm?: boolean }) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
      <span style={{fontSize: sm?"9px":"10px",color:C.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>{l}</span>
      <span style={{fontSize: sm?"10px":"12px",color: sm?C.muted:C.text,fontVariantNumeric:"tabular-nums"}}>{v}</span>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Cascadia Code','JetBrains Mono','Fira Mono',ui-monospace,'Courier New',monospace",fontSize:"13px"}}>

      {/* ── Header ── */}
      <header style={{position:"sticky",top:0,zIndex:10,display:"flex",alignItems:"center",gap:"24px",padding:"0 24px",height:"52px",background:C.surf,borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:"13px",fontWeight:600,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
          <Link href="/" style={{color:C.muted,fontWeight:400,textDecoration:"none"}}>phoneix</Link>
          <span style={{color:C.muted}}> / </span>
          <span>cache cluster</span>
        </div>
        <div style={{display:"flex",gap:"20px",marginRight:"auto"}}>
          {[
            {v:alive!=null&&total!=null?`${alive}/${total}`:"—", l:"nodes alive"},
            {v:totalK??"—",                                      l:"total keys"},
            {v:hr,                                               l:"hit rate"},
            {v:savings,                                          l:"github calls saved"},
          ].map(s=>(
            <div key={s.l} style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontSize:"17px",fontWeight:700,lineHeight:1.1,fontVariantNumeric:"tabular-nums"}}>{String(s.v)}</span>
              <span style={{fontSize:"10px",color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.l}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
          <span style={{fontSize:"11px",color:C.muted,fontVariantNumeric:"tabular-nums"}}>{ts}</span>
          <button onClick={triggerRebal} disabled={rebal} style={{padding:"5px 13px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:"3px",color:C.text,fontFamily:"inherit",fontSize:"11px",letterSpacing:"0.04em",cursor:rebal?"default":"pointer",opacity:rebal?0.45:1}}>{rebal?"…":"rebalance"}</button>
          <Link href="/server" style={{color:C.muted,fontSize:"11px",textDecoration:"none"}}>← server</Link>
          <a href="https://api.shubhanmehrotra.com/docs" target="_blank" rel="noreferrer" style={{color:C.accent,fontSize:"11px",textDecoration:"none"}}>api docs ↗</a>
        </div>
      </header>

      <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:"16px",maxWidth:"1080px"}}>

        {/* ── Node cards + ring ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr) 196px",gap:"12px",alignItems:"start"}}>
          {data ? data.nodes.map((n,i) => {
            const id  = n.node_id||n.id||"?";
            const st  = sc(n.status);
            const dead = st==="dead"||st==="unreachable";
            const own = ring[id];
            const hits=n.hits||0, miss=n.misses||0, hmT=hits+miss;
            const hr2 = hmT>0?hits/hmT*100:null;
            const hrc = hr2==null?C.alive:hr2>80?C.alive:hr2>50?C.suspect:C.dead;
            const p50 = n.get_p50_us&&n.get_p50_us>0?fmtUs(n.get_p50_us):null;
            const cmds = dedupe((n.recent_cmds||[]).slice().reverse().slice(0,4));
            if (st==="unreachable") return (
              <div key={id} style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"5px",overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 13px",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:"13px",fontWeight:600}}>{id}</span>
                  <span style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"10px",color:C.muted}}>
                    <span style={{width:"7px",height:"7px",borderRadius:"50%",background:C.muted}}/>unreachable
                  </span>
                </div>
                <div style={{fontSize:"11px",color:C.dead,padding:"11px 13px"}}>{n.error||"no response"}</div>
              </div>
            );
            return (
              <div key={id} style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"5px",overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 13px",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:"13px",fontWeight:600}}>
                    {id}<span style={{color:C.muted,fontWeight:400}}>{n.port?`:${n.port}`:""}</span>
                  </span>
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    {own!=null&&<span style={{fontSize:"10px",color:C.muted,fontVariantNumeric:"tabular-nums"}}>{own.toFixed(1)}%</span>}
                    <span style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"10px",letterSpacing:"0.07em",textTransform:"uppercase",color:sColor(st)}}>
                      <span style={{width:"7px",height:"7px",borderRadius:"50%",background:sColor(st),boxShadow:st==="alive"?`0 0 0 2px color-mix(in srgb,${sColor(st)} 22%,transparent)`:"none"}}/>
                      {n.status}
                    </span>
                  </div>
                </div>
                <div style={{padding:"11px 13px",display:"flex",flexDirection:"column",gap:"7px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <span style={{fontSize:"10px",color:C.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>keys held</span>
                    <span style={{fontSize:"24px",fontWeight:700,lineHeight:1}}>{n.keys_held??"—"}</span>
                  </div>
                  {n.uptime_seconds!=null && <ROW l="uptime"  v={fmtUp(n.uptime_seconds)}/>}
                  {n.user_ops!=null       && <ROW l="user ops" v={n.user_ops.toLocaleString()}/>}
                  {p50                    && <ROW l="get p50"  v={<span style={{color:C.alive}}>{p50}</span>}/>}
                  {n.requests_total!=null && <ROW l="gossip + internal" v={n.requests_total.toLocaleString()} sm/>}
                  {n.memory_bytes         && <ROW l="memory"   v={fmtMem(n.memory_bytes)}/>}

                  {hr2!==null&&<>
                    <hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"2px 0"}}/>
                    <ROW l="cache efficiency" v={<span style={{color:hrc}}>{hr2.toFixed(1)}%</span>}/>
                    <div style={{height:"4px",background:`color-mix(in srgb,${C.dead} 20%,transparent)`,borderRadius:"2px",overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${hr2.toFixed(1)}%`,background:hrc,borderRadius:"2px",transition:"width .5s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:"9px",color:C.muted}}>{hits.toLocaleString()} hits</span>
                      <span style={{fontSize:"9px",color:C.muted}}>{miss.toLocaleString()} misses</span>
                    </div>
                  </>}

                  {n.peer_states&&Object.keys(n.peer_states).length>0&&<>
                    <hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"2px 0"}}/>
                    {Object.entries(n.peer_states).map(([pid,pst])=>(
                      <div key={pid} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:"11px",color:C.muted}}>{pid}</span>
                        <span style={{fontSize:"10px",letterSpacing:"0.05em",textTransform:"uppercase",padding:"1px 6px",borderRadius:"3px",color:sColor(sc(pst as string)),background:`color-mix(in srgb,${sColor(sc(pst as string))} 14%,transparent)`}}>{pst}</span>
                      </div>
                    ))}
                  </>}

                  {cmds.length>0&&<>
                    <hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"2px 0"}}/>
                    <div style={{fontSize:"9px",letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:"2px"}}>Recent Cmds</div>
                    {cmds.map((c,ci)=>(
                      <div key={ci} style={{fontSize:"10px",color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4}}>
                        <span style={{color:C.accent,fontWeight:600}}>{c.cmd.split(" ")[0]}</span>
                        {" "}<span style={{color:C.text}}>{c.cmd.split(" ").slice(1).join(" ").slice(0,20)}</span>
                        {c.count>1&&<span style={{color:C.muted,fontSize:"9px"}}> ×{c.count}</span>}
                      </div>
                    ))}
                  </>}
                </div>
              </div>
            );
          }) : (
            <div style={{gridColumn:"1/-1",padding:"32px 0",color:C.muted,textAlign:"center",letterSpacing:"0.05em"}}>
              connecting to cluster…
            </div>
          )}

          {/* Hash ring */}
          <div style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"5px",padding:"12px 10px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px"}}>
            <div style={{fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,alignSelf:"flex-start"}}>Hash Ring</div>
            {data&&<HashRing nodes={data.nodes}/>}
          </div>
        </div>

        {/* ── Latency comparison ── */}
        {p50Str&&(
          <div style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"5px",padding:"11px 13px",display:"flex",flexDirection:"column",gap:"8px"}}>
            <div style={{fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted}}>Latency Comparison</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {[
                {l:"cache hit p50", pct:latPct(avgP50ms), col:C.alive, val:p50Str, vc:C.alive},
                {l:"github api",    pct:100,               col:C.dead,  val:"~3000ms", vc:C.dead},
              ].map(row=>(
                <div key={row.l} style={{display:"grid",gridTemplateColumns:"90px 1fr 72px",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"10px",color:C.muted,letterSpacing:"0.04em"}}>{row.l}</span>
                  <div style={{height:"6px",background:`color-mix(in srgb,${C.border} 80%,transparent)`,borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${row.pct}%`,background:row.col,borderRadius:"3px",transition:"width .5s"}}/>
                  </div>
                  <span style={{fontSize:"11px",color:row.vc,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{row.val}</span>
                </div>
              ))}
            </div>
            {speedup>1&&<div style={{fontSize:"11px",color:C.alive,letterSpacing:"0.03em",marginTop:"2px"}}>{speedup.toLocaleString()}× faster than a live GitHub API call</div>}
          </div>
        )}

        {/* ── Key browser ── */}
        <div style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"5px",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 13px",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted}}>Key Browser</span>
            <span style={{fontSize:"11px",color:C.muted}}>{ukeys.length} key{ukeys.length!==1?"s":""}</span>
          </div>
          {ukeys.length===0 ? (
            <div style={{padding:"14px 13px",fontSize:"11px",color:C.muted}}>No keys cached. Hit <code>/v1/github</code> or <code>/v1/projects</code> to populate.</div>
          ) : ukeys.map(kn => {
            const copies = grouped[kn];
            const primary = copies.reduce((a,b)=>((b.hits||0)>(a.hits||0)?b:a));
            const th = copies.reduce((s,c)=>s+(c.hits||0),0);
            const ttl = primary.ttl_seconds;
            const tcol = ttl==null||ttl<0?C.alive:ttl>600?C.alive:ttl>60?C.suspect:C.dead;
            const tpct = ttl==null||ttl<0?100:Math.max(2,Math.min(100,(ttl/3600)*100));
            return (
              <div key={kn} onClick={()=>{setSelKey(kn);setKeyVal(copies.map(c=>`node: ${c.node_id}\nhits: ${c.hits??0}\nttl: ${fmtTTL(c.ttl_seconds)}`).join("\n---\n"));}} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"10px",alignItems:"center",padding:"7px 13px",borderBottom:`1px solid color-mix(in srgb,${C.border} 55%,transparent)`,fontSize:"11px",cursor:"pointer"}}>
                <span style={{fontSize:"12px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{kn}</span>
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <span style={{fontSize:"10px",color:C.accent,padding:"1px 6px",background:`color-mix(in srgb,${C.accent} 12%,transparent)`,borderRadius:"3px",whiteSpace:"nowrap"}}>{primary.node_id}</span>
                  {copies.length>1&&<span style={{fontSize:"9px",color:C.muted}}>×{copies.length}</span>}
                </span>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  {th>0&&<span style={{fontSize:"10px",color:C.muted,fontVariantNumeric:"tabular-nums"}}>{th} hit{th!==1?"s":""}</span>}
                  <div style={{width:"64px",height:"4px",background:`color-mix(in srgb,${C.border} 80%,transparent)`,borderRadius:"2px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${tpct}%`,background:tcol,borderRadius:"2px",transition:"width .5s"}}/>
                  </div>
                  <span style={{fontSize:"10px",color:C.muted,fontVariantNumeric:"tabular-nums",minWidth:"52px",textAlign:"right"}}>{fmtTTL(ttl)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Gossip events ── */}
        <div style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"5px",overflow:"hidden"}}>
          <div style={{padding:"7px 13px",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted}}>Gossip Events</span>
          </div>
          <div style={{maxHeight:"140px",overflowY:"auto"}}>
            {events.length===0 ? (
              <div style={{padding:"14px 13px",fontSize:"11px",color:C.muted}}>Watching for state changes…</div>
            ) : events.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"5px 13px",borderBottom:`1px solid color-mix(in srgb,${C.border} 55%,transparent)`,fontSize:"11px"}}>
                <span style={{color:C.muted,fontVariantNumeric:"tabular-nums",minWidth:"54px",flexShrink:0}}>{e.time}</span>
                <span style={{width:"6px",height:"6px",borderRadius:"50%",flexShrink:0,background:e.cls==="alive"?C.alive:e.cls==="suspect"?C.suspect:e.cls==="dead"?C.dead:C.accent}}/>
                <span style={{color:C.text}}>{e.text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Key value modal ── */}
      {selKey&&(
        <div onClick={()=>setSelKey(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.62)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:"6px",minWidth:"320px",maxWidth:"680px",width:"90vw",overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.55)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 13px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:"12px",fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selKey}</span>
              <button onClick={()=>setSelKey(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"18px",lineHeight:1,padding:"0 2px"}}>×</button>
            </div>
            <pre style={{padding:"13px",fontSize:"11px",color:C.text,maxHeight:"340px",overflowY:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",lineHeight:1.65,margin:0}}>{keyVal??""}</pre>
          </div>
        </div>
      )}

    </div>
  );
}
