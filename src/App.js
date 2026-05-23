import React, { useState, useRef, useEffect } from "react";

// ============================================================
// CONSTANTS & CONFIG
// ============================================================
const ROLES = { FOUNDER: "founder", OPERATIONS: "operations", DESIGNER: "designer" };

const USERS = [
  { id: 1, name: "Sheldon", role: ROLES.FOUNDER, email: "sheldon@listpeak.com", pin: "1234" },
  { id: 2, name: "Sati", role: ROLES.OPERATIONS, email: "sati@listpeak.com", pin: "5678" },
  { id: 3, name: "Hayden", role: ROLES.DESIGNER, email: "hayden@listpeak.com", pin: "9012" },
];

const ACCENT = {
  founder: { main: "#10d98a", glow: "rgba(16,217,138,0.18)", dim: "rgba(16,217,138,0.08)", border: "rgba(16,217,138,0.22)", text: "#6effc9", muted: "rgba(16,217,138,0.45)", label: "FOUNDER", emoji: "#" },
  operations: { main: "#f0a832", glow: "rgba(240,168,50,0.18)", dim: "rgba(240,168,50,0.08)", border: "rgba(240,168,50,0.22)", text: "#ffd980", muted: "rgba(240,168,50,0.45)", label: "OPERATIONS", emoji: "*" },
  designer: { main: "#9b7ff4", glow: "rgba(155,127,244,0.18)", dim: "rgba(155,127,244,0.08)", border: "rgba(155,127,244,0.22)", text: "#cdbfff", muted: "rgba(155,127,244,0.45)", label: "DESIGNER", emoji: "@" },
};

// ============================================================
// SIMULATED SHARED STATE (replaces Supabase in this demo)
// ============================================================
const useSharedState = () => {
  const [state, setState] = useState({
    detergentFund: { amount: 0, goal: 5000 },
    nicheBriefs: [],
    trendReports: [],
    urgentTrends: [],
    designHandoffs: [],
    listingCopies: [],
    uploadLog: [],
    rejectionReports: [],
    clients: [],
    performanceLog: [],
    notifications: { founder: [], operations: [], designer: [] },
  });

  const update = (key, val) => setState(prev => ({ ...prev, [key]: val }));
  const addNotification = (role, msg) => setState(prev => ({
    ...prev,
    notifications: {
      ...prev.notifications,
      [role]: [{ id: Date.now(), msg, read: false, time: new Date().toLocaleTimeString() }, ...prev.notifications[role]]
    }
  }));
  const clearNotification = (role, id) => setState(prev => ({
    ...prev,
    notifications: {
      ...prev.notifications,
      [role]: prev.notifications[role].filter(n => n.id !== id)
    }
  }));

  return { state, update, addNotification, clearNotification };
};

// ============================================================
// CLAUDE API CALL
// ============================================================
const callClaude = async (prompt, onChunk) => {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "No response received.";
    if (onChunk) onChunk(text);
    return text;
  } catch (e) {
    const err = "API error -- check connection.";
    if (onChunk) onChunk(err);
    return err;
  }
};

// ============================================================
// SHARED UI COMPONENTS
// ============================================================
const Spinner = ({ accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, color: accent?.text || "#94a3c8", fontSize: 13, padding: "8px 0", animation: "fadeIn 0.2s" }}>
    <div style={{ width: 16, height: 16, border: `2px solid ${accent?.border || "#1e2d47"}`, borderTopColor: accent?.main || "#eef2ff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
    Claude is thinking...
  </div>
);

const OutputBox = ({ content, accent }) => content ? (
  <div style={{ background: "#080c14", border: `1px solid ${accent.border}`, borderRadius: 10, padding: "14px 16px", marginTop: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3c8", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>
    {content}
    <button onClick={() => navigator.clipboard.writeText(content)} style={{ display: "block", marginTop: 10, background: "transparent", border: `1px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
      Copy ->
    </button>
  </div>
) : null;

const Field = ({ label, value, onChange, multiline, placeholder, small }) => (
  <div style={{ marginBottom: small ? 8 : 12 }}>
    <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
    {multiline
      ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 13, fontFamily: "'Sora', 'Inter', sans-serif", resize: "vertical", boxSizing: "border-box" }} />
      : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 13, fontFamily: "'Sora', 'Inter', sans-serif", boxSizing: "border-box" }} />
    }
  </div>
);

const Btn = ({ onClick, children, accent, small, disabled, secondary }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: secondary ? "transparent" : accent?.main || "#22c55e",
    color: secondary ? (accent?.text || "#86efac") : "#080c14",
    border: secondary ? `1px solid ${accent?.border || "rgba(34,197,94,0.25)"}` : "none",
    borderRadius: 10, padding: small ? "6px 14px" : "9px 18px",
    fontSize: small ? 11 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, fontFamily: "'Sora', 'Inter', sans-serif",
    transition: "opacity 0.2s"
  }}>{children}</button>
);

const Card = ({ children, accent, style = {} }) => (
  <div style={{ background: "#0d1424", border: `1px solid ${accent?.border || "#1e2d47"}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children, accent }) => (
  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${accent.border}` }}>
    {children}
  </div>
);

const Alert = ({ children, accent }) => (
  <div style={{ background: accent.dim, border: `1px solid ${accent.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 12, color: accent.text, lineHeight: 1.6, marginBottom: 14 }}>
    {children}
  </div>
);

const Badge = ({ label, color }) => (
  <span style={{ background: color + "22", border: `1px solid ${color}44`, color, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{label}</span>
);

// ============================================================
// CHECKLIST COMPONENT
// ============================================================
const Checklist = ({ items, accent }) => {
  const today = new Date().toDateString();
  const key = `checklist_${items[0]?.substr(0, 10)}_${today}`;
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  });
  const toggle = i => {
    const next = checked.includes(i) ? checked.filter(x => x !== i) : [...checked, i];
    setChecked(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} onClick={() => toggle(i)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e1e1e", cursor: "pointer" }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked.includes(i) ? accent.main : "#333"}`, background: checked.includes(i) ? accent.main : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {checked.includes(i) && <span style={{ color: "#080c14", fontSize: 11, fontWeight: 900 }}>OK</span>}
          </div>
          <span style={{ fontSize: 13, color: checked.includes(i) ? "#555" : "#94a3c8", textDecoration: checked.includes(i) ? "line-through" : "none", lineHeight: 1.5 }}>{item}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>{checked.length}/{items.length} complete  -  resets Monday</div>
    </div>
  );
};

// ============================================================
// DETERGENT FUND WIDGET
// ============================================================
const DetergentFund = ({ state, update, editable, accent }) => {
  const { amount, goal } = state.detergentFund;
  const pct = Math.min(100, Math.round((amount / goal) * 100));
  return (
    <Card accent={accent}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>// DETERGENT LAUNCH FUND</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent.main, marginBottom: 4 }}>${amount.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>of ${goal.toLocaleString()} goal</div>
      <div style={{ height: 6, background: "#111827", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: accent.main, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <div style={{ fontSize: 11, color: "#666" }}>{pct}% funded</div>
      {editable && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input type="number" placeholder="Update balance" style={{ flex: 1, background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "6px 10px", color: "#eef2ff", fontSize: 13 }}
            onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) update("detergentFund", { ...state.detergentFund, amount: v }); e.target.value = ""; }}
          />
          <Btn accent={accent} small>Save</Btn>
        </div>
      )}
    </Card>
  );
};

// ============================================================
// NOTIFICATION BELL
// ============================================================
const NotifBell = ({ notifications, onClear, accent }) => {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", cursor: "pointer", position: "relative", padding: 4 }}>
        <span style={{ fontSize: 18 }}>[!]</span>
        {unread > 0 && <span style={{ position: "absolute", top: 0, right: 0, background: accent.main, color: "#080c14", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 32, width: 280, background: "#111827", border: `1px solid ${accent.border}`, borderRadius: 12, zIndex: 100, padding: 12, maxHeight: 300, overflowY: "auto" }}>
          {notifications.length === 0 ? <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: 12 }}>No notifications</div>
            : notifications.map(n => (
              <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #222" }}>
                <div style={{ fontSize: 12, color: "#94a3c8", lineHeight: 1.4, flex: 1 }}>{n.msg}<div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{n.time}</div></div>
                <button onClick={() => onClear(n.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>x</button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// FOUNDER DASHBOARD
// ============================================================
const FounderDashboard = ({ state, update, addNotification, clearNotification }) => {
  const accent = ACCENT.founder;
  const [activeTab, setActiveTab] = useState("brief");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  // Niche Validation state
  const [niche, setNiche] = useState("");
  const [searchVol, setSearchVol] = useState("");
  const [competition, setCompetition] = useState("Medium");
  const [trendEvidence, setTrendEvidence] = useState("");

  // Brief Generator
  const [briefNiche1, setBriefNiche1] = useState("");
  const [briefNiche2, setBriefNiche2] = useState("");
  const [concepts1, setConcepts1] = useState("");
  const [concepts2, setConcepts2] = useState("");

  // Merch Listing
  const [listingNiche, setListingNiche] = useState("");
  const [designText, setDesignText] = useState("");
  const [targetBuyer, setTargetBuyer] = useState("");
  const [keywords, setKeywords] = useState("");

  // Rejection
  const [rejMsg, setRejMsg] = useState("");
  const [rejDesc, setRejDesc] = useState("");

  // Performance log
  const [perfWeek, setPerfWeek] = useState({ impressions: "", clicks: "", sales: "", rbViews: "" });

  const run = async (prompt, notify) => {
    setLoading(true); setOutput("");
    const res = await callClaude(prompt, setOutput);
    setLoading(false);
    if (notify) addNotification(notify, notify === "designer" ? "New brief pushed from Dad [doc]" : "New listing copy ready [edit]");
    return res;
  };

  const tabs = [
    { id: "brief", label: "Brief" },
    { id: "listing", label: "Listing Copy" },
    { id: "rejection", label: "Rejections" },
    { id: "performance", label: "Performance" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap", background: "#0d1424", border: "1px solid #1e2d47", borderRadius: 12, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setOutput(""); }} style={{ background: activeTab === t.id ? accent.main : "#111827", color: activeTab === t.id ? "#080c14" : "#888", border: `1px solid ${activeTab === t.id ? accent.main : "#1e2d47"}`, borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "brief" && (
        <div>
          <SectionTitle accent={accent}>// TREND INBOX</SectionTitle>
          {state.trendReports.length === 0
            ? <Alert accent={accent}>No trend reports submitted yet. Sati's Sunday report will appear here.</Alert>
            : state.trendReports.map((r, i) => (
              <Card key={i} accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Badge label="NEW" color={accent.main} />
                    <div style={{ marginTop: 8, fontSize: 13, color: "#94a3c8", whiteSpace: "pre-wrap" }}>{r.content}</div>
                  </div>
                </div>
              </Card>
            ))}

          <SectionTitle accent={accent} style={{ marginTop: 20 }}>// NICHE VALIDATION -- PROMPT POD-05</SectionTitle>
          <Field label="Niche from wife's report" value={niche} onChange={setNiche} placeholder="e.g. Fishing Dad humour" />
          <Field label="Helium 10 Search Volume" value={searchVol} onChange={setSearchVol} placeholder="e.g. 8,400/month" />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Competition Level</div>
            <select value={competition} onChange={e => setCompetition(e.target.value)} style={{ background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 13, width: "100%" }}>
              {["Low", "Medium", "High"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <Field label="Trend evidence (what wife spotted)" value={trendEvidence} onChange={setTrendEvidence} multiline placeholder="e.g. Hundreds of likes on fishing dad meme shirts on TikTok" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn accent={accent} disabled={loading || !niche} onClick={() => run(`Should I brief my design team on this POD niche this week?\n\nNiche: ${niche}\nSearch volume: ${searchVol}\nCompetition: ${competition}\nTrend evidence: ${trendEvidence}\nPlatforms: Amazon Merch on Demand, Redbubble\n\nAnalyse:\n1. Real Amazon demand -- search volume and buyer intent\n2. Competition level -- room to enter or dominated?\n3. Gift potential -- gift purchase or self-purchase?\n4. Evergreen or seasonal? Is now the right time?\n5. Trademark concerns\n6. Verdict: BRIEF THIS WEEK / SAVE FOR LATER / AVOID\n\nOne sentence reason for the verdict.`)}>
              {loading ? "Running..." : "Validate Niche"}
            </Btn>
          </div>

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>// DESIGN BRIEF GENERATOR -- PROMPT POD-02</SectionTitle>
          <Field label="Niche 1 (validated)" value={briefNiche1} onChange={setBriefNiche1} placeholder="e.g. Fishing Dad humour" />
          <Field label="Design concepts / text ideas for niche 1" value={concepts1} onChange={setConcepts1} multiline placeholder="e.g. 'Reel Life', 'Fish Fear Me', 'Retired -- Gone Fishing'" />
          <Field label="Niche 2 (validated)" value={briefNiche2} onChange={setBriefNiche2} placeholder="e.g. Nurse life appreciation" />
          <Field label="Design concepts / text ideas for niche 2" value={concepts2} onChange={setConcepts2} multiline placeholder="e.g. 'Saving Lives Since...', 'Nurse Mode On'" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn accent={accent} disabled={loading || !briefNiche1} onClick={() => run(`Write a complete design brief for a print-on-demand designer. Include two niches.\n\nNiche 1: ${briefNiche1}\nConcepts: ${concepts1}\n\nNiche 2: ${briefNiche2}\nConcepts: ${concepts2}\n\nFor each niche include: 5 specific design concepts with exact wording, product recommendations per concept (T-shirt, Hoodie, Mug, Tote), colour palette guidance, Amazon Merch keywords (5), Redbubble tags (10). Format clearly for a designer to follow without further explanation.`, "designer")}>
              {loading ? "Generating..." : "Generate & Push Brief to Son"}
            </Btn>
          </div>
          <OutputBox content={output} accent={accent} />
          {output && (
            <div style={{ marginTop: 8 }}>
              <Btn accent={accent} small secondary onClick={() => { update("nicheBriefs", [{ id: Date.now(), content: output, week: new Date().toDateString(), status: "new" }, ...state.nicheBriefs]); addNotification("designer", "New design brief is ready -- check your dashboard [doc]"); }}>
                Save & Push to Hayden's Dashboard
              </Btn>
            </div>
          )}
        </div>
      )}

      {activeTab === "listing" && (
        <div>
          <SectionTitle accent={accent}>// MERCH LISTING COPY -- PROMPT POD-03</SectionTitle>
          <Field label="Niche" value={listingNiche} onChange={setListingNiche} placeholder="e.g. Fishing Dad" />
          <Field label="Design text (exact words on the design)" value={designText} onChange={setDesignText} placeholder="e.g. 'Reel Life -- Born to Fish, Forced to Work'" />
          <Field label="Target buyer" value={targetBuyer} onChange={setTargetBuyer} placeholder="e.g. Fishing enthusiasts, gift for dad" />
          <Field label="Keywords (comma separated)" value={keywords} onChange={setKeywords} placeholder="e.g. fishing dad shirt, funny fishing gift, reel life tee" />
          <Btn accent={accent} disabled={loading || !listingNiche} onClick={() => run(`Write Amazon Merch on Demand listing copy for this design.\n\nNiche: ${listingNiche}\nDesign text: ${designText}\nTarget buyer: ${targetBuyer}\nKeywords: ${keywords}\n\nProduce:\n- Title (max 60 chars, lead with primary keyword, no keyword stuffing)\n- Bullet 1 (feature/benefit, max 256 chars)\n- Bullet 2 (occasion/gift angle, max 256 chars)\n- Description (max 500 chars, natural keyword use)\n\nFollow Amazon content policy strictly -- no trademark terms, no superlatives, no claims. Show character count for each field.`)}>
            {loading ? "Generating..." : "Generate Listing Copy"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
          {output && (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <Btn accent={accent} small secondary onClick={() => { update("listingCopies", [{ id: Date.now(), niche: listingNiche, content: output, status: "pending_upload" }, ...state.listingCopies]); addNotification("designer", "Merch listing copy ready for upload [edit]"); }}>
                Send to Son
              </Btn>
              <Btn accent={accent} small secondary onClick={() => run(`You are an Amazon Merch compliance expert. Check this listing for: trademark issues, prohibited language, character limit violations, policy violations, keyword stuffing.\n\nListing:\n${output}\n\nRate overall risk: LOW / MEDIUM / HIGH. Flag every specific issue and suggest corrected wording. Be strict.`)}>
                Run Compliance Check
              </Btn>
            </div>
          )}
        </div>
      )}

      {activeTab === "rejection" && (
        <div>
          <SectionTitle accent={accent}>// REJECTION INBOX</SectionTitle>
          {state.rejectionReports.length === 0
            ? <Alert accent={accent}>No rejections reported yet. Hayden's rejection reports will appear here.</Alert>
            : state.rejectionReports.map((r, i) => (
              <Card key={i} accent={accent}>
                <Badge label="REJECTED" color="#ef4444" />
                <div style={{ fontSize: 13, color: "#94a3c8", marginTop: 8 }}><strong>Design:</strong> {r.design}<br /><strong>Message:</strong> {r.message}</div>
                <div style={{ marginTop: 10 }}>
                  <Btn accent={accent} small onClick={() => run(`You are an Amazon Merch on Demand policy expert. Analyse this rejection:\n\nRejection message: ${r.message}\nDesign description: ${r.design}\n\nIdentify: exact policy violation, whether fix is in listing copy / artwork / both, specific corrected wording for listing, specific instruction to pass to designer if artwork needs changing. Be precise.`)}>
                    Diagnose with Claude
                  </Btn>
                </div>
              </Card>
            ))}

          <SectionTitle accent={accent} style={{ marginTop: 16 }}>// MANUAL REJECTION DIAGNOSIS -- PROMPT MERCH-01</SectionTitle>
          <Field label="Paste exact Amazon rejection message" value={rejMsg} onChange={setRejMsg} multiline />
          <Field label="Design description" value={rejDesc} onChange={setRejDesc} multiline placeholder="What it shows, what text appears on it" />
          <Btn accent={accent} disabled={loading || !rejMsg} onClick={() => run(`You are an Amazon Merch on Demand policy expert. Analyse this rejection message: ${rejMsg}\nDesign description: ${rejDesc}\n\nIdentify: exact policy violation, whether the fix is in the listing copy, the design artwork, or both, specific corrected wording for the listing, specific instruction to pass to a designer if artwork needs changing. Be precise.`)}>
            {loading ? "Diagnosing..." : "Diagnose Rejection"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
          {output && (
            <Btn accent={accent} small secondary style={{ marginTop: 8 }} onClick={() => { addNotification("designer", "Rejection diagnosed -- corrected copy ready [fix]"); }}>
              Send Fix to Son
            </Btn>
          )}
        </div>
      )}

      {activeTab === "performance" && (
        <div>
          <SectionTitle accent={accent}>// WEEKLY PERFORMANCE LOG</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[["Merch Impressions", "impressions"], ["Merch Clicks", "clicks"], ["Merch Sales", "sales"], ["Redbubble Top Views", "rbViews"]].map(([label, key]) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                <input type="number" value={perfWeek[key]} onChange={e => setPerfWeek(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <Btn accent={accent} onClick={() => { update("performanceLog", [{ id: Date.now(), week: new Date().toDateString(), ...perfWeek }, ...state.performanceLog]); setPerfWeek({ impressions: "", clicks: "", sales: "", rbViews: "" }); }}>
            Save This Week
          </Btn>

          {state.performanceLog.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionTitle accent={accent}>// LAST {Math.min(4, state.performanceLog.length)} WEEKS</SectionTitle>
              {state.performanceLog.slice(0, 4).map((w, i) => (
                <Card key={i} accent={accent}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#666", marginBottom: 8 }}>{w.week}</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    {[["Impressions", w.impressions], ["Clicks", w.clicks], ["Sales", w.sales], ["RB Views", w.rbViews]].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: "#666" }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: accent.main }}>{val || 0}</div>
                      </div>
                    ))}
                  </div>
                  {w.sales === "0" || w.sales === 0 ? <Alert accent={accent} style={{ marginTop: 8, marginBottom: 0 }}>[!] Zero sales this week -- review listing copy and niche targeting</Alert> : null}
                </Card>
              ))}
            </div>
          )}

          <SectionTitle accent={accent} style={{ marginTop: 16 }}>// MONTHLY POD REVIEW -- PROMPT POD-06</SectionTitle>
          <Btn accent={accent} disabled={loading} onClick={() => run(`Analyse my POD business and tell me what to do next month.\n\nMonth: ${new Date().toLocaleString('default', { month: 'long' })}\nTotal designs live on Merch: ${state.uploadLog.filter(u => u.platform === "Merch" || u.platform === "Both").length}\nTotal designs live on Redbubble: ${state.uploadLog.filter(u => u.platform === "Redbubble" || u.platform === "Both").length}\nPerformance logs: ${JSON.stringify(state.performanceLog.slice(0, 4))}\n\nTell me:\n1. What is working -- double down on what specifically?\n2. What should we stop briefing designs for?\n3. Which 3 new niches or trend directions should my wife look for next month?\n4. Any seasonal niches to prepare for in the next 6-8 weeks?\n5. Are we on track for our revenue milestone?\n\nNumbered action list for Monday briefing.`)}>
            {loading ? "Running..." : "Run Monthly Review"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
        </div>
      )}

      {activeTab === "checklist" && (
        <div>
          <SectionTitle accent={accent}>// WEEKLY CHECKLIST</SectionTitle>
          <Checklist accent={accent} items={[
            "Review wife's Sunday trend report in Trend Inbox",
            "Validate top 2 niches with Helium 10 data",
            "Generate & push Monday design brief to son",
            "Work on active List Peak client research (Tuesday)",
            "Community engagement -- 2-3 helpful replies (Wednesday)",
            "Generate Amazon Merch listing copy + run compliance check (Thursday)",
            "Check Merch dashboard + Redbubble performance (Weekend)",
            "Update niche tracker -- mark winners and dead designs",
          ]} />
          <div style={{ marginTop: 20 }}>
            <DetergentFund state={state} update={update} editable accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// OPERATIONS DASHBOARD
// ============================================================
const OperationsDashboard = ({ state, update, addNotification, clearNotification }) => {
  const accent = ACCENT.operations;
  const [activeTab, setActiveTab] = useState("research");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  // Research state
  const [trendDesc, setTrendDesc] = useState("");
  const [platform, setPlatform] = useState("TikTok");
  const [findings, setFindings] = useState(["", "", "", "", ""]);
  const [month, setMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));

  // Redbubble state
  const [rbNiche, setRbNiche] = useState("");
  const [rbDesigns, setRbDesigns] = useState("");
  const [rbBuyer, setRbBuyer] = useState("");
  const [rbOccasions, setRbOccasions] = useState("");

  // Client pipeline state
  const [clients, setClients] = useState(state.clients);
  const [newClient, setNewClient] = useState({ name: "", service: "", niche: "", invoice: "" });
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [emailType, setEmailType] = useState("acknowledge");

  const run = async (prompt) => { setLoading(true); setOutput(""); await callClaude(prompt, setOutput); setLoading(false); };

  const emailPrompts = {
    acknowledge: (c) => `Write a professional, warm email acknowledging a new List Peak service enquiry from ${c.name} who wants ${c.service}. Confirm receipt, explain next step is receiving their brief, set expectation of 5-7 working days for the report. Under 120 words. Sign off as the List Peak team.`,
    deliver: (c) => `Write a professional delivery email for a completed List Peak research report for ${c.name}. Their niche: ${c.niche}. Express that the report is attached and highlight one key finding. Invite questions. Under 100 words.`,
    followup: (c) => `Write a gentle 5-day follow-up email to ${c.name} who hasn't responded to the report delivery. Friendly, no pressure. Under 60 words.`,
    testimonial: (c) => `Write a friendly testimonial request email to ${c.name} after they've confirmed satisfaction with their List Peak report. Keep it easy -- just a few sentences about their experience. Under 80 words.`,
    invoice: (c) => `Write a professional invoice email to ${c.name} for List Peak services. Amount: $${c.invoice}. Payment method: Wise. Under 80 words.`,
    chase: (c) => `Write a polite but firm payment chase email to ${c.name} for an invoice of $${c.invoice} that is now 10+ days overdue. Maintain professionalism. Include Wise payment details reminder. Under 100 words.`,
  };

  const tabs = [
    { id: "research", label: "Research" },
    { id: "redbubble", label: "Redbubble" },
    { id: "clients", label: "Clients" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap", background: "#0d1424", border: "1px solid #1e2d47", borderRadius: 12, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setOutput(""); }} style={{ background: activeTab === t.id ? accent.main : "#111827", color: activeTab === t.id ? "#080c14" : "#888", border: `1px solid ${activeTab === t.id ? accent.main : "#1e2d47"}`, borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "research" && (
        <div>
          <SectionTitle accent={accent}>// QUICK TREND CAPTURE</SectionTitle>
          <Alert accent={accent}>Spotted something while browsing? Capture it here instantly. Saves to your weekly report automatically.</Alert>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Platform</div>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 13, width: "100%" }}>
              {["Facebook", "Instagram", "TikTok", "Pinterest"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <Field label="What you saw -- describe the design or paste a URL/note" value={trendDesc} onChange={setTrendDesc} multiline placeholder="e.g. Funny fishing dad shirt getting thousands of likes on TikTok -- text says 'Fish Fear Me, People Tolerate Me'" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn accent={accent} disabled={loading || !trendDesc} onClick={() => run(`I found a trending design idea on social media and want to know if it's worth pursuing for our POD business.\n\nPlatform: ${platform}\nWhat I saw: ${trendDesc}\n\nTell me:\n1. Is this niche proven on Amazon and Redbubble?\n2. Is there enough demand to justify designing for it?\n3. Are there any trademark or copyright concerns?\n4. What angle would make our version better?\n5. Should we pursue this: YES / YES WITH CHANGES / NO\n\nBe direct. My husband will use your answer to decide whether to add this to this week's brief.`)}>
              {loading ? "Checking..." : "Quick Viability Check (RESEARCH-01)"}
            </Btn>
            <Btn accent={accent} secondary small disabled={!trendDesc} onClick={() => { addNotification("founder", `[alert] Urgent trend flagged by wife: "${trendDesc.slice(0, 60)}..."`); setTrendDesc(""); }}>
              Flag Urgent to Husband
            </Btn>
          </div>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>// WEEKLY TREND REPORT -- PROMPT RESEARCH-02</SectionTitle>
          <Alert accent={accent}>Fill in what you spotted this week -- paste URLs, type quick notes, describe what you saw. Submit every Sunday evening.</Alert>
          {findings.map((f, i) => (
            <Field key={i} label={`Finding ${i + 1} -- platform, what you saw, why it caught your attention`} value={f} onChange={v => { const n = [...findings]; n[i] = v; setFindings(n); }} multiline placeholder="e.g. TikTok -- fishing dad shirt getting 50k likes, text 'Reel Life' with fish graphic. People tagging their dads." />
          ))}
          <Btn accent={accent} disabled={loading} onClick={() => run(`I've been browsing social media this week for POD design trends. Help me turn my findings into a structured report for my husband to review.\n\nThings I spotted this week:\n${findings.filter(Boolean).map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nFor each finding, give me:\n- Niche name (specific)\n- Why it shows real demand (not just that it looked nice)\n- Whether there are any trademark or copyright concerns\n- A quick YES / MAYBE / NO verdict on whether my husband should research it further\n\nFormat as a clean table so my husband can quickly review and decide which 2 niches to brief our son on Monday.`)}>
            {loading ? "Generating..." : "Generate Trend Report (RESEARCH-02)"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
          {output && (
            <Btn accent={accent} small secondary style={{ marginTop: 8 }} onClick={() => { update("trendReports", [{ id: Date.now(), content: output, week: new Date().toDateString() }, ...state.trendReports]); addNotification("founder", "[chart] Weekly trend report submitted by wife -- ready to review"); setOutput(""); setFindings(["", "", "", "", ""]); }}>
              Submit to Husband OK
            </Btn>
          )}

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>// MONTHLY SEASONAL WATCH -- PROMPT RESEARCH-03</SectionTitle>
          <Field label="Current month" value={month} onChange={setMonth} />
          <Btn accent={accent} disabled={loading} onClick={() => run(`Tell me what I should be looking for on social media this month for POD trends.\n\nCurrent month: ${month}\nPlatforms I use: Facebook, Instagram, TikTok, Pinterest\n\nGive me:\n1. Top 5 seasonal niches that will peak this month or next month\n2. Specific hashtags to follow on each platform for each niche\n3. Key dates and events this month that drive POD purchases\n4. What type of designs perform best for each niche (humour, pride, milestones, gifts)\n5. Any early-warning trends I should watch for next month\n\nFormat as a simple month guide I can refer to all month while browsing.`)}>
            {loading ? "Running..." : "Get Monthly Seasonal Guide (RESEARCH-03)"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
        </div>
      )}

      {activeTab === "redbubble" && (
        <div>
          <SectionTitle accent={accent}>// REDBUBBLE LISTING GENERATOR -- PROMPT POD-01</SectionTitle>
          {state.designHandoffs.filter(h => h.rb_status === "pending_rb_listings").length > 0 && (
            <Alert accent={accent}>
              [IN] {state.designHandoffs.filter(h => h.rb_status === "pending_rb_listings").length} design handoff(s) waiting for Redbubble listings
            </Alert>
          )}
          <Field label="Niche" value={rbNiche} onChange={setRbNiche} placeholder="e.g. Fishing enthusiasts" />
          <Field label="Designs (describe each one)" value={rbDesigns} onChange={setRbDesigns} multiline placeholder="1. 'Reel Life -- Born to Fish' text-based humour&#10;2. 'Fish Fear Me' with fishing rod graphic&#10;3. 'Gone Fishing' vintage badge style" />
          <Field label="Target buyer" value={rbBuyer} onChange={setRbBuyer} placeholder="e.g. Fishing hobbyists, gift for dad" />
          <Field label="Occasions" value={rbOccasions} onChange={setRbOccasions} placeholder="e.g. Birthday, Father's Day, Christmas" />
          <Btn accent={accent} disabled={loading || !rbNiche} onClick={() => run(`Write complete Redbubble listings for these print-on-demand designs.\n\nNiche: ${rbNiche}\nTarget buyer: ${rbBuyer}\nOccasions: ${rbOccasions}\n\nMy designs are:\n${rbDesigns}\n\nFor EACH design write:\n1. TITLE -- natural, descriptive, under 80 characters, not keyword-stuffed\n2. TAGS -- exactly 15 tags, comma separated, broad and specific mixed\n3. DESCRIPTION -- 180-220 words, warm and conversational. Open speaking directly to the buyer, describe what makes the design special, say who it's for, include 1-2 occasion references, close with a warm invitation to browse. Write like a person, not a catalogue.`)}>
            {loading ? "Generating..." : "Generate Redbubble Listings (POD-01)"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
          {output && (
            <Btn accent={accent} small secondary style={{ marginTop: 8 }} onClick={() => { addNotification("designer", "Redbubble listing copy ready for upload [doc]"); setOutput(""); }}>
              Mark Done -- Notify Son OK
            </Btn>
          )}

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>// REDBUBBLE LISTING REWRITE -- PROMPT POD-02</SectionTitle>
          <Alert accent={accent}>Use after 3 weeks with zero Redbubble views.</Alert>
          <Btn accent={accent} secondary disabled={loading} onClick={() => { setActiveTab("rewrite"); }}>Open Rewrite Tool -></Btn>
        </div>
      )}

      {activeTab === "clients" && (
        <div>
          <SectionTitle accent={accent}>// LIST PEAK CLIENT PIPELINE</SectionTitle>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#888" }}>{state.clients.length} clients</div>
            <Btn accent={accent} small onClick={() => setShowAddClient(!showAddClient)}>+ Add Client</Btn>
          </div>

          {showAddClient && (
            <Card accent={accent}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, marginBottom: 12 }}>// NEW CLIENT</div>
              <Field label="Client name" value={newClient.name} onChange={v => setNewClient(p => ({ ...p, name: v }))} placeholder="First name" small />
              <Field label="Service requested" value={newClient.service} onChange={v => setNewClient(p => ({ ...p, service: v }))} placeholder="e.g. Niche Research Report" small />
              <Field label="Niche" value={newClient.niche} onChange={v => setNewClient(p => ({ ...p, niche: v }))} placeholder="e.g. Kitchen gadgets" small />
              <Field label="Invoice amount (USD)" value={newClient.invoice} onChange={v => setNewClient(p => ({ ...p, invoice: v }))} placeholder="e.g. 97" small />
              <Btn accent={accent} small onClick={() => { update("clients", [{ ...newClient, id: Date.now(), status: "New", paid: false, date: new Date().toDateString() }, ...state.clients]); setNewClient({ name: "", service: "", niche: "", invoice: "" }); setShowAddClient(false); }}>
                Save Client
              </Btn>
            </Card>
          )}

          {state.clients.length === 0
            ? <Alert accent={accent}>No clients yet. Add your first List Peak client above.</Alert>
            : state.clients.map((c, i) => (
              <Card key={c.id} accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#eef2ff", marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{c.service}  -  {c.niche}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                      <Badge label={c.status} color={c.status === "Paid" ? "#22c55e" : c.status === "New" ? "#f59e0b" : "#888"} />
                      <Badge label={c.paid ? "PAID" : `$${c.invoice} DUE`} color={c.paid ? "#22c55e" : "#ef4444"} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                    <select value={c.status} onChange={e => { const updated = [...state.clients]; updated[i] = { ...c, status: e.target.value }; update("clients", updated); }} style={{ background: "#111827", border: "1px solid #2e2e2e", borderRadius: 8, padding: "4px 8px", color: "#eef2ff", fontSize: 11 }}>
                      {["New", "In Progress", "Report Sent", "Paid"].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)} style={{ background: "transparent", border: `1px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                      Generate Email v
                    </button>
                  </div>
                </div>
                {selectedClient?.id === c.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${accent.border}` }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {[["acknowledge", "Acknowledge"], ["deliver", "Send Report"], ["followup", "Follow Up"], ["testimonial", "Testimonial"], ["invoice", "Invoice"], ["chase", "Chase Payment"]].map(([type, label]) => (
                        <button key={type} onClick={() => setEmailType(type)} style={{ background: emailType === type ? accent.main : "transparent", color: emailType === type ? "#080c14" : accent.text, border: `1px solid ${accent.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <Btn accent={accent} small disabled={loading} onClick={() => run(emailPrompts[emailType](c))}>
                      {loading ? "Writing..." : "Generate Email"}
                    </Btn>
                    {loading && <Spinner accent={accent}/>}
                    <OutputBox content={output} accent={accent} />
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}

      {activeTab === "checklist" && (
        <div>
          <SectionTitle accent={accent}>// WEEKLY CHECKLIST</SectionTitle>
          <Checklist accent={accent} items={[
            "Browse Facebook, Instagram, TikTok, Pinterest -- minimum 3 sessions",
            "Run RESEARCH-03 Monthly Seasonal Watch (first week of month)",
            "Submit Sunday trend report to husband via Research tab",
            "Write Redbubble listings for son's completed design handoffs",
            "Check Redbubble customer messages -- reply within 24 hours",
            "Acknowledge new List Peak enquiries within 24 hours",
            "Send completed List Peak reports + invoices when husband confirms ready",
            "Update payment status for any Wise receipts received",
          ]} />
          <div style={{ marginTop: 20 }}>
            <DetergentFund state={state} update={update} editable={false} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// BULK TEXT DESIGN GENERATOR
// ============================================================
const BulkTextGenerator = ({ accent }) => {
  const [niche, setNiche] = useState("");
  const [texts, setTexts] = useState(["", "", "", "", ""]);
  const [style, setStyle] = useState("Bold Slab");
  const [palette, setPalette] = useState("white-on-black");
  const [layout, setLayout] = useState("Centred");
  const [generating, setGenerating] = useState(false);
  const [designs, setDesigns] = useState([]);

  const PALETTES = {
    "white-on-black": { bg: "#000000", text: "#ffffff", accent: "#e5e5e5" },
    "black-on-white": { bg: "#ffffff", text: "#000000", accent: "#333333" },
    "gold-on-navy": { bg: "#0f1f3d", text: "#d4af37", accent: "#c9a227" },
    "coral-on-cream": { bg: "#fdf6e3", text: "#e85d3a", accent: "#d14f2e" },
    "green-on-black": { bg: "#000000", text: "#22c55e", accent: "#16a34a" },
    "vintage-tan": { bg: "#c4a882", text: "#2c1810", accent: "#5c3a1e" },
  };

  const FONTS = {
    "Bold Slab": { family: "Georgia, serif", weight: 900, style: "normal" },
    "Retro Script": { family: "Georgia, serif", weight: 700, style: "italic" },
    "Modern Sans": { family: "Arial Black, sans-serif", weight: 900, style: "normal" },
    "Varsity Block": { family: "Impact, sans-serif", weight: 900, style: "normal" },
    "Vintage Serif": { family: "Times New Roman, serif", weight: 700, style: "normal" },
  };

  const LAYOUTS = {
    "Centred": (lines) => lines.map((l, i) => ({ text: l, x: 225, y: 100 + i * 65, anchor: "middle" })),
    "Stacked": (lines) => lines.map((l, i) => ({ text: l, x: 225, y: 80 + i * 70, anchor: "middle" })),
    "Badge": (lines) => lines.map((l, i) => ({ text: l, x: 225, y: 120 + i * 55, anchor: "middle" })),
    "Left-aligned": (lines) => lines.map((l, i) => ({ text: l, x: 40, y: 100 + i * 65, anchor: "start" })),
  };

  const generateDesign = (text, idx) => {
    const pal = PALETTES[palette];
    const font = FONTS[style];
    const lines = text.split("\n").filter(Boolean);
    const positions = LAYOUTS[layout](lines);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 450" width="450" height="450">
      <rect width="450" height="450" fill="${pal.bg}" rx="0"/>
      ${layout === "Badge" ? `<circle cx="225" cy="225" r="200" fill="none" stroke="${pal.text}" stroke-width="8" stroke-dasharray="none" opacity="0.4"/>
      <circle cx="225" cy="225" r="185" fill="none" stroke="${pal.text}" stroke-width="2" opacity="0.3"/>` : ""}
      ${positions.map(p => `
        <text x="${p.x}" y="${p.y + 200}" text-anchor="${p.anchor}"
          font-family="${font.family}" font-weight="${font.weight}"
          font-style="${font.style}" font-size="${lines.length > 2 ? "38" : "48"}"
          fill="${pal.text}" letter-spacing="2">
          ${p.text.toUpperCase()}
        </text>`).join("")}
      ${niche ? `<text x="225" y="410" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="${pal.accent}" letter-spacing="5" opacity="0.7">${niche.toUpperCase()}</text>` : ""}
    </svg>`;
  };

  const generate = () => {
    setGenerating(true);
    const validTexts = texts.filter(Boolean);
    const newDesigns = validTexts.map((t, i) => ({ id: i, text: t, svg: generateDesign(t, i) }));
    setTimeout(() => { setDesigns(newDesigns); setGenerating(false); }, 600);
  };

  const downloadSvg = (svg, name) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name || "design"}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle accent={accent}>// BULK TEXT DESIGN GENERATOR</SectionTitle>
      <Alert accent={accent}>Enter up to 5 design texts. Each generates a download-ready SVG design at T-shirt spec.</Alert>
      <Field label="Niche (shows as sub-label)" value={niche} onChange={setNiche} placeholder="e.g. FISHING DAD" />
      {texts.map((t, i) => (
        <Field key={i} label={`Design ${i + 1} text`} value={t} onChange={v => { const n = [...texts]; n[i] = v; setTexts(n); }} placeholder={`e.g. REEL LIFE${i === 1 ? "\nBORN TO FISH" : ""}`} multiline />
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["Font Style", style, setStyle, Object.keys(FONTS)], ["Colour Palette", palette, setPalette, Object.keys(PALETTES)], ["Layout", layout, setLayout, Object.keys(LAYOUTS)]].map(([label, val, setter, options]) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
            <select value={val} onChange={e => setter(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
              {options.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <Btn accent={accent} disabled={generating || !texts.filter(Boolean).length} onClick={generate}>
        {generating ? "Generating..." : `Generate ${texts.filter(Boolean).length} Design${texts.filter(Boolean).length !== 1 ? "s" : ""}`}
      </Btn>

      {designs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {designs.map((d, i) => (
              <Card key={i} accent={accent} style={{ padding: 12, textAlign: "center" }}>
                <div dangerouslySetInnerHTML={{ __html: d.svg }} style={{ width: "100%", height: "auto" }} />
                <div style={{ marginTop: 8, fontSize: 11, color: "#888", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>{d.text.slice(0, 30)}</div>
                <Btn accent={accent} small onClick={() => downloadSvg(d.svg, `design-${i + 1}-${niche.toLowerCase().replace(/\s/g, "-")}`)}>
                  Download SVG
                </Btn>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// BULK GRAPHIC DESIGN GENERATOR
// ============================================================
const BulkGraphicGenerator = ({ accent }) => {
  const [niche, setNiche] = useState("");
  const [element, setElement] = useState("Fish silhouette");
  const [designTexts, setDesignTexts] = useState(["", "", ""]);
  const [graphicStyle, setGraphicStyle] = useState("Silhouette");
  const [palette, setPalette] = useState("white-on-black");
  const [generating, setGenerating] = useState(false);
  const [designs, setDesigns] = useState([]);

  const PALETTES = {
    "white-on-black": { bg: "#000000", main: "#ffffff", sub: "#888888" },
    "gold-on-navy": { bg: "#0f1f3d", main: "#d4af37", sub: "#8a7530" },
    "vintage-tan": { bg: "#c4a882", main: "#2c1810", sub: "#5c3a1e" },
    "coral-on-cream": { bg: "#fdf6e3", main: "#e85d3a", sub: "#8a3a20" },
    "forest-on-black": { bg: "#000000", main: "#22c55e", sub: "#16a34a" },
  };

  const GRAPHICS = {
    "Fish silhouette": (pal) => `<path d="M80 225 Q120 200 180 220 Q200 200 240 210 L220 225 L240 240 Q200 250 180 230 Q120 250 80 225Z" fill="${pal.main}" opacity="0.9"/>
      <circle cx="160" cy="218" r="5" fill="${pal.bg}"/>
      <path d="M240 215 L270 200 L265 225 L270 250 L240 235Z" fill="${pal.main}"/>`,

    "Mountain range": (pal) => `<polygon points="60,300 140,160 220,280 300,140 380,300" fill="none" stroke="${pal.main}" stroke-width="3"/>
      <polygon points="140,160 220,280 60,280" fill="${pal.main}" opacity="0.15"/>
      <polygon points="300,140 380,300 220,300" fill="${pal.main}" opacity="0.25"/>`,

    "Coffee cup": (pal) => `<rect x="150" y="170" width="150" height="120" rx="8" fill="none" stroke="${pal.main}" stroke-width="4"/>
      <path d="M300 200 Q340 200 340 230 Q340 260 300 260" fill="none" stroke="${pal.main}" stroke-width="4"/>
      <path d="M150 200 Q200 195 300 200" stroke="${pal.main}" stroke-width="2" fill="none"/>
      <path d="M185 155 Q190 140 185 125" stroke="${pal.main}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M225 155 Q230 135 225 115" stroke="${pal.main}" stroke-width="3" fill="none" stroke-linecap="round"/>`,

    "Anchor": (pal) => `<circle cx="225" cy="170" r="25" fill="none" stroke="${pal.main}" stroke-width="4"/>
      <line x1="225" y1="195" x2="225" y2="290" stroke="${pal.main}" stroke-width="4"/>
      <path d="M160 220 Q180 220 225 220 Q270 220 290 220" stroke="${pal.main}" stroke-width="4" fill="none"/>
      <path d="M160 290 Q190 310 225 290 Q260 310 290 290" stroke="${pal.main}" stroke-width="4" fill="none"/>`,

    "Star badge": (pal) => `<polygon points="225,140 240,195 298,195 252,228 268,283 225,252 182,283 198,228 152,195 210,195" fill="${pal.main}" opacity="0.9"/>
      <polygon points="225,152 237,190 278,190 246,212 258,250 225,230 192,250 204,212 172,190 213,190" fill="${pal.bg}"/>`,
  };

  const generateDesign = (text, idx) => {
    const pal = PALETTES[palette];
    const graphic = GRAPHICS[element] ? GRAPHICS[element](pal) : GRAPHICS["Fish silhouette"](pal);
    const lines = text.split("\n").filter(Boolean);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 450" width="450" height="450">
      <rect width="450" height="450" fill="${pal.bg}"/>
      <g transform="translate(0, -60)">${graphic}</g>
      ${lines.map((l, i) => `
        <text x="225" y="${260 + i * 52}" text-anchor="middle"
          font-family="Impact, Arial Black, sans-serif" font-weight="900"
          font-size="${lines.length > 1 ? "44" : "52"}" fill="${pal.main}" letter-spacing="3">
          ${l.toUpperCase()}
        </text>`).join("")}
      ${niche ? `<text x="225" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="${pal.sub}" letter-spacing="5">${niche.toUpperCase()}</text>` : ""}
    </svg>`;
  };

  const generate = () => {
    setGenerating(true);
    const newDesigns = designTexts.filter(Boolean).map((t, i) => ({ id: i, text: t, svg: generateDesign(t, i) }));
    setTimeout(() => { setDesigns(newDesigns); setGenerating(false); }, 600);
  };

  const downloadSvg = (svg, name) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name || "graphic-design"}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle accent={accent}>// BULK GRAPHIC DESIGN GENERATOR</SectionTitle>
      <Alert accent={accent}>Generates graphic illustration + text combination designs. Best for silhouettes, icons, and badge-style POD products.</Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Graphic Element</div>
          <select value={element} onChange={e => setElement(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
            {Object.keys(GRAPHICS).map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Colour Palette</div>
          <select value={palette} onChange={e => setPalette(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
            {Object.keys(PALETTES).map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <Field label="Niche label" value={niche} onChange={setNiche} placeholder="e.g. FISHING DAD" />
      {designTexts.map((t, i) => (
        <Field key={i} label={`Design ${i + 1} text`} value={t} onChange={v => { const n = [...designTexts]; n[i] = v; setDesignTexts(n); }} multiline placeholder={`e.g. REEL LIFE${i === 1 ? "\nBORN TO FISH" : ""}`} />
      ))}

      <Btn accent={accent} disabled={generating || !designTexts.filter(Boolean).length} onClick={generate}>
        {generating ? "Generating..." : `Generate ${designTexts.filter(Boolean).length} Graphic Design${designTexts.filter(Boolean).length !== 1 ? "s" : ""}`}
      </Btn>

      {designs.length > 0 && (
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {designs.map((d, i) => (
            <Card key={i} accent={accent} style={{ padding: 12, textAlign: "center" }}>
              <div dangerouslySetInnerHTML={{ __html: d.svg }} style={{ width: "100%" }} />
              <div style={{ marginTop: 8 }}>
                <Btn accent={accent} small onClick={() => downloadSvg(d.svg, `graphic-${i + 1}`)}>Download SVG</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// PATTERN PRESS GENERATOR
// ============================================================
const PatternPressGenerator = ({ accent, onPatternReady }) => {
  const [element, setElement] = useState("Fishing lures");
  const [density, setDensity] = useState("Medium");
  const [bgColor, setBgColor] = useState("#000000");
  const [elemColor, setElemColor] = useState("#22c55e");
  const [scale, setScale] = useState("Medium");
  const [generating, setGenerating] = useState(false);
  const [patternSvg, setPatternSvg] = useState("");

  const ELEMENTS = {
    "Fishing lures": (c) => `<path d="M8,4 Q12,2 14,5 Q16,8 12,10 L10,12 L8,10 Q4,8 6,5Z" fill="${c}"/>
      <circle cx="6" cy="5" r="1.5" fill="${c}" opacity="0.7"/>
      <line x1="14" y1="5" x2="17" y2="3" stroke="${c}" stroke-width="1"/>`,
    "Paw prints": (c) => `<ellipse cx="10" cy="12" rx="4" ry="5" fill="${c}"/>
      <ellipse cx="5" cy="8" rx="2.5" ry="3" fill="${c}"/>
      <ellipse cx="15" cy="8" rx="2.5" ry="3" fill="${c}"/>
      <ellipse cx="7" cy="5" rx="2" ry="2.5" fill="${c}"/>
      <ellipse cx="13" cy="5" rx="2" ry="2.5" fill="${c}"/>`,
    "Coffee beans": (c) => `<ellipse cx="10" cy="10" rx="6" ry="8" fill="${c}"/>
      <path d="M10,2 Q10,10 10,18" stroke="${bgColor}" stroke-width="1.5" fill="none"/>`,
    "Stars": (c) => `<polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" fill="${c}"/>`,
    "Leaves": (c) => `<path d="M10,2 Q18,8 10,18 Q2,8 10,2Z" fill="${c}"/>
      <line x1="10" y1="2" x2="10" y2="18" stroke="${bgColor}" stroke-width="1" opacity="0.5"/>`,
    "Arrows": (c) => `<path d="M2,10 L14,10 L10,5 M14,10 L10,15" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    "Flowers": (c) => `<circle cx="10" cy="10" r="3" fill="${c}"/>
      ${[0,60,120,180,240,300].map(a => `<ellipse cx="${10 + 6*Math.cos(a*Math.PI/180)}" cy="${10 + 6*Math.sin(a*Math.PI/180)}" rx="2.5" ry="4" fill="${c}" opacity="0.7" transform="rotate(${a} ${10 + 6*Math.cos(a*Math.PI/180)} ${10 + 6*Math.sin(a*Math.PI/180)})"/>`).join("")}`,
    "Mountains": (c) => `<polygon points="10,2 18,16 2,16" fill="${c}"/>
      <polygon points="16,8 20,16 12,16" fill="${c}" opacity="0.5"/>`,
  };

  const SCALES = { Small: 20, Medium: 30, Large: 45 };
  const DENSITIES = { Sparse: 0.4, Medium: 0.7, Dense: 1 };

  const generatePattern = () => {
    setGenerating(true);
    const tileSize = SCALES[scale];
    const cols = Math.ceil(450 / tileSize) + 1;
    const rows = Math.ceil(450 / tileSize) + 1;
    const elemFn = ELEMENTS[element] || ELEMENTS["Fishing lures"];
    const density = DENSITIES["Medium"];

    let tiles = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 1 - density) {
          const x = c * tileSize - (r % 2 === 0 ? 0 : tileSize / 2);
          const y = r * tileSize;
          const rot = Math.floor(Math.random() * 4) * 90;
          tiles += `<g transform="translate(${x},${y}) rotate(${rot} ${tileSize / 2} ${tileSize / 2}) scale(${tileSize / 20})">${elemFn(elemColor)}</g>`;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 450" width="450" height="450">
      <rect width="450" height="450" fill="${bgColor}"/>
      ${tiles}
    </svg>`;

    setTimeout(() => { setPatternSvg(svg); setGenerating(false); }, 400);
  };

  const downloadSvg = () => {
    const blob = new Blob([patternSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `pattern-${element.toLowerCase().replace(/\s/g, "-")}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle accent={accent}>// PATTERN PRESS GENERATOR</SectionTitle>
      <Alert accent={accent}>Generates seamless repeat patterns for all-over-print products -- mugs, totes, phone cases, all-over shirts on Redbubble.</Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Pattern Element</div>
          <select value={element} onChange={e => setElement(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
            {Object.keys(ELEMENTS).map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Scale</div>
          <select value={scale} onChange={e => setScale(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
            {["Small", "Medium", "Large"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Background Colour</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 40, height: 36, border: "1px solid #2e2e2e", borderRadius: 8, cursor: "pointer", background: "none" }} />
            <span style={{ fontSize: 12, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>{bgColor}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Element Colour</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={elemColor} onChange={e => setElemColor(e.target.value)} style={{ width: 40, height: 36, border: "1px solid #2e2e2e", borderRadius: 8, cursor: "pointer", background: "none" }} />
            <span style={{ fontSize: 12, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>{elemColor}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn accent={accent} disabled={generating} onClick={generatePattern}>
          {generating ? "Generating..." : "Generate Pattern"}
        </Btn>
        {patternSvg && (
          <Btn accent={accent} secondary small onClick={() => onPatternReady && onPatternReady(patternSvg)}>
            Use in Pattern Fill Text ->
          </Btn>
        )}
      </div>

      {patternSvg && (
        <div style={{ marginTop: 16 }}>
          <Card accent={accent} style={{ textAlign: "center", padding: 12 }}>
            <div dangerouslySetInnerHTML={{ __html: patternSvg }} style={{ width: "100%" }} />
            <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn accent={accent} small onClick={downloadSvg}>Download SVG</Btn>
              {onPatternReady && (
                <Btn accent={accent} small secondary onClick={() => onPatternReady(patternSvg)}>
                  Send to Pattern Fill Text ->
                </Btn>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================================
// PATTERN FILL TEXT TOOL
// ============================================================
const PatternFillText = ({ accent, incomingPattern }) => {
  const [text, setText] = useState("REEL LIFE");
  const [subText, setSubText] = useState("");
  const [fontStyle, setFontStyle] = useState("Impact");
  const [outline, setOutline] = useState(true);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [outlineWidth, setOutlineWidth] = useState(3);
  const [bgColor, setBgColor] = useState("#000000");
  const [uploadedPattern, setUploadedPattern] = useState(null);
  const [activePattern, setActivePattern] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [resultSvg, setResultSvg] = useState("");
  const fileRef = useRef();

  useEffect(() => {
    if (incomingPattern) { setActivePattern(incomingPattern); }
  }, [incomingPattern]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = `<image href="${ev.target.result}" x="0" y="0" width="450" height="450" preserveAspectRatio="xMidYMid slice"/>`;
      setUploadedPattern(img);
      setActivePattern(img);
    };
    reader.readAsDataURL(file);
  };

  const FONTS = {
    "Impact": "Impact, Arial Black, sans-serif",
    "Arial Black": "Arial Black, sans-serif",
    "Georgia Bold": "Georgia, serif",
    "Times Bold": "Times New Roman, serif",
    "Courier Bold": "Courier New, monospace",
  };

  const generate = () => {
    setGenerating(true);
    const mainFontSize = text.length > 8 ? 90 : 110;
    const patternContent = activePattern || `<rect width="450" height="450" fill="#22c55e"/>
      <rect x="0" y="0" width="450" height="450" fill="url(#defaultPat)"/>
      <defs><pattern id="defaultPat" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="15" cy="15" r="8" fill="#16a34a" opacity="0.6"/>
      </pattern></defs>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 450" width="450" height="450">
      <defs>
        <clipPath id="textClip">
          <text x="225" y="${subText ? "230" : "270"}" text-anchor="middle"
            font-family="${FONTS[fontStyle]}" font-weight="900"
            font-size="${mainFontSize}" letter-spacing="4">
            ${text.toUpperCase()}
          </text>
          ${subText ? `<text x="225" y="310" text-anchor="middle"
            font-family="${FONTS[fontStyle]}" font-weight="900"
            font-size="48" letter-spacing="6">
            ${subText.toUpperCase()}
          </text>` : ""}
        </clipPath>
      </defs>

      <!-- Background -->
      <rect width="450" height="450" fill="${bgColor}"/>

      <!-- Pattern clipped to text shape -->
      <g clip-path="url(#textClip)">
        ${patternContent}
      </g>

      <!-- Outline strokes -->
      ${outline ? `
        <text x="225" y="${subText ? "230" : "270"}" text-anchor="middle"
          font-family="${FONTS[fontStyle]}" font-weight="900"
          font-size="${mainFontSize}" letter-spacing="4"
          fill="none" stroke="${outlineColor}" stroke-width="${outlineWidth}">
          ${text.toUpperCase()}
        </text>
        ${subText ? `<text x="225" y="310" text-anchor="middle"
          font-family="${FONTS[fontStyle]}" font-weight="900"
          font-size="48" letter-spacing="6"
          fill="none" stroke="${outlineColor}" stroke-width="${outlineWidth}">
          ${subText.toUpperCase()}
        </text>` : ""}
      ` : ""}
    </svg>`;

    setTimeout(() => { setResultSvg(svg); setGenerating(false); }, 400);
  };

  const downloadSvg = () => {
    const blob = new Blob([resultSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `pattern-fill-${text.toLowerCase().replace(/\s/g, "-")}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle accent={accent}>// PATTERN FILL TEXT TOOL</SectionTitle>
      <Alert accent={accent}>
        Pattern lives <strong>inside each letter</strong> using SVG clipPath masking. Upload your own pattern or generate one in Pattern Press and send it here.
      </Alert>

      {incomingPattern && (
        <div style={{ background: accent.dim, border: `1px solid ${accent.border}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: accent.text }}>
          OK Pattern received from Pattern Press Generator
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Main text" value={text} onChange={setText} placeholder="e.g. REEL LIFE" />
        <Field label="Sub text (optional)" value={subText} onChange={setSubText} placeholder="e.g. BORN TO FISH" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Font</div>
          <select value={fontStyle} onChange={e => setFontStyle(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
            {Object.keys(FONTS).map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Background Colour</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 40, height: 36, border: "1px solid #2e2e2e", borderRadius: 8, cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>{bgColor}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={outline} onChange={e => setOutline(e.target.checked)} id="outlineCheck" />
          <label htmlFor="outlineCheck" style={{ fontSize: 12, color: "#94a3c8" }}>Letter outline</label>
        </div>
        {outline && <>
          <div>
            <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Outline Colour</div>
            <input type="color" value={outlineColor} onChange={e => setOutlineColor(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #2e2e2e", borderRadius: 8, cursor: "pointer" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Thickness</div>
            <select value={outlineWidth} onChange={e => setOutlineWidth(Number(e.target.value))} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
              {[1, 2, 3, 4, 6].map(w => <option key={w} value={w}>{w}px</option>)}
            </select>
          </div>
        </>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Pattern Source</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn accent={accent} small secondary onClick={() => fileRef.current?.click()}>
            Upload Pattern (PNG/SVG/JPG)
          </Btn>
          {activePattern && <Badge label={uploadedPattern ? "Custom pattern loaded OK" : "Pattern Press pattern loaded OK"} color={accent.main} />}
        </div>
        <input ref={fileRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }} onChange={handleUpload} />
      </div>

      <Btn accent={accent} disabled={generating || !text} onClick={generate}>
        {generating ? "Generating..." : "Generate Pattern Fill Design"}
      </Btn>

      {resultSvg && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[bgColor, "#ffffff"].map((bg, i) => (
              <Card key={i} accent={accent} style={{ padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{i === 0 ? "YOUR COLOUR" : "WHITE BACKGROUND"} PREVIEW</div>
                <div style={{ background: i === 0 ? bgColor : "#ffffff", borderRadius: 10, padding: 8, border: "1px solid #2e2e2e" }}>
                  <div dangerouslySetInnerHTML={{ __html: i === 0 ? resultSvg : resultSvg.replace(`fill="${bgColor}"`, 'fill="#ffffff"') }} style={{ width: "100%" }} />
                </div>
              </Card>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn accent={accent} onClick={downloadSvg}>Download SVG (Upload-ready)</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DESIGNER DASHBOARD
// ============================================================
const DesignerDashboard = ({ state, update, addNotification, clearNotification }) => {
  const accent = ACCENT.designer;
  const [activeTab, setActiveTab] = useState("brief");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [patternForFill, setPatternForFill] = useState(null);

  // Design tools state
  const [mjNiche, setMjNiche] = useState("");
  const [mjStyle, setMjStyle] = useState("Vintage");
  const [mjMood, setMjMood] = useState("Humorous");
  const [mjText, setMjText] = useState("");

  const [kittlNiche, setKittlNiche] = useState("");
  const [kittlOccasion, setKittlOccasion] = useState("");

  // Handoff state
  const [handoffNiche, setHandoffNiche] = useState("");
  const [handoffDesigns, setHandoffDesigns] = useState([{ name: "", description: "", designText: "", style: "Text-based" }]);

  // Upload log state
  const [uploadEntry, setUploadEntry] = useState({ design: "", niche: "", platform: "Both", status: "Pending Review" });

  const run = async (prompt) => { setLoading(true); setOutput(""); await callClaude(prompt, setOutput); setLoading(false); };

  const addHandoffDesign = () => setHandoffDesigns(p => [...p, { name: "", description: "", designText: "", style: "Text-based" }]);

  const tabs = [
    { id: "brief", label: "Brief" },
    { id: "tools", label: "Design Tools" },
    { id: "generators", label: "Generators" },
    { id: "handoff", label: "Handoff" },
    { id: "uploads", label: "Uploads" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap", background: "#0d1424", border: "1px solid #1e2d47", borderRadius: 12, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setOutput(""); }} style={{ background: activeTab === t.id ? accent.main : "#111827", color: activeTab === t.id ? "#080c14" : "#888", border: `1px solid ${activeTab === t.id ? accent.main : "#1e2d47"}`, borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "brief" && (
        <div>
          <SectionTitle accent={accent}>// THIS WEEK'S DESIGN BRIEF</SectionTitle>
          {state.nicheBriefs.length === 0
            ? <Alert accent={accent}>No brief received yet this week. Dad pushes the brief every Monday. Check back or message him if it's Monday afternoon.</Alert>
            : (
              <Card accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <Badge label="BRIEF READY" color={accent.main} />
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>{state.nicheBriefs[0].week}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3c8", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {state.nicheBriefs[0].content}
                </div>
              </Card>
            )}

          {state.listingCopies.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionTitle accent={accent}>// LISTING COPY FROM DAD</SectionTitle>
              {state.listingCopies.filter(l => l.status === "pending_upload").map((l, i) => (
                <Card key={i} accent={accent}>
                  <Badge label="READY TO UPLOAD" color={accent.main} />
                  <div style={{ fontSize: 13, color: "#94a3c8", marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, whiteSpace: "pre-wrap" }}>{l.content}</div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => navigator.clipboard.writeText(l.content)} style={{ background: "transparent", border: `1px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>Copy All -></button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle accent={accent} style={{ marginTop: 20 }}>// FILE SPEC REFERENCE</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Card accent={accent} style={{ padding: 14 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, marginBottom: 8 }}>AMAZON MERCH</div>
              {[["Format", "PNG"], ["Size", "4500 x 5400px"], ["Colour", "RGB"], ["DPI", "300"], ["Max file", "25MB"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #1e1e1e" }}>
                  <span style={{ color: "#888" }}>{k}</span><span style={{ color: "#eef2ff", fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                </div>
              ))}
            </Card>
            <Card accent={accent} style={{ padding: 14 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, marginBottom: 8 }}>REDBUBBLE</div>
              {[["Format", "PNG"], ["Size", "Up to 8000px"], ["Colour", "RGB/sRGB"], ["Notes", "Max long side"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #1e1e1e" }}>
                  <span style={{ color: "#888" }}>{k}</span><span style={{ color: "#eef2ff", fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                </div>
              ))}
              <Alert accent={accent} style={{ marginTop: 8, marginBottom: 0, fontSize: 11 }}>[!] Never white text on white shirt -- check contrast every time</Alert>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "tools" && (
        <div>
          <SectionTitle accent={accent}>// MIDJOURNEY PROMPT GENERATOR</SectionTitle>
          <Field label="Niche (from brief)" value={mjNiche} onChange={setMjNiche} placeholder="e.g. Fishing Dad" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Design Style</div>
              <select value={mjStyle} onChange={e => setMjStyle(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
                {["Vintage", "Minimalist", "Retro", "Line art", "Geometric", "Watercolour"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Mood</div>
              <select value={mjMood} onChange={e => setMjMood(e.target.value)} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
                {["Humorous", "Proud", "Nostalgic", "Bold", "Peaceful", "Adventurous"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <Field label="Specific text to include in design (optional)" value={mjText} onChange={setMjText} placeholder="e.g. 'Reel Life'" />
          <Btn accent={accent} disabled={loading || !mjNiche} onClick={() => run(`Write 5 Midjourney prompts for print-on-demand T-shirt designs in the ${mjNiche} niche. Style: ${mjStyle}. Mood: ${mjMood}. ${mjText ? `Include this text: "${mjText}"` : ""}\n\nEach prompt should produce a design suitable for merch -- clean edges, transparent-background-ready, no photorealistic faces. Include: composition, colour palette, artistic style. Format each as a numbered, ready-to-paste Midjourney prompt starting with /imagine prompt:`)}>
            {loading ? "Generating..." : "Generate 5 Midjourney Prompts"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>// KITTL TEXT CONCEPT GENERATOR</SectionTitle>
          <Field label="Niche (from brief)" value={kittlNiche} onChange={setKittlNiche} placeholder="e.g. Fishing Dad" />
          <Field label="Occasions or buyer types (optional)" value={kittlOccasion} onChange={setKittlOccasion} placeholder="e.g. Father's Day gift, self-purchase" />
          <Btn accent={accent} disabled={loading || !kittlNiche} onClick={() => run(`Write 8 text-based print-on-demand design concepts for the ${kittlNiche} niche. ${kittlOccasion ? `Occasions/buyers: ${kittlOccasion}.` : ""}\n\nFor each concept:\n1. Exact wording for the design (main text + any sub-text)\n2. Kittl font style recommendation (e.g. bold slab serif, hand-lettered, retro script)\n3. Colour palette (3 colours with hex codes)\n4. Layout suggestion (stacked / arched / centred / left-aligned)\n5. Best product type (T-shirt / mug / tote etc)\n\nFormat as 8 clearly numbered concepts.`)}>
            {loading ? "Generating..." : "Generate 8 Kittl Text Concepts"}
          </Btn>
          {loading && <Spinner accent={accent}/>}
          <OutputBox content={output} accent={accent} />
        </div>
      )}

      {activeTab === "generators" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["text", "graphic", "pattern", "fill"].map(g => (
              <button key={g} onClick={() => setOutput(g)} style={{ background: output === g ? accent.main : "#111827", color: output === g ? "#080c14" : "#888", border: `1px solid ${output === g ? accent.main : "#1e2d47"}`, borderRadius: 10, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {g === "text" ? "Bulk Text" : g === "graphic" ? "Bulk Graphic" : g === "pattern" ? "Pattern Press" : "Pattern Fill Text"}
              </button>
            ))}
          </div>

          {(!output || output === "text") && <BulkTextGenerator accent={accent} />}
          {output === "graphic" && <BulkGraphicGenerator accent={accent} />}
          {output === "pattern" && <PatternPressGenerator accent={accent} onPatternReady={(svg) => { setPatternForFill(svg); setOutput("fill"); }} />}
          {output === "fill" && <PatternFillText accent={accent} incomingPattern={patternForFill} />}
        </div>
      )}

      {activeTab === "handoff" && (
        <div>
          <SectionTitle accent={accent}>// DESIGN HANDOFF FORM</SectionTitle>
          <Alert accent={accent}>Submit this after completing your designs. Mum gets notified for Redbubble listings. Dad gets notified for Merch listing copy.</Alert>
          <Field label="Niche" value={handoffNiche} onChange={setHandoffNiche} placeholder="e.g. Fishing Dad" />

          {handoffDesigns.map((d, i) => (
            <Card key={i} accent={accent}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, marginBottom: 10 }}>DESIGN {i + 1}</div>
              <Field label="Design name" value={d.name} onChange={v => { const n = [...handoffDesigns]; n[i] = { ...d, name: v }; setHandoffDesigns(n); }} placeholder="e.g. Reel Life Text Design" small />
              <Field label="Description -- what it shows" value={d.description} onChange={v => { const n = [...handoffDesigns]; n[i] = { ...d, description: v }; setHandoffDesigns(n); }} placeholder="e.g. Bold text on plain background with fishing rod icon" small />
              <Field label="Exact text on the design" value={d.designText} onChange={v => { const n = [...handoffDesigns]; n[i] = { ...d, designText: v }; setHandoffDesigns(n); }} placeholder="e.g. REEL LIFE / Born to Fish, Forced to Work" small />
              <div>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Style</div>
                <select value={d.style} onChange={e => { const n = [...handoffDesigns]; n[i] = { ...d, style: e.target.value }; setHandoffDesigns(n); }} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
                  {["Text-based", "Typographic", "Illustration", "Vintage", "Minimalist", "Maximalist"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </Card>
          ))}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn accent={accent} small secondary onClick={addHandoffDesign}>+ Add Design</Btn>
          </div>

          <Btn accent={accent} disabled={!handoffNiche || !handoffDesigns[0].name} onClick={() => {
            const handoff = { id: Date.now(), niche: handoffNiche, designs: handoffDesigns, rb_status: "pending_rb_listings", merch_status: "pending_merch_listings", date: new Date().toDateString() };
            update("designHandoffs", [handoff, ...state.designHandoffs]);
            addNotification("operations", `[IN] ${handoffDesigns.filter(d => d.name).length} designs handed off by son -- Redbubble listings needed (${handoffNiche})`);
            addNotification("founder", `[IN] ${handoffDesigns.filter(d => d.name).length} designs completed by son -- Merch listing copy needed (${handoffNiche})`);
            setHandoffNiche(""); setHandoffDesigns([{ name: "", description: "", designText: "", style: "Text-based" }]);
            alert("OK Handed off! Mum and Dad have been notified.");
          }}>
            Submit Handoff OK
          </Btn>
        </div>
      )}

      {activeTab === "uploads" && (
        <div>
          <SectionTitle accent={accent}>// UPLOAD LOG</SectionTitle>
          <Alert accent={accent}>Log every upload here. If a design is rejected, use the Report Rejection button -- never try to fix it yourself.</Alert>
          <Card accent={accent}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, marginBottom: 12 }}>// LOG NEW UPLOAD</div>
            <Field label="Design name" value={uploadEntry.design} onChange={v => setUploadEntry(p => ({ ...p, design: v }))} placeholder="e.g. Reel Life Text Design" small />
            <Field label="Niche" value={uploadEntry.niche} onChange={v => setUploadEntry(p => ({ ...p, niche: v }))} placeholder="e.g. Fishing Dad" small />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[["Platform", "platform", ["Merch", "Redbubble", "Both"]], ["Status", "status", ["Pending Review", "Live", "Rejected"]]].map(([label, key, options]) => (
                <div key={key}>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                  <select value={uploadEntry[key]} onChange={e => setUploadEntry(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", background: "#111827", border: "1px solid #2e2e2e", borderRadius: 10, padding: "8px 10px", color: "#eef2ff", fontSize: 12 }}>
                    {options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <Btn accent={accent} small disabled={!uploadEntry.design} onClick={() => {
              update("uploadLog", [{ ...uploadEntry, id: Date.now(), date: new Date().toDateString() }, ...state.uploadLog]);
              if (uploadEntry.status === "Rejected") {
                addNotification("founder", `[!] Rejection reported by son -- ${uploadEntry.design} (${uploadEntry.niche})`);
                update("rejectionReports", [{ id: Date.now(), design: uploadEntry.design, message: "Pending -- son to provide rejection message", status: "new" }, ...state.rejectionReports]);
              }
              setUploadEntry({ design: "", niche: "", platform: "Both", status: "Pending Review" });
            }}>
              Log Upload
            </Btn>
          </Card>

          {state.uploadLog.length > 0 && (
            <div>
              <SectionTitle accent={accent}>// UPLOAD HISTORY</SectionTitle>
              {state.uploadLog.map((u, i) => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e1e1e", fontSize: 13 }}>
                  <div>
                    <div style={{ color: "#eef2ff" }}>{u.design}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{u.niche}  -  {u.platform}  -  {u.date}</div>
                  </div>
                  <Badge label={u.status} color={u.status === "Live" ? "#22c55e" : u.status === "Rejected" ? "#ef4444" : "#888"} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "checklist" && (
        <div>
          <SectionTitle accent={accent}>// WEEKLY PRODUCTION CHECKLIST</SectionTitle>
          <Checklist accent={accent} items={[
            "Read and acknowledge this week's brief from Dad (Monday)",
            "Create 5 designs for niche 1 -- export PNG at full res (Tuesday)",
            "Create 5 designs for niche 2 -- export PNG at full res (Wednesday)",
            "Submit design handoffs to Mum and Dad via Handoff tab",
            "Upload niche 1 to both platforms using Dad's + Mum's copy (Thursday)",
            "Upload niche 2 to both platforms + report Redbubble views to Dad (Friday)",
          ]} />

          <SectionTitle accent={accent} style={{ marginTop: 20 }}>// WEEKLY DESIGN PROGRESS</SectionTitle>
          <Card accent={accent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: "#94a3c8" }}>Designs this week</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: accent.main }}>{state.uploadLog.filter(u => u.date === new Date().toDateString()).length} / 10</div>
            </div>
            <div style={{ height: 6, background: "#111827", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, state.uploadLog.filter(u => u.date === new Date().toDateString()).length * 10)}%`, background: accent.main, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>Target: 10 designs/week  -  500 in 12 months = income inflection point</div>
          </Card>

          <div style={{ marginTop: 16 }}>
            <DetergentFund state={state} update={update} editable={false} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// LOGIN SCREEN
// ============================================================
const LoginScreen = ({ onLogin }) => {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!selected) return;
    if (selected.pin === pin) { onLogin(selected); }
    else { setError("Incorrect PIN. Try again."); setPin(""); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} } @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#555", letterSpacing: "0.15em", marginBottom: 12 }}>// LIST_PEAK_STUDIO_OS  -  v1.0</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#eef2ff", fontFamily: "'Sora', 'Inter', sans-serif", letterSpacing: "-0.5px" }}>POD Studio OS</div>
          <div style={{ fontSize: 14, color: "#555", marginTop: 8 }}>Select your role to continue</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {USERS.map(u => {
            const acc = ACCENT[u.role];
            const active = selected?.id === u.id;
            return (
              <button key={u.id} onClick={() => { setSelected(u); setError(""); setPin(""); }} style={{ background: active ? acc.dim : "#0d1424", border: `1px solid ${active ? acc.main : "#1e2d47"}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: acc.main, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#eef2ff", fontFamily: "'Sora', 'Inter', sans-serif" }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "#666", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{u.role.toUpperCase()}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div>
            <div style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Enter PIN for {selected.name}</div>
            <input type="password" value={pin} onChange={e => { setPin(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} maxLength={4} placeholder="...." style={{ width: "100%", background: "#111827", border: `1px solid ${ACCENT[selected.role].border}`, borderRadius: 10, padding: "12px 16px", color: "#eef2ff", fontSize: 20, letterSpacing: 8, textAlign: "center", boxSizing: "border-box", fontFamily: "monospace", marginBottom: 12 }} autoFocus />
            {error && <div style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>{error}</div>}
            <div style={{ fontSize: 11, color: "#555", textAlign: "center", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>Demo PINs: Sheldon=1234  -  Wife=5678  -  Son=9012</div>
            <button onClick={handleLogin} style={{ width: "100%", background: ACCENT[selected.role].main, color: "#080c14", border: "none", borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', 'Inter', sans-serif" }}>
              Enter Dashboard ->
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const { state, update, addNotification, clearNotification } = useSharedState();

  if (!user) return <LoginScreen onLogin={setUser} />;

  const accent = ACCENT[user.role];
  const notifications = state.notifications[user.role];

  const roleLabel = { founder: "Strategy & Research", operations: "Research & Operations", designer: "Design & Production" };

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", fontFamily: "'Sora', 'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
        textarea, input, select { outline: none; }
        textarea:focus, input:focus, select:focus { border-color: ${accent.main} !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #2e2e2e; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e1e", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#080c14ee", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent.main }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#eef2ff", letterSpacing: "-0.3px" }}>POD Studio OS</div>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>// {user.name.toUpperCase()}  -  {roleLabel[user.role].toUpperCase()}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NotifBell notifications={notifications} onClear={(id) => clearNotification(user.role, id)} accent={accent} />
          <button onClick={() => setUser(null)} style={{ background: "transparent", border: "1px solid #2e2e2e", color: "#888", borderRadius: 10, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px" }}>
        {/* Role banner */}
        <div style={{ background: `linear-gradient(135deg, ${accent.dim}, rgba(255,255,255,0.02))`, border: `1px solid ${accent.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#eef2ff" }}>Good morning, {user.name}.</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{roleLabel[user.role]}  -  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: accent.main, letterSpacing: "0.1em" }}>
            {user.role === "founder" && "VALIDATE  -  BRIEF  -  ANALYSE"}
            {user.role === "operations" && "RESEARCH  -  LISTINGS  -  CLIENTS"}
            {user.role === "designer" && "DESIGN  -  CREATE  -  UPLOAD"}
          </div>
        </div>

        {/* Dashboard */}
        {user.role === ROLES.FOUNDER && <FounderDashboard state={state} update={update} addNotification={addNotification} clearNotification={clearNotification} />}
        {user.role === ROLES.OPERATIONS && <OperationsDashboard state={state} update={update} addNotification={addNotification} clearNotification={clearNotification} />}
        {user.role === ROLES.DESIGNER && <DesignerDashboard state={state} update={update} addNotification={addNotification} clearNotification={clearNotification} />}
      </div>
    </div>
  );
}
