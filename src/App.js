import React, { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SUPABASE CLIENT
// ============================================================
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ============================================================
// CONSTANTS & CONFIG
// ============================================================
const ROLES = { FOUNDER: "founder", OPERATIONS: "operations", DESIGNER: "designer" };

// Light theme accent colours — role-specific tints on top of the warm neutral base
const ACCENT = {
  founder: {
    main: "#2d6a4f",       // forest green (primary action)
    light: "#d8f3dc",      // very light green bg tint
    mid: "#b7e4c7",        // mid green for borders/dividers
    border: "#95d5b2",     // border green
    text: "#1b4332",       // dark green text
    muted: "#52b788",      // muted green
    label: "FOUNDER",
    tag: "#2d6a4f",
  },
  operations: {
    main: "#b5451b",       // rust / terracotta
    light: "#fde8de",
    mid: "#f5c4ad",
    border: "#e8966e",
    text: "#7a2e0e",
    muted: "#d4682f",
    label: "OPERATIONS",
    tag: "#b5451b",
  },
  designer: {
    main: "#5c5edc",       // indigo/violet
    light: "#eeeeff",
    mid: "#c7c8f5",
    border: "#a5a6ef",
    text: "#2d2d8e",
    muted: "#7577e0",
    label: "DESIGNER",
    tag: "#5c5edc",
  },
};

// ============================================================
// TIME-AWARE GREETING
// ============================================================
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// ============================================================
// SUPABASE DATA HOOK
// ============================================================
const useSharedState = (userRole) => {
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
    pipeline: [],
    notifications: [],
    loaded: false,
  });

  // Load all data for this user's role
  const loadAll = useCallback(async () => {
    try {
      const [
        { data: fund },
        { data: briefs },
        { data: trends },
        { data: urgent },
        { data: handoffs },
        { data: copies },
        { data: uploads },
        { data: rejections },
        { data: clients },
        { data: pipelineData },
        { data: notifs },
      ] = await Promise.all([
        supabase.from("detergent_fund").select("*").single(),
        supabase.from("niche_briefs").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("trend_reports").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("urgent_trends").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("design_handoffs").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("listing_copies").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("upload_log").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("rejection_reports").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("pipeline").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("notifications").select("*").eq("for_role", userRole).eq("read", false).order("created_at", { ascending: false }).limit(20),
      ]);
      setState({
        detergentFund: fund ? { amount: fund.amount, goal: fund.goal } : { amount: 0, goal: 5000 },
        nicheBriefs: briefs || [],
        trendReports: trends || [],
        urgentTrends: urgent || [],
        designHandoffs: handoffs || [],
        listingCopies: copies || [],
        uploadLog: uploads || [],
        rejectionReports: rejections || [],
        clients: clients || [],
        pipeline: pipelineData || [],
        notifications: notifs || [],
        loaded: true,
      });
    } catch (e) {
      console.error("loadAll error", e);
      setState(prev => ({ ...prev, loaded: true }));
    }
  }, [userRole]);

  useEffect(() => { if (userRole) loadAll(); }, [userRole, loadAll]);

  // Generic update: re-fetches after mutation
  const update = useCallback(async (table, operation, data) => {
    try {
      if (operation === "insert") {
        await supabase.from(table).insert(data);
      } else if (operation === "update") {
        await supabase.from(table).update(data.values).eq("id", data.id);
      } else if (operation === "upsert") {
        await supabase.from(table).upsert(data);
      }
      await loadAll();
    } catch (e) {
      console.error("update error", e);
    }
  }, [loadAll]);

  const addNotification = useCallback(async (forRole, message) => {
    await supabase.from("notifications").insert({ for_role: forRole, message, read: false });
    await loadAll();
  }, [loadAll]);

  const clearNotification = useCallback(async (id) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setState(prev => ({ ...prev, notifications: prev.notifications.filter(n => n.id !== id) }));
  }, []);

  return { state, update, addNotification, clearNotification, reload: loadAll };
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
    const err = "API error — check connection.";
    if (onChunk) onChunk(err);
    return err;
  }
};

// ============================================================
// GLOBAL STYLES (injected once at root)
// ============================================================
const GlobalStyles = ({ accentMain }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      background: #f4f0eb;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
    }

    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes fadeUp  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

    textarea, input, select { outline: none; font-family: 'DM Sans', sans-serif; }
    textarea:focus, input:focus, select:focus { border-color: ${accentMain} !important; box-shadow: 0 0 0 3px ${accentMain}1a; }

    ::-webkit-scrollbar          { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track    { background: #ede8e0; }
    ::-webkit-scrollbar-thumb    { background: #c4bdb4; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #a89f96; }
  `}</style>
);

// ============================================================
// SHARED UI COMPONENTS  (light-theme)
// ============================================================

const Spinner = ({ accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, color: accent?.muted || "#888", fontSize: 13, padding: "8px 0", animation: "fadeUp 0.2s" }}>
    <div style={{ width: 16, height: 16, border: `2px solid ${accent?.mid || "#ddd"}`, borderTopColor: accent?.main || "#333", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
    Claude is thinking…
  </div>
);

const OutputBox = ({ content, accent }) => content ? (
  <div style={{ background: "#fff", border: `1.5px solid ${accent.border}`, borderRadius: 10, padding: "14px 16px", marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "#374151", lineHeight: 1.75, whiteSpace: "pre-wrap", maxHeight: 420, overflowY: "auto", animation: "fadeUp 0.2s" }}>
    {content}
    <button
      onClick={() => navigator.clipboard.writeText(content)}
      style={{ display: "block", marginTop: 10, background: accent.light, border: `1.5px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
    >
      Copy →
    </button>
  </div>
) : null;

const Field = ({ label, value, onChange, multiline, placeholder, small }) => (
  <div style={{ marginBottom: small ? 8 : 13 }}>
    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
    {multiline
      ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
          style={{ width: "100%", background: "#fff", border: "1.5px solid #d9d4cc", borderRadius: 9, padding: "9px 12px", color: "#111", fontSize: 13.5, lineHeight: 1.5, resize: "vertical" }} />
      : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", background: "#fff", border: "1.5px solid #d9d4cc", borderRadius: 9, padding: "9px 12px", color: "#111", fontSize: 13.5 }} />
    }
  </div>
);

const Btn = ({ onClick, children, accent, small, disabled, secondary, danger, fullWidth }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: danger ? "#fee2e2" : secondary ? accent?.light || "#f3f4f6" : accent?.main || "#374151",
      color: danger ? "#b91c1c" : secondary ? accent?.text || "#374151" : "#fff",
      border: danger ? "1.5px solid #fca5a5" : secondary ? `1.5px solid ${accent?.border || "#d1d5db"}` : "none",
      borderRadius: 9,
      padding: small ? "6px 14px" : "10px 20px",
      fontSize: small ? 12 : 13.5,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.15s",
      width: fullWidth ? "100%" : undefined,
      letterSpacing: "0.01em",
    }}
  >{children}</button>
);

const Card = ({ children, accent, style = {}, hover }) => (
  <div style={{
    background: "#fff",
    border: "1.5px solid #e5e0d8",
    borderRadius: 12,
    padding: "16px 18px",
    marginBottom: 14,
    transition: "box-shadow 0.15s",
    ...style
  }}>
    {children}
  </div>
);

const SectionTitle = ({ children, accent, style = {} }) => (
  <div style={{ fontSize: 11, color: accent.main, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, paddingBottom: 8, borderBottom: `1.5px solid ${accent.mid}`, ...style }}>
    {children}
  </div>
);

const Alert = ({ children, accent, style = {} }) => (
  <div style={{ background: accent.light, border: `1.5px solid ${accent.mid}`, borderRadius: 9, padding: "11px 14px", fontSize: 13, color: accent.text, lineHeight: 1.6, marginBottom: 14, ...style }}>
    {children}
  </div>
);

const Badge = ({ label, color }) => (
  <span style={{ background: color + "18", border: `1.5px solid ${color}44`, color, borderRadius: 20, padding: "2px 9px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", display: "inline-block" }}>
    {label}
  </span>
);

// ============================================================
// SELECT COMPONENT
// ============================================================
const Select = ({ label, value, onChange, options }) => (
  <div>
    {label && <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: "#fff", border: "1.5px solid #d9d4cc", borderRadius: 9, padding: "9px 12px", color: "#111", fontSize: 13.5, cursor: "pointer" }}
    >
      {options.map(o => typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ============================================================
// TAB BAR
// ============================================================
const TabBar = ({ tabs, active, onChange, accent }) => (
  <div style={{ display: "flex", gap: 2, marginBottom: 22, borderBottom: `1.5px solid #e5e0d8`, overflowX: "auto", paddingBottom: 0 }}>
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          background: "none",
          border: "none",
          borderBottom: active === t.id ? `2.5px solid ${accent.main}` : "2.5px solid transparent",
          color: active === t.id ? accent.main : "#6b7280",
          padding: "9px 16px",
          fontSize: 13,
          fontWeight: active === t.id ? 700 : 500,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
          marginBottom: "-1.5px",
        }}
      >
        {t.label}
      </button>
    ))}
  </div>
);

// ============================================================
// CHECKLIST
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
        <div key={i} onClick={() => toggle(i)} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 0", borderBottom: "1px solid #ede8e0", cursor: "pointer" }}>
          <div style={{
            width: 19, height: 19, borderRadius: 5,
            border: `2px solid ${checked.includes(i) ? accent.main : "#c4bdb4"}`,
            background: checked.includes(i) ? accent.main : "#fff",
            flexShrink: 0, marginTop: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {checked.includes(i) && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13.5, color: checked.includes(i) ? "#9ca3af" : "#374151", textDecoration: checked.includes(i) ? "line-through" : "none", lineHeight: 1.5 }}>{item}</span>
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>{checked.length}/{items.length} complete · resets daily</div>
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
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Detergent Launch Fund</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent.main, marginBottom: 2 }}>${amount.toLocaleString()}</div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>of ${goal.toLocaleString()} goal</div>
      <div style={{ height: 7, background: "#f0ece6", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: accent.main, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>{pct}% funded</div>
      {editable && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input type="number" placeholder="Update balance"
            style={{ flex: 1, background: "#f9f7f4", border: "1.5px solid #d9d4cc", borderRadius: 9, padding: "7px 10px", color: "#111", fontSize: 13 }}
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
      <button
        onClick={() => setOpen(!open)}
        style={{ background: open ? accent.light : "transparent", border: `1.5px solid ${open ? accent.border : "#e5e0d8"}`, borderRadius: 8, cursor: "pointer", padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, position: "relative", transition: "all 0.15s" }}
      >
        <span style={{ fontSize: 16 }}>🔔</span>
        {unread > 0 && (
          <span style={{ background: accent.main, color: "#fff", borderRadius: "50%", width: 17, height: 17, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", top: -4, right: -4 }}>{unread}</span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 40, width: 300, background: "#fff", border: "1.5px solid #e5e0d8", borderRadius: 12, zIndex: 200, padding: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.1)", maxHeight: 320, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Notifications</div>
          {notifications.length === 0
            ? <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "12px 0" }}>All clear 🎉</div>
            : notifications.map(n => (
              <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid #f0ece6" }}>
                <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.45, flex: 1, paddingRight: 8 }}>
                  {n.msg}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{n.time}</div>
                </div>
                <button onClick={() => onClear(n.id)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 15, padding: "0 2px", lineHeight: 1 }}>×</button>
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
const FounderDashboard = ({ state, update, addNotification }) => {
  const accent = ACCENT.founder;
  const [activeTab, setActiveTab] = useState("brief");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const [niche, setNiche] = useState("");
  const [searchVol, setSearchVol] = useState("");
  const [competition, setCompetition] = useState("Medium");
  const [trendEvidence, setTrendEvidence] = useState("");

  const [briefNiche1, setBriefNiche1] = useState("");
  const [briefNiche2, setBriefNiche2] = useState("");
  const [concepts1, setConcepts1] = useState("");
  const [concepts2, setConcepts2] = useState("");

  const [listingNiche, setListingNiche] = useState("");
  const [designText, setDesignText] = useState("");
  const [targetBuyer, setTargetBuyer] = useState("");
  const [keywords, setKeywords] = useState("");

  const [rejMsg, setRejMsg] = useState("");
  const [rejDesc, setRejDesc] = useState("");

  const [perfWeek, setPerfWeek] = useState({ impressions: "", clicks: "", sales: "", rbViews: "" });

  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", service: "", niche: "", invoice: "" });
  const [selectedClient, setSelectedClient] = useState(null);
  const [emailType, setEmailType] = useState("acknowledge");

  const [rbNiche, setRbNiche] = useState("");
  const [rbDesigns, setRbDesigns] = useState("");
  const [rbBuyer, setRbBuyer] = useState("");
  const [rbOccasions, setRbOccasions] = useState("");

  const run = async (prompt, notify) => {
    setLoading(true); setOutput("");
    await callClaude(prompt, setOutput);
    setLoading(false);
    if (notify) addNotification(notify.role, notify.msg);
  };

  const emailPrompts = {
    acknowledge: (c) => `Write a short, warm, professional email acknowledging a new enquiry from ${c.name} who wants "${c.service}" for the "${c.niche}" niche. Sign off as Sheldon from List Peak. Keep it under 120 words. No subject line needed unless specifically useful.`,
    deliver: (c) => `Write a professional email delivering a completed Amazon research report to ${c.name}. Service: ${c.service}. Niche: ${c.niche}. Mention the report is attached, highlight 2-3 things they should look at first, and invite questions. Sign off as Sheldon from List Peak. Under 180 words.`,
    followup: (c) => `Write a friendly follow-up email checking in with ${c.name} about the ${c.service} report we delivered for their ${c.niche} niche. Ask if they have questions and offer a 15-min call. Sign off as Sheldon from List Peak. Under 100 words.`,
    testimonial: (c) => `Write an email politely asking ${c.name} for a testimonial or Google review after we delivered their ${c.service}. Keep it brief, make it easy. Sign off as Sheldon from List Peak. Under 80 words.`,
    invoice: (c) => `Write a professional invoice email to ${c.name} for ${c.service} at $${c.invoice}. Include payment instructions via Wise. Sign off as Sheldon from List Peak. Under 100 words.`,
    chase: (c) => `Write a polite but firm payment chase email to ${c.name}. Invoice amount: $${c.invoice} for ${c.service}. Keep it professional and not aggressive. Sign off as Sheldon from List Peak. Under 80 words.`,
  };

  const tabs = [
    { id: "brief", label: "Weekly Brief" },
    { id: "validate", label: "Niche Validate" },
    { id: "merch", label: "Merch Listing" },
    { id: "rb", label: "Redbubble Listing" },
    { id: "rejection", label: "Rejection Fix" },
    { id: "clients", label: "Client Pipeline" },
    { id: "pipeline", label: "Pipeline" },
    { id: "performance", label: "Performance" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div>
      <TabBar tabs={tabs} active={activeTab} onChange={(id) => { setActiveTab(id); setOutput(""); }} accent={accent} />

      {activeTab === "brief" && (
        <div>
          <SectionTitle accent={accent}>Weekly Design Brief for Hayden</SectionTitle>
          <Alert accent={accent}>
            Compose the weekly niche brief below. When submitted, Hayden sees it instantly on his dashboard under "This Week's Brief."
          </Alert>
          <Field label="Niche 1" value={briefNiche1} onChange={setBriefNiche1} placeholder="e.g. Fishing Dad" />
          <Field label="Design concepts for niche 1" value={concepts1} onChange={setConcepts1} multiline placeholder="e.g. 5 text-based designs — humour angle. Focus on Father's Day gift buyer." />
          <Field label="Niche 2" value={briefNiche2} onChange={setBriefNiche2} placeholder="e.g. Dog Mum" />
          <Field label="Design concepts for niche 2" value={concepts2} onChange={setConcepts2} multiline placeholder="e.g. 5 mixed text+graphic — paw prints, humour." />
          <Btn accent={accent} disabled={!briefNiche1 || !briefNiche2} onClick={() => {
            const brief = {
              id: Date.now(), week: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
              content: `NICHE 1: ${briefNiche1}\n${concepts1}\n\nNICHE 2: ${briefNiche2}\n${concepts2}`
            };
            update("nicheBriefs", [brief, ...state.nicheBriefs]);
            addNotification("designer", `New design brief from Dad — ${briefNiche1} + ${briefNiche2}. Check the Brief tab.`);
            setBriefNiche1(""); setBriefNiche2(""); setConcepts1(""); setConcepts2("");
            alert("Brief sent to Hayden ✓");
          }}>
            Send Brief to Hayden →
          </Btn>

          {state.nicheBriefs.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionTitle accent={accent}>Latest Brief Sent</SectionTitle>
              <Card accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Badge label="ACTIVE" color={accent.main} />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{state.nicheBriefs[0].week}</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{state.nicheBriefs[0].content}</div>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === "validate" && (
        <div>
          <SectionTitle accent={accent}>Niche Validation</SectionTitle>
          <Alert accent={accent}>Run before briefing Hayden. Validates market signals and competitive gaps for a niche.</Alert>
          <Field label="Niche" value={niche} onChange={setNiche} placeholder="e.g. Fishing Dad" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <Field label="Merch search volume signal" value={searchVol} onChange={setSearchVol} placeholder="e.g. High (5k+ results)" />
            <Select label="Competition level" value={competition} onChange={setCompetition} options={["Low", "Medium", "High", "Very High"]} />
          </div>
          <Field label="Trend evidence" value={trendEvidence} onChange={setTrendEvidence} multiline placeholder="e.g. Trending on TikTok, Pinterest boards active, seasonal Q4" />
          <Btn accent={accent} disabled={loading || !niche} onClick={() => run(`You are a print-on-demand niche analyst. Evaluate this POD niche for Amazon Merch on Demand and Redbubble.\n\nNiche: ${niche}\nSearch volume signal: ${searchVol}\nCompetition level: ${competition}\nTrend evidence: ${trendEvidence}\n\nAnalyse:\n1. DEMAND SCORE (1-10) with reasoning\n2. COMPETITION ASSESSMENT -- is there still a gap?\n3. DESIGN ANGLES -- 3 specific angles that are under-served\n4. BUYER PROFILE -- who buys this and why\n5. SEASONAL TIMING -- when to launch\n6. VERDICT -- GO / PROCEED WITH CAUTION / AVOID\n\nBe direct and specific. No waffle.`)}>
            {loading ? "Validating…" : "Validate Niche →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
          {output && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Btn accent={accent} small secondary onClick={() => {
                const report = { id: Date.now(), niche, content: output, date: new Date().toDateString() };
                update("trendReports", [report, ...state.trendReports]);
                addNotification("operations", `Niche validation report ready: ${niche}`);
                setOutput(""); setNiche(""); setSearchVol(""); setTrendEvidence("");
                alert("Report saved ✓");
              }}>Save Report</Btn>
            </div>
          )}
        </div>
      )}

      {activeTab === "merch" && (
        <div>
          <SectionTitle accent={accent}>Merch on Demand — Listing Copy Generator</SectionTitle>
          <Alert accent={accent}>Generate listing copy for Sati to upload. She will compliance-check before using.</Alert>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Niche" value={listingNiche} onChange={setListingNiche} placeholder="e.g. Fishing Dad" />
            <Field label="Target buyer" value={targetBuyer} onChange={setTargetBuyer} placeholder="e.g. Gift for dad, Father's Day" />
          </div>
          <Field label="Design text (exact wording on the design)" value={designText} onChange={setDesignText} placeholder="e.g. Reel Life — Born to Fish" />
          <Field label="Keywords to include (optional)" value={keywords} onChange={setKeywords} placeholder="e.g. fishing dad gift, fisherman shirt, bass fishing" />
          <Btn accent={accent} disabled={loading || !listingNiche || !designText} onClick={() => run(`Write Amazon Merch on Demand listing copy for a print-on-demand design.\n\nNiche: ${listingNiche}\nDesign text: ${designText}\nTarget buyer: ${targetBuyer}\nKeywords: ${keywords}\n\nWrite:\n1. TITLE — under 60 characters, natural, keyword-rich, no all-caps, no pipes\n2. BULLET 1 — feature benefit, 200 chars max\n3. BULLET 2 — feature benefit, 200 chars max\n4. DESCRIPTION — 150-180 words. Open with the buyer's identity, describe the design, explain why it's a great gift or self-purchase, close with an invitation. Human tone, no keyword stuffing.\n\nFollow Amazon's current content guidelines. Do not include: prices, URLs, competitor names, restricted claims, sensational language.`)}>
            {loading ? "Generating…" : "Generate Listing Copy →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
          {output && (
            <Btn accent={accent} small secondary style={{ marginTop: 10 }} onClick={() => {
              const copy = { id: Date.now(), niche: listingNiche, designText, content: output, status: "pending_upload", date: new Date().toDateString() };
              update("listingCopies", [copy, ...state.listingCopies]);
              addNotification("operations", `Merch listing copy ready for ${listingNiche} — compliance check then upload.`);
              setOutput(""); setListingNiche(""); setDesignText(""); setTargetBuyer(""); setKeywords("");
              alert("Listing copy sent to Sati ✓");
            }}>Send to Sati →</Btn>
          )}
        </div>
      )}

      {activeTab === "rb" && (
        <div>
          <SectionTitle accent={accent}>Redbubble Listing Generator — POD-01</SectionTitle>
          <Alert accent={accent}>Write complete Redbubble listings. Son gets notified when copy is ready.</Alert>
          <Field label="Niche" value={rbNiche} onChange={setRbNiche} placeholder="e.g. Fishing enthusiasts" />
          <Field label="Designs (describe each one)" value={rbDesigns} onChange={setRbDesigns} multiline placeholder={"1. 'Reel Life — Born to Fish' text-based humour\n2. 'Fish Fear Me' with fishing rod graphic\n3. 'Gone Fishing' vintage badge style"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Target buyer" value={rbBuyer} onChange={setRbBuyer} placeholder="e.g. Fishing hobbyists, gift for dad" />
            <Field label="Occasions" value={rbOccasions} onChange={setRbOccasions} placeholder="e.g. Birthday, Father's Day" />
          </div>
          <Btn accent={accent} disabled={loading || !rbNiche} onClick={() => run(`Write complete Redbubble listings for these print-on-demand designs.\n\nNiche: ${rbNiche}\nTarget buyer: ${rbBuyer}\nOccasions: ${rbOccasions}\n\nMy designs:\n${rbDesigns}\n\nFor EACH design write:\n1. TITLE — natural, descriptive, under 80 characters\n2. TAGS — exactly 15 tags, comma separated, broad and specific mixed\n3. DESCRIPTION — 180-220 words, warm and conversational. Open speaking directly to the buyer, describe what makes the design special, say who it's for, include 1-2 occasion references, close with a warm invitation. Write like a person, not a catalogue.`)}>
            {loading ? "Generating…" : "Generate Redbubble Listings →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
          {output && (
            <Btn accent={accent} small secondary style={{ marginTop: 10 }} onClick={() => {
              addNotification("designer", "Redbubble listing copy ready — check Brief tab.");
              setOutput("");
              alert("Notified Hayden ✓");
            }}>Notify Hayden →</Btn>
          )}
        </div>
      )}

      {activeTab === "rejection" && (
        <div>
          <SectionTitle accent={accent}>Rejection Fix Tool</SectionTitle>
          <Alert accent={accent}>Paste the rejection message from Amazon Merch. Claude identifies the violation and writes a clean fix plan.</Alert>
          <Field label="Amazon rejection message" value={rejMsg} onChange={setRejMsg} multiline placeholder="Paste the full rejection message here…" />
          <Field label="Your design description" value={rejDesc} onChange={setRejDesc} placeholder="e.g. 'Reel Life — Born to Fish' fishing niche text design" />
          <Btn accent={accent} disabled={loading || !rejMsg} onClick={() => run(`An Amazon Merch on Demand design was rejected. Analyse the rejection and provide a fix plan.\n\nRejection message:\n${rejMsg}\n\nDesign description: ${rejDesc}\n\n1. VIOLATION TYPE — what policy was triggered\n2. EXACT PROBLEM — what specific element caused the rejection\n3. FIX — specific rewrite or change to make it compliant\n4. REVISED COPY — ready-to-use compliant version of any text\n5. PREVENTION — one rule to remember going forward`)}>
            {loading ? "Analysing…" : "Analyse Rejection →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
        </div>
      )}

      {activeTab === "clients" && (
        <div>
          <SectionTitle accent={accent}>List Peak — Client Pipeline</SectionTitle>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{state.clients.length} client{state.clients.length !== 1 ? "s" : ""}</span>
            <Btn accent={accent} small onClick={() => setShowAddClient(!showAddClient)}>+ Add Client</Btn>
          </div>

          {showAddClient && (
            <Card accent={accent}>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent.main, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>New Client</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Client name" value={newClient.name} onChange={v => setNewClient(p => ({ ...p, name: v }))} placeholder="First name" small />
                <Field label="Service" value={newClient.service} onChange={v => setNewClient(p => ({ ...p, service: v }))} placeholder="e.g. Niche Research Report" small />
                <Field label="Niche" value={newClient.niche} onChange={v => setNewClient(p => ({ ...p, niche: v }))} placeholder="e.g. Kitchen gadgets" small />
                <Field label="Invoice (USD)" value={newClient.invoice} onChange={v => setNewClient(p => ({ ...p, invoice: v }))} placeholder="e.g. 97" small />
              </div>
              <div style={{ marginTop: 10 }}>
                <Btn accent={accent} small onClick={() => {
                  update("clients", [{ ...newClient, id: Date.now(), status: "New", paid: false, date: new Date().toDateString() }, ...state.clients]);
                  setNewClient({ name: "", service: "", niche: "", invoice: "" });
                  setShowAddClient(false);
                }}>Save Client</Btn>
              </div>
            </Card>
          )}

          {state.clients.length === 0
            ? <Alert accent={accent}>No clients yet. Add your first List Peak client above.</Alert>
            : state.clients.map((c, i) => (
              <Card key={c.id} accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 3 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{c.service} · {c.niche}</div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <Badge label={c.status} color={c.status === "Paid" ? "#2d6a4f" : c.status === "New" ? "#b5451b" : "#6b7280"} />
                      <Badge label={c.paid ? "PAID" : `$${c.invoice} DUE`} color={c.paid ? "#2d6a4f" : "#b5451b"} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexDirection: "column", alignItems: "flex-end" }}>
                    <select value={c.status} onChange={e => { const updated = [...state.clients]; updated[i] = { ...c, status: e.target.value }; update("clients", updated); }}
                      style={{ background: "#fff", border: "1.5px solid #d9d4cc", borderRadius: 8, padding: "5px 9px", color: "#374151", fontSize: 12 }}>
                      {["New", "In Progress", "Report Sent", "Paid"].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)}
                      style={{ background: accent.light, border: `1.5px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Email {selectedClient?.id === c.id ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {selectedClient?.id === c.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${accent.mid}` }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {[["acknowledge", "Acknowledge"], ["deliver", "Send Report"], ["followup", "Follow Up"], ["testimonial", "Testimonial"], ["invoice", "Invoice"], ["chase", "Chase Payment"]].map(([type, label]) => (
                        <button key={type} onClick={() => setEmailType(type)}
                          style={{ background: emailType === type ? accent.main : accent.light, color: emailType === type ? "#fff" : accent.text, border: `1.5px solid ${emailType === type ? accent.main : accent.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <Btn accent={accent} small disabled={loading} onClick={() => run(emailPrompts[emailType](c))}>
                      {loading ? "Writing…" : "Generate Email →"}
                    </Btn>
                    {loading && <Spinner accent={accent} />}
                    <OutputBox content={output} accent={accent} />
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}

      {activeTab === "pipeline" && (
        <div>
          <Alert accent={accent}>
            Track every niche idea from first capture to first sale. Move items forward as the team completes each stage.
          </Alert>
          <PipelineBoard
            state={state}
            update={update}
            addNotification={addNotification}
            accent={accent}
            userRole="founder"
          />
        </div>
      )}

      {activeTab === "performance" && (
        <div>
          <SectionTitle accent={accent}>Weekly Performance Log</SectionTitle>
          <Alert accent={accent}>Log weekly numbers for both platforms. Claude analyses trends and flags what to action.</Alert>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <Field label="Merch impressions" value={perfWeek.impressions} onChange={v => setPerfWeek(p => ({ ...p, impressions: v }))} placeholder="e.g. 1200" />
            <Field label="Merch clicks" value={perfWeek.clicks} onChange={v => setPerfWeek(p => ({ ...p, clicks: v }))} placeholder="e.g. 48" />
            <Field label="Merch sales" value={perfWeek.sales} onChange={v => setPerfWeek(p => ({ ...p, sales: v }))} placeholder="e.g. 3" />
            <Field label="Redbubble views" value={perfWeek.rbViews} onChange={v => setPerfWeek(p => ({ ...p, rbViews: v }))} placeholder="e.g. 210" />
          </div>
          <Btn accent={accent} disabled={loading || !perfWeek.impressions} onClick={() => run(`Analyse this week's print-on-demand performance and provide action items.\n\nMerch on Demand:\n- Impressions: ${perfWeek.impressions}\n- Clicks: ${perfWeek.clicks}\n- Sales: ${perfWeek.sales}\n- Click-through rate: ${perfWeek.impressions && perfWeek.clicks ? ((perfWeek.clicks / perfWeek.impressions) * 100).toFixed(2) : "N/A"}%\n- Conversion rate: ${perfWeek.clicks && perfWeek.sales ? ((perfWeek.sales / perfWeek.clicks) * 100).toFixed(2) : "N/A"}%\n\nRedbubble:\n- Views: ${perfWeek.rbViews}\n\nProvide:\n1. PERFORMANCE ASSESSMENT — is this on track for a new store?\n2. BIGGEST LEVER — the one thing that would move the needle most\n3. SPECIFIC ACTIONS — 2-3 concrete things to do this week\n4. WHAT TO WATCH — what number to focus on next week`)}>
            {loading ? "Analysing…" : "Analyse Performance →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
          <div style={{ marginTop: 20 }}>
            <DetergentFund state={state} update={update} editable={true} accent={accent} />
          </div>
        </div>
      )}

      {activeTab === "checklist" && (
        <div>
          <SectionTitle accent={accent}>Weekly Checklist — Founder</SectionTitle>
          <Checklist accent={accent} items={[
            "Validate 2 niches using the Niche Validate tool",
            "Send the weekly design brief to Hayden (Monday)",
            "Generate Merch listing copy for any completed handoffs",
            "Update the Opportunity Pipeline — move niches forward",
            "Review and update client pipeline statuses",
            "Log weekly performance numbers and get action items",
            "Check Wise for incoming payments — update client records",
            "Review detergent fund balance",
            "Run the Sunday Family Review (every Sunday evening)",
          ]} />
          <div style={{ marginTop: 20 }}>
            <DetergentFund state={state} update={update} editable={true} accent={accent} />
          </div>
          <div style={{ marginTop: 20 }}>
            <SundayReview state={state} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// OPERATIONS DASHBOARD  (Sati)
// ============================================================
const OperationsDashboard = ({ state, update, addNotification }) => {
  const accent = ACCENT.operations;
  const [activeTab, setActiveTab] = useState("research");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  // RESEARCH-01 — Quick Trend Capture
  const [captPlatform, setCaptPlatform] = useState("TikTok");
  const [captDesc, setCaptDesc] = useState("");

  // RESEARCH-02 — Weekly Trend Report
  const [findings, setFindings] = useState(["", "", "", "", ""]);

  // RESEARCH-03 — Monthly Seasonal Watch
  const [month, setMonth] = useState(new Date().toLocaleString("default", { month: "long" }));

  // POD-01 — Redbubble Listings
  const [rbNiche, setRbNiche] = useState("");
  const [rbDesigns, setRbDesigns] = useState("");
  const [rbBuyer, setRbBuyer] = useState("");
  const [rbOcc, setRbOcc] = useState("");

  // POD-02 — Redbubble Rewrite
  const [rwTitle, setRwTitle] = useState("");
  const [rwTags, setRwTags] = useState("");
  const [rwDesc, setRwDesc] = useState("");
  const [rwDesign, setRwDesign] = useState("");
  const [rwNiche, setRwNiche] = useState("");

  // POD-03 — Customer Query
  const [custMsg, setCustMsg] = useState("");
  const [custWant, setCustWant] = useState("");

  // Merch Upload / Compliance
  const [compListing, setCompListing] = useState("");

  // Clients
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", service: "", niche: "", invoice: "" });
  const [selectedClient, setSelectedClient] = useState(null);
  const [emailType, setEmailType] = useState("acknowledge");

  const run = async (prompt) => { setLoading(true); setOutput(""); await callClaude(prompt, setOutput); setLoading(false); };

  const EMAIL_PROMPTS = {
    acknowledge: (c) => `Write a warm, professional email acknowledging a new List Peak enquiry from ${c.name} who wants "${c.service}" for the "${c.niche}" niche. Confirm receipt, explain next step is their brief review, report takes 5–7 working days. Sign off as the List Peak team. Under 120 words.`,
    deliver:     (c) => `Write a professional report delivery email to ${c.name} for their ${c.service} (niche: ${c.niche}). Mention report is attached, highlight to check the top opportunities section first, invite questions. Sign off as List Peak team. Under 150 words.`,
    followup:    (c) => `Write a friendly follow-up email to ${c.name} checking in after we delivered their ${c.service} report. Ask if they have questions, offer a quick call. Sign off as List Peak team. Under 80 words.`,
    testimonial: (c) => `Write a short email asking ${c.name} for a written testimonial after a successful ${c.service} delivery. Make it easy — one paragraph is fine. Sign off as List Peak team. Under 70 words.`,
    invoice:     (c) => `Write a professional invoice email to ${c.name} for ${c.service} at $${c.invoice}. Include payment via Wise. Sign off as List Peak team. Under 80 words.`,
    chase:       (c) => `Write a polite but firm payment chase email to ${c.name}. Invoice: $${c.invoice} for ${c.service}. Professional, not aggressive. Sign off as List Peak team. Under 70 words.`,
  };

  const tabs = [
    { id: "research", label: "Research" },
    { id: "redbubble", label: "Redbubble" },
    { id: "merch", label: "Merch Upload" },
    { id: "clients", label: "Clients" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div>
      <TabBar tabs={tabs} active={activeTab} onChange={(id) => { setActiveTab(id); setOutput(""); }} accent={accent} />

      {/* ── RESEARCH TAB ── */}
      {activeTab === "research" && (
        <div>

          {/* RESEARCH-01 */}
          <SectionTitle accent={accent}>Quick Trend Capture — RESEARCH-01</SectionTitle>
          <Alert accent={accent}>
            Spotted something while browsing? Capture it here instantly. Claude gives a rapid verdict and you can flag it straight to Sheldon.
          </Alert>
          <Select label="Platform" value={captPlatform} onChange={setCaptPlatform}
            options={["TikTok", "Instagram", "Pinterest", "Facebook", "YouTube", "Twitter / X", "Other"]} />
          <div style={{ marginTop: 10 }}>
            <Field label="What you saw — describe the design or paste a URL / note" value={captDesc} onChange={setCaptDesc}
              multiline placeholder="e.g. Funny fishing dad shirt getting thousands of likes on TikTok — text says 'Fish Fear Me, People Tolerate Me'" />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn accent={accent} disabled={loading || !captDesc} onClick={() => run(`You are a print-on-demand trend analyst. A social media trend has been spotted.\n\nPlatform: ${captPlatform}\nDescription: ${captDesc}\n\nAssess quickly:\n1. Is this a real POD opportunity?\n2. Would it translate to T-shirts, mugs, and other print products?\n3. Is the audience likely to buy merch?\n4. How long before this saturates Amazon (days / weeks / months)?\n5. VERDICT: ESCALATE NOW / ADD TO SUNDAY REPORT / SKIP\n\nKeep response under 150 words — this is a rapid check, not a full analysis.`)}>
              {loading ? "Checking…" : "Quick Viability Check (RESEARCH-01)"}
            </Btn>
            <Btn accent={accent} secondary small disabled={!captDesc} onClick={() => {
              update("urgentTrends", [{ id: Date.now(), platform: captPlatform, desc: captDesc, date: new Date().toDateString() }, ...state.urgentTrends]);
              addNotification("founder", `⚡ Urgent trend flagged by Sati — ${captPlatform}: ${captDesc.slice(0, 60)}…`);
              setCaptDesc("");
              alert("Flagged to Sheldon ✓");
            }}>
              Flag Urgent to Sheldon →
            </Btn>
          </div>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />

          {/* Urgent trends inbox */}
          {state.urgentTrends.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionTitle accent={accent}>Flagged Urgent Trends</SectionTitle>
              {state.urgentTrends.slice(0, 3).map((t) => (
                <Card key={t.id} accent={accent} style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <Badge label={t.platform} color={accent.main} />
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{t.date}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{t.desc}</div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            {/* RESEARCH-02 */}
            <SectionTitle accent={accent}>Weekly Trend Report — RESEARCH-02</SectionTitle>
            <Alert accent={accent}>
              Fill in what you spotted this week — paste URLs, type quick notes, describe what you saw. Submit every Sunday evening.
            </Alert>
            {findings.map((f, i) => (
              <Field key={i}
                label={`Finding ${i + 1} — Platform, what you saw, why it caught your attention`}
                value={f}
                onChange={v => { const n = [...findings]; n[i] = v; setFindings(n); }}
                multiline
                placeholder="e.g. TikTok — fishing dad shirt getting 50k likes, text 'Reel Life' with fish graphic. People tagging their dads."
              />
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn accent={accent} disabled={loading || !findings.filter(Boolean).length}
                onClick={() => run(`You are a print-on-demand trend researcher. Turn these social media observations into a structured weekly trend report.\n\nFindings this week:\n${findings.filter(Boolean).map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nFor each finding:\n- Clean up the description\n- Explain the POD potential in one sentence\n- Suggest 2 product types that would work\n- Flag any timing concerns (seasonal? already saturated?)\n\nFormat as a clean numbered list ready to hand off to Sheldon.`)}>
                {loading ? "Generating…" : "Generate Trend Report (RESEARCH-02)"}
              </Btn>
            </div>
            {loading && <Spinner accent={accent} />}
            <OutputBox content={output} accent={accent} />
            {output && (
              <Btn accent={accent} small secondary style={{ marginTop: 10 }} onClick={() => {
                const report = { id: Date.now(), content: output, findings: findings.filter(Boolean), date: new Date().toDateString() };
                update("trendReports", [report, ...state.trendReports]);
                addNotification("founder", `📊 Sati's weekly trend report is ready — check Research inbox.`);
                setOutput(""); setFindings(["", "", "", "", ""]);
                alert("Report submitted to Sheldon ✓");
              }}>Submit Report to Sheldon →</Btn>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            {/* RESEARCH-03 */}
            <SectionTitle accent={accent}>Monthly Seasonal Watch — RESEARCH-03</SectionTitle>
            <Alert accent={accent}>Run at the start of each month only. Gets the upcoming seasonal POD calendar for Sheldon to plan briefs.</Alert>
            <Select label="Current month" value={month} onChange={setMonth}
              options={["January","February","March","April","May","June","July","August","September","October","November","December"]} />
            <div style={{ marginTop: 10 }}>
              <Btn accent={accent} disabled={loading} onClick={() => run(`You are a seasonal POD trend strategist. The current month is ${month}.\n\nProvide a seasonal planning guide for print-on-demand sellers on Amazon Merch and Redbubble.\n\n1. TOP OCCASIONS THIS MONTH — list every gifting occasion and holiday in the next 6 weeks with exact dates\n2. DESIGN THEMES TO BRIEF NOW — what should designers be creating this week to be live in time?\n3. NICHES PEAKING THIS MONTH — which buyer groups are most active right now?\n4. NEXT MONTH PREVIEW — what to start preparing for\n5. ONE QUICK WIN — single niche + design angle you could launch within 7 days\n\nBe specific with dates and design directions.`)}>
                {loading ? "Generating…" : "Get Monthly Seasonal Guide (RESEARCH-03)"}
              </Btn>
            </div>
            {loading && <Spinner accent={accent} />}
            <OutputBox content={output} accent={accent} />
            {output && (
              <Btn accent={accent} small secondary style={{ marginTop: 10 }} onClick={() => {
                addNotification("founder", `📅 Monthly seasonal guide for ${month} is ready — check Sati's Research tab.`);
                alert("Sheldon notified ✓");
              }}>Notify Sheldon →</Btn>
            )}
          </div>
        </div>
      )}

      {/* ── REDBUBBLE TAB ── */}
      {activeTab === "redbubble" && (
        <div>

          {/* POD-01 */}
          <SectionTitle accent={accent}>Redbubble Listing Generator — POD-01</SectionTitle>
          <Alert accent={accent}>Use when Hayden hands off completed designs. Generates full titles, tags, and descriptions for Redbubble.</Alert>
          <Field label="Niche" value={rbNiche} onChange={setRbNiche} placeholder="e.g. Fishing enthusiasts" />
          <Field label="Designs — describe each one" value={rbDesigns} onChange={setRbDesigns} multiline
            placeholder={"1. 'Reel Life — Born to Fish' text-based humour\n2. 'Fish Fear Me' with fishing rod graphic\n3. 'Gone Fishing' vintage badge style"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Target buyer" value={rbBuyer} onChange={setRbBuyer} placeholder="e.g. Fishing hobbyists, gift for dad" />
            <Field label="Occasions" value={rbOcc} onChange={setRbOcc} placeholder="e.g. Birthday, Father's Day" />
          </div>
          <Btn accent={accent} disabled={loading || !rbNiche || !rbDesigns}
            onClick={() => run(`Write complete Redbubble listings for these print-on-demand designs.\n\nNiche: ${rbNiche}\nTarget buyer: ${rbBuyer}\nOccasions: ${rbOcc}\n\nDesigns:\n${rbDesigns}\n\nFor EACH design write:\n1. TITLE — natural, descriptive, under 80 characters, not keyword-stuffed\n2. TAGS — exactly 15 tags, comma separated, mix of broad and specific\n3. DESCRIPTION — 180–220 words, warm and conversational\n\nFor each description:\n- Open with a line that speaks directly to the buyer\n- Describe what makes this design enjoyable or meaningful\n- Mention who it's perfect for\n- Include 1–2 occasion references naturally\n- End with a warm invitation to browse\n\nDo NOT make these sound like they were written by a robot. Write like a person, not a catalogue.`)}>
            {loading ? "Generating…" : "Generate Redbubble Listings (POD-01)"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
          {output && (
            <Btn accent={accent} small secondary style={{ marginTop: 10 }} onClick={() => {
              addNotification("designer", "Redbubble listing copy ready — check your Brief tab.");
              setOutput("");
              alert("Hayden notified ✓");
            }}>Mark Done — Notify Hayden →</Btn>
          )}

          <div style={{ marginTop: 24 }}>
            {/* POD-02 */}
            <SectionTitle accent={accent}>Redbubble Listing Rewrite — POD-02</SectionTitle>
            <Alert accent={accent}>Use after 3 weeks with zero views. Diagnoses why the listing isn't performing and rewrites it.</Alert>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Current title" value={rwTitle} onChange={setRwTitle} placeholder="Paste current title" />
              <Field label="Niche" value={rwNiche} onChange={setRwNiche} placeholder="e.g. Fishing Dad" />
            </div>
            <Field label="Current tags" value={rwTags} onChange={setRwTags} placeholder="Paste current tags" />
            <Field label="Current description" value={rwDesc} onChange={setRwDesc} multiline placeholder="Paste current description" />
            <Field label="Design description" value={rwDesign} onChange={setRwDesign} placeholder="e.g. Text saying 'Reel Life' with small fish graphic, dark background" />
            <Btn accent={accent} disabled={loading || !rwTitle}
              onClick={() => run(`This Redbubble listing has been live for 3+ weeks and is getting zero views. Help me rewrite it to improve discoverability.\n\nCurrent title: ${rwTitle}\nCurrent tags: ${rwTags}\nCurrent description: ${rwDesc}\nDesign description: ${rwDesign}\nNiche: ${rwNiche}\n\nDiagnose:\n- Is the title too generic or too specific?\n- Are the tags missing obvious search terms?\n- Is the description engaging enough to convert?\n\nRewrite:\n1. New TITLE — different angle from the original\n2. New TAGS — 15 tags, prioritise what buyers actually search\n3. New DESCRIPTION — fresher, more personal tone\n\nEnd with one sentence explaining why the original likely underperformed.`)}>
              {loading ? "Rewriting…" : "Rewrite Listing (POD-02)"}
            </Btn>
            {loading && <Spinner accent={accent} />}
            <OutputBox content={output} accent={accent} />
          </div>

          <div style={{ marginTop: 24 }}>
            {/* POD-03 */}
            <SectionTitle accent={accent}>Customer Query Reply — POD-03</SectionTitle>
            <Alert accent={accent}>Use when a buyer messages on Redbubble. Keeps replies warm, human, and on-brand.</Alert>
            <Field label="Their message" value={custMsg} onChange={setCustMsg} multiline placeholder="Paste the customer's message here…" />
            <Field label="What they seem to want" value={custWant} onChange={setCustWant}
              placeholder="e.g. asking about sizing / complaint about shipping / asking if design comes on a mug" />
            <Btn accent={accent} disabled={loading || !custMsg}
              onClick={() => run(`Write a friendly, helpful reply to this customer message on Redbubble.\n\nTheir message: ${custMsg}\nWhat they seem to want: ${custWant}\n\nContext:\n- We are the designer, not the printer or shipper\n- Redbubble handles all fulfilment and customer service for orders\n- We genuinely care about our buyers\n\nIf it is a shipping or order issue: sympathise briefly, direct to Redbubble support at redbubble.com/help, wish them a resolution.\nIf it is a design question: answer warmly and helpfully.\n\nKeep the reply under 5 sentences. Warm, human, not corporate.`)}>
              {loading ? "Writing…" : "Write Customer Reply (POD-03)"}
            </Btn>
            {loading && <Spinner accent={accent} />}
            <OutputBox content={output} accent={accent} />
          </div>
        </div>
      )}

      {/* ── MERCH UPLOAD TAB ── */}
      {activeTab === "merch" && (
        <div>
          <SectionTitle accent={accent}>Amazon Merch — Pending Uploads</SectionTitle>
          <Alert accent={accent}>
            Sheldon generates listing copy in his dashboard. It appears here for your compliance check before you upload to Merch on Demand.
          </Alert>
          {state.listingCopies.filter(l => l.status === "pending_upload").length === 0
            ? <Alert accent={accent}>No listing copy waiting. Sheldon generates copy in his Merch Listing tab — check back after he sends it.</Alert>
            : state.listingCopies.filter(l => l.status === "pending_upload").map((l) => (
              <Card key={l.id} accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{l.niche}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{l.designText} · {l.date}</div>
                  </div>
                  <Badge label="READY TO UPLOAD" color={accent.main} />
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#374151", lineHeight: 1.75, whiteSpace: "pre-wrap", background: "#f9f7f4", borderRadius: 8, padding: "10px 12px", marginBottom: 10, maxHeight: 300, overflowY: "auto" }}>
                  {l.content}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => navigator.clipboard.writeText(l.content)}
                    style={{ background: accent.light, border: `1.5px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Copy All →
                  </button>
                  <button onClick={() => {
                    const updated = state.listingCopies.map(x => x.id === l.id ? { ...x, status: "uploaded" } : x);
                    update("listingCopies", updated);
                  }} style={{ background: "#f0fdf4", border: "1.5px solid #86efac", color: "#166534", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Mark Uploaded ✓
                  </button>
                </div>
              </Card>
            ))}

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>Compliance Check</SectionTitle>
          <Alert accent={accent}>Always paste and check before uploading. Flags policy violations before they become rejections.</Alert>
          <Field label="Listing to check (paste title + bullets + description)" value={compListing} onChange={setCompListing} multiline
            placeholder="Paste the full listing copy here — title, bullet points, and description…" />
          <Btn accent={accent} disabled={loading || !compListing}
            onClick={() => run(`Review this Amazon Merch on Demand listing for content policy compliance.\n\nListing:\n${compListing}\n\nCheck for: restricted phrases, competitor names, health claims, political content, trademark risks, price mentions, URLs, ALL CAPS violations, keyword stuffing, sensational language.\n\nFor each element give: PASS or FAIL with a one-line reason.\nFinal verdict: SAFE TO UPLOAD or NEEDS FIXING.\nIf NEEDS FIXING: provide the corrected version ready to paste.`)}>
            {loading ? "Checking…" : "Compliance Check →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>Rejection Reports</SectionTitle>
          {state.rejectionReports.length === 0
            ? <Alert accent={accent}>No rejection reports from Hayden yet.</Alert>
            : state.rejectionReports.map((r) => (
              <Card key={r.id} accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{r.design}</div>
                  <Badge label={r.status.toUpperCase()} color={r.status === "new" ? "#b5451b" : "#6b7280"} />
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{r.message}</div>
              </Card>
            ))}
        </div>
      )}

      {/* ── CLIENTS TAB ── */}
      {activeTab === "clients" && (
        <div>
          <SectionTitle accent={accent}>List Peak — Client Pipeline</SectionTitle>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{state.clients.length} client{state.clients.length !== 1 ? "s" : ""}</span>
            <Btn accent={accent} small onClick={() => setShowAddClient(!showAddClient)}>+ Add Client</Btn>
          </div>

          {showAddClient && (
            <Card accent={accent}>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent.main, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>New Client</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Client name" value={newClient.name} onChange={v => setNewClient(p => ({ ...p, name: v }))} placeholder="First name" small />
                <Field label="Service" value={newClient.service} onChange={v => setNewClient(p => ({ ...p, service: v }))} placeholder="e.g. Niche Research Report" small />
                <Field label="Niche" value={newClient.niche} onChange={v => setNewClient(p => ({ ...p, niche: v }))} placeholder="e.g. Kitchen gadgets" small />
                <Field label="Invoice (USD)" value={newClient.invoice} onChange={v => setNewClient(p => ({ ...p, invoice: v }))} placeholder="e.g. 97" small />
              </div>
              <div style={{ marginTop: 10 }}>
                <Btn accent={accent} small onClick={() => {
                  update("clients", [{ ...newClient, id: Date.now(), status: "New", paid: false, date: new Date().toDateString() }, ...state.clients]);
                  setNewClient({ name: "", service: "", niche: "", invoice: "" });
                  setShowAddClient(false);
                }}>Save Client</Btn>
              </div>
            </Card>
          )}

          {state.clients.length === 0
            ? <Alert accent={accent}>No clients yet. Add your first List Peak client above.</Alert>
            : state.clients.map((c, i) => (
              <Card key={c.id} accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 3 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{c.service} · {c.niche}</div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <Badge label={c.status} color={c.status === "Paid" ? "#2d6a4f" : c.status === "New" ? "#b5451b" : "#6b7280"} />
                      <Badge label={c.paid ? "PAID" : `$${c.invoice} DUE`} color={c.paid ? "#2d6a4f" : "#b5451b"} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexDirection: "column", alignItems: "flex-end" }}>
                    <select value={c.status} onChange={e => { const updated = [...state.clients]; updated[i] = { ...c, status: e.target.value }; update("clients", updated); }}
                      style={{ background: "#fff", border: "1.5px solid #d9d4cc", borderRadius: 8, padding: "5px 9px", color: "#374151", fontSize: 12 }}>
                      {["New", "In Progress", "Report Sent", "Paid"].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)}
                      style={{ background: accent.light, border: `1.5px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Email {selectedClient?.id === c.id ? "▲" : "▼"}
                    </button>
                  </div>
                </div>
                {selectedClient?.id === c.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${accent.mid}` }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {[["acknowledge","Acknowledge"],["deliver","Send Report"],["followup","Follow Up"],["testimonial","Testimonial"],["invoice","Invoice"],["chase","Chase Payment"]].map(([type, label]) => (
                        <button key={type} onClick={() => setEmailType(type)}
                          style={{ background: emailType === type ? accent.main : accent.light, color: emailType === type ? "#fff" : accent.text, border: `1.5px solid ${emailType === type ? accent.main : accent.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <Btn accent={accent} small disabled={loading} onClick={() => run(EMAIL_PROMPTS[emailType](c))}>
                      {loading ? "Writing…" : "Generate Email →"}
                    </Btn>
                    {loading && <Spinner accent={accent} />}
                    <OutputBox content={output} accent={accent} />
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}

      {/* ── CHECKLIST TAB ── */}
      {activeTab === "checklist" && (
        <div>
          <SectionTitle accent={accent}>Weekly Checklist — Sati</SectionTitle>
          <Checklist accent={accent} items={[
            "Browse Facebook, Instagram, TikTok, Pinterest — minimum 3 sessions",
            "Capture any trends spotted using Quick Trend Capture (RESEARCH-01)",
            "Submit Sunday trend report to Sheldon via Research tab (RESEARCH-02)",
            "Run Monthly Seasonal Watch on the first week of each month (RESEARCH-03)",
            "Write Redbubble listings for Hayden's completed design handoffs (POD-01)",
            "Check Redbubble customer messages — reply within 24 hours (POD-03)",
            "Check for new Merch listing copy from Sheldon — compliance check then upload",
            "Acknowledge new List Peak enquiries within 24 hours",
            "Send completed List Peak reports + invoices when Sheldon confirms ready",
            "Update payment status for any Wise receipts received",
          ]} />
          <div style={{ marginTop: 20 }}>
            <PipelineBoard state={state} update={update} addNotification={addNotification} accent={accent} userRole="operations" />
          </div>
          <div style={{ marginTop: 20 }}>
            <DetergentFund state={state} update={update} editable={false} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// GENERATOR LAUNCHER TILE
// ============================================================
const GeneratorTile = ({ title, description, icon, tag, onLaunch, accent }) => (
  <Card accent={accent} style={{ marginBottom: 0, cursor: "default" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 44, height: 44, background: accent.light, border: `1.5px solid ${accent.border}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111" }}>{title}</div>
          <Badge label={tag} color={accent.main} />
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>{description}</div>
        <Btn accent={accent} small onClick={onLaunch}>Open Tool →</Btn>
      </div>
    </div>
  </Card>
);

// ============================================================
// DESIGNER DASHBOARD  (Hayden)
// ============================================================
const DesignerDashboard = ({ state, update, addNotification }) => {
  const accent = ACCENT.designer;
  const [activeTab, setActiveTab] = useState("brief");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const [mjNiche, setMjNiche] = useState("");
  const [mjStyle, setMjStyle] = useState("Vintage");
  const [mjMood, setMjMood] = useState("Humorous");
  const [mjText, setMjText] = useState("");

  const [kittlNiche, setKittlNiche] = useState("");
  const [kittlOccasion, setKittlOccasion] = useState("");

  const [handoffNiche, setHandoffNiche] = useState("");
  const [handoffDesigns, setHandoffDesigns] = useState([{ name: "", description: "", designText: "", style: "Text-based" }]);

  const [uploadEntry, setUploadEntry] = useState({ design: "", niche: "", platform: "Both", status: "Pending Review" });

  const run = async (prompt) => { setLoading(true); setOutput(""); await callClaude(prompt, setOutput); setLoading(false); };

  const addHandoffDesign = () => setHandoffDesigns(p => [...p, { name: "", description: "", designText: "", style: "Text-based" }]);

  const GENERATOR_TOOLS = [
    {
      id: "tshirt",
      title: "Bulk T-Shirt Design Generator",
      description: "Create dozens of T-shirt designs from one reusable text template + a list of niche values. Supports Google Fonts, colour palettes, layout modes. Downloads print-ready PNGs in a ZIP.",
      icon: "👕",
      tag: "TEMPLATE → BULK",
    },
    {
      id: "slogan",
      title: "Bulk Slogan + Graphic Generator",
      description: "Upload one illustration, enter a list of slogans — get a print-ready PNG for each combination. Supports arched text, vintage layouts, circle badges, and SVG curved text.",
      icon: "🎨",
      tag: "GRAPHIC + TEXT",
    },
    {
      id: "pattern",
      title: "Pattern-Fill Text Generator",
      description: "Letters filled with pattern (camo, leopard, buffalo plaid, custom). Pick from 10 preset patterns or upload your own. SVG-native rendering for clean edges at full print resolution.",
      icon: "🦓",
      tag: "PATTERN FILL",
    },
  ];

  const openGenerator = (id) => {
    const files = {
      tshirt: "bulk_t-shirt_design_generator",
      slogan: "bulk_slogan___graphic_design_generator",
      pattern: "Pattern-Fill_Text_Design_Generator",
    };
    window.open(`/tools/${files[id]}.html`, "_blank");
  };

  const tabs = [
    { id: "brief", label: "Brief" },
    { id: "tools", label: "AI Tools" },
    { id: "generators", label: "Design Generators" },
    { id: "handoff", label: "Handoff" },
    { id: "uploads", label: "Upload Log" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div>
      <TabBar tabs={tabs} active={activeTab} onChange={(id) => { setActiveTab(id); setOutput(""); }} accent={accent} />

      {activeTab === "brief" && (
        <div>
          <SectionTitle accent={accent}>This Week's Design Brief</SectionTitle>
          {state.nicheBriefs.length === 0
            ? <Alert accent={accent}>No brief yet this week. Dad sends it every Monday. Check back Monday afternoon if nothing's here.</Alert>
            : (
              <Card accent={accent}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Badge label="BRIEF READY" color={accent.main} />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{state.nicheBriefs[0].week}</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {state.nicheBriefs[0].content}
                </div>
              </Card>
            )}

          {state.listingCopies.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionTitle accent={accent}>Listing Copy from Dad</SectionTitle>
              {state.listingCopies.filter(l => l.status === "pending_upload").map((l, i) => (
                <Card key={i} accent={accent}>
                  <Badge label="READY TO UPLOAD" color={accent.main} />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#374151", marginTop: 10, lineHeight: 1.75, whiteSpace: "pre-wrap", background: "#f9f7f4", borderRadius: 8, padding: "10px 12px" }}>{l.content}</div>
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => navigator.clipboard.writeText(l.content)}
                      style={{ background: accent.light, border: `1.5px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Copy All →
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle accent={accent} style={{ marginTop: 20 }}>File Spec Reference</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { title: "Amazon Merch", specs: [["Format", "PNG"], ["Size", "4500 × 5400 px"], ["Colour", "RGB"], ["DPI", "300"], ["Max file", "25 MB"]] },
              { title: "Redbubble", specs: [["Format", "PNG"], ["Size", "Up to 8000 px"], ["Colour", "RGB / sRGB"], ["Notes", "Max long side"]] },
            ].map(p => (
              <Card key={p.title} accent={accent} style={{ padding: 14, marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: accent.main, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>{p.title}</div>
                {p.specs.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid #f0ece6" }}>
                    <span style={{ color: "#6b7280" }}>{k}</span>
                    <span style={{ color: "#111", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{v}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
          <Alert accent={accent} style={{ marginTop: 12 }}>⚠️ Never white text on a white shirt — check contrast on every design before uploading.</Alert>
        </div>
      )}

      {activeTab === "tools" && (
        <div>
          <SectionTitle accent={accent}>Midjourney Prompt Generator</SectionTitle>
          <Field label="Niche (from brief)" value={mjNiche} onChange={setMjNiche} placeholder="e.g. Fishing Dad" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <Select label="Design style" value={mjStyle} onChange={setMjStyle} options={["Vintage", "Minimalist", "Retro", "Line art", "Geometric", "Watercolour"]} />
            <Select label="Mood" value={mjMood} onChange={setMjMood} options={["Humorous", "Proud", "Nostalgic", "Bold", "Peaceful", "Adventurous"]} />
          </div>
          <Field label="Specific text to include (optional)" value={mjText} onChange={setMjText} placeholder="e.g. 'Reel Life'" />
          <Btn accent={accent} disabled={loading || !mjNiche} onClick={() => run(`Write 5 Midjourney prompts for print-on-demand T-shirt designs in the ${mjNiche} niche. Style: ${mjStyle}. Mood: ${mjMood}. ${mjText ? `Include this text: "${mjText}"` : ""}\n\nEach prompt should produce a design suitable for merch — clean edges, transparent-background-ready, no photorealistic faces. Include: composition, colour palette, artistic style. Format each as a numbered, ready-to-paste Midjourney prompt starting with /imagine prompt:`)}>
            {loading ? "Generating…" : "Generate 5 Midjourney Prompts →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />

          <SectionTitle accent={accent} style={{ marginTop: 24 }}>Kittl Text Concept Generator</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Niche (from brief)" value={kittlNiche} onChange={setKittlNiche} placeholder="e.g. Fishing Dad" />
            <Field label="Occasions / buyer types (optional)" value={kittlOccasion} onChange={setKittlOccasion} placeholder="e.g. Father's Day, self-purchase" />
          </div>
          <Btn accent={accent} disabled={loading || !kittlNiche} onClick={() => run(`Write 8 text-based print-on-demand design concepts for the ${kittlNiche} niche. ${kittlOccasion ? `Occasions/buyers: ${kittlOccasion}.` : ""}\n\nFor each concept:\n1. Exact wording (main text + any sub-text)\n2. Kittl font style recommendation\n3. Colour palette (3 colours with hex codes)\n4. Layout suggestion (stacked / arched / centred / left-aligned)\n5. Best product type\n\nFormat as 8 clearly numbered concepts.`)}>
            {loading ? "Generating…" : "Generate 8 Kittl Text Concepts →"}
          </Btn>
          {loading && <Spinner accent={accent} />}
          <OutputBox content={output} accent={accent} />
        </div>
      )}

      {activeTab === "generators" && (
        <div>
          <SectionTitle accent={accent}>Design Generators — Etsy Suite</SectionTitle>
          <Alert accent={accent}>
            Each tool opens as a full standalone app in a new browser tab — no limitations, full export, print-ready PNGs with ZIP download.
          </Alert>
          <div style={{ display: "grid", gap: 14 }}>
            {GENERATOR_TOOLS.map(tool => (
              <GeneratorTile
                key={tool.id}
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                tag={tool.tag}
                accent={accent}
                onLaunch={() => openGenerator(tool.id)}
              />
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <SectionTitle accent={accent}>Tool Capabilities at a Glance</SectionTitle>
            <Card accent={accent} style={{ padding: "0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: accent.light }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", color: accent.text, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em" }}>Feature</th>
                    <th style={{ textAlign: "center", padding: "10px 10px", color: accent.text, fontWeight: 700, fontSize: 11 }}>👕 T-Shirt</th>
                    <th style={{ textAlign: "center", padding: "10px 10px", color: accent.text, fontWeight: 700, fontSize: 11 }}>🎨 Slogan+Graphic</th>
                    <th style={{ textAlign: "center", padding: "10px 10px", color: accent.text, fontWeight: 700, fontSize: 11 }}>🦓 Pattern Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Template + bulk values", "✓", "—", "—"],
                    ["Upload illustration / pattern", "—", "✓", "✓"],
                    ["Curved / arched text", "—", "✓", "✓"],
                    ["Preset pattern library", "—", "—", "✓"],
                    ["Google Fonts selector", "✓", "✓", "✓"],
                    ["Download PNG (4500×5400)", "✓", "✓", "✓"],
                    ["Bulk ZIP download", "✓", "✓", "✓"],
                    ["Shirt preview (B/W/Transparent)", "✓", "✓", "✓"],
                  ].map(([feat, ...vals], ri) => (
                    <tr key={ri} style={{ borderTop: "1px solid #f0ece6", background: ri % 2 === 0 ? "#fff" : "#faf8f5" }}>
                      <td style={{ padding: "9px 14px", color: "#374151" }}>{feat}</td>
                      {vals.map((v, ci) => (
                        <td key={ci} style={{ textAlign: "center", padding: "9px 10px", color: v === "✓" ? accent.main : "#d1d5db", fontWeight: v === "✓" ? 700 : 400 }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "handoff" && (
        <div>
          <SectionTitle accent={accent}>Design Handoff Form</SectionTitle>
          <Alert accent={accent}>Submit after completing designs. Mum gets notified for Redbubble listings. Dad gets notified for Merch listing copy.</Alert>
          <Field label="Niche" value={handoffNiche} onChange={setHandoffNiche} placeholder="e.g. Fishing Dad" />
          {handoffDesigns.map((d, i) => (
            <Card key={i} accent={accent}>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent.main, marginBottom: 10 }}>Design {i + 1}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Design name" value={d.name} onChange={v => { const n = [...handoffDesigns]; n[i] = { ...d, name: v }; setHandoffDesigns(n); }} placeholder="e.g. Reel Life Text Design" small />
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Style</div>
                  <select value={d.style} onChange={e => { const n = [...handoffDesigns]; n[i] = { ...d, style: e.target.value }; setHandoffDesigns(n); }}
                    style={{ width: "100%", background: "#fff", border: "1.5px solid #d9d4cc", borderRadius: 9, padding: "8px 12px", color: "#111", fontSize: 13 }}>
                    {["Text-based", "Typographic", "Illustration", "Vintage", "Minimalist", "Maximalist"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <Field label="Description / notes" value={d.description} onChange={v => { const n = [...handoffDesigns]; n[i] = { ...d, description: v }; setHandoffDesigns(n); }} placeholder="Brief description for Mum and Dad" small />
              <Field label="Design text (exact wording)" value={d.designText} onChange={v => { const n = [...handoffDesigns]; n[i] = { ...d, designText: v }; setHandoffDesigns(n); }} placeholder="e.g. REEL LIFE — BORN TO FISH" small />
            </Card>
          ))}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn accent={accent} small secondary onClick={addHandoffDesign}>+ Add Design</Btn>
          </div>
          <Btn accent={accent} disabled={!handoffNiche || !handoffDesigns[0].name} onClick={() => {
            const handoff = {
              id: Date.now(), niche: handoffNiche, designs: handoffDesigns,
              rb_status: "pending_rb_listings", merch_status: "pending_merch_listings",
              date: new Date().toDateString(),
            };
            update("designHandoffs", [handoff, ...state.designHandoffs]);
            addNotification("operations", `${handoffDesigns.filter(d => d.name).length} design(s) handed off by Hayden — Redbubble listings needed (${handoffNiche})`);
            addNotification("founder", `${handoffDesigns.filter(d => d.name).length} design(s) completed by Hayden — Merch listing copy needed (${handoffNiche})`);
            setHandoffNiche("");
            setHandoffDesigns([{ name: "", description: "", designText: "", style: "Text-based" }]);
            alert("Handed off! Mum and Dad notified ✓");
          }}>
            Submit Handoff →
          </Btn>
        </div>
      )}

      {activeTab === "uploads" && (
        <div>
          <SectionTitle accent={accent}>Upload Log</SectionTitle>
          <Alert accent={accent}>Log every upload here. If a design is rejected, log it as Rejected — never try to fix the copy yourself.</Alert>
          <Card accent={accent}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent.main, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Log New Upload</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Field label="Design name" value={uploadEntry.design} onChange={v => setUploadEntry(p => ({ ...p, design: v }))} placeholder="e.g. Reel Life Text Design" small />
              <Field label="Niche" value={uploadEntry.niche} onChange={v => setUploadEntry(p => ({ ...p, niche: v }))} placeholder="e.g. Fishing Dad" small />
              <Select label="Platform" value={uploadEntry.platform} onChange={v => setUploadEntry(p => ({ ...p, platform: v }))} options={["Both", "Merch", "Redbubble"]} />
              <Select label="Status" value={uploadEntry.status} onChange={v => setUploadEntry(p => ({ ...p, status: v }))} options={["Pending Review", "Live", "Rejected"]} />
            </div>
            <Btn accent={accent} small disabled={!uploadEntry.design} onClick={() => {
              update("uploadLog", [{ ...uploadEntry, id: Date.now(), date: new Date().toDateString() }, ...state.uploadLog]);
              if (uploadEntry.status === "Rejected") {
                addNotification("founder", `Rejection reported by Hayden — ${uploadEntry.design} (${uploadEntry.niche})`);
                update("rejectionReports", [{ id: Date.now(), design: uploadEntry.design, message: "Pending — Hayden to provide rejection message", status: "new" }, ...state.rejectionReports]);
              }
              setUploadEntry({ design: "", niche: "", platform: "Both", status: "Pending Review" });
            }}>Log Upload</Btn>
          </Card>

          {state.uploadLog.length > 0 && (
            <div>
              <SectionTitle accent={accent}>Upload History</SectionTitle>
              {state.uploadLog.map((u) => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #ede8e0" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111" }}>{u.design}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{u.niche} · {u.platform} · {u.date}</div>
                  </div>
                  <Badge label={u.status} color={u.status === "Live" ? "#2d6a4f" : u.status === "Rejected" ? "#b5451b" : "#9ca3af"} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "checklist" && (
        <div>
          <SectionTitle accent={accent}>Weekly Production Checklist — Hayden</SectionTitle>
          <Checklist accent={accent} items={[
            "Read and acknowledge this week's brief from Dad (Monday)",
            "Create 5 designs for niche 1 — export PNG at full resolution (Tuesday)",
            "Create 5 designs for niche 2 — export PNG at full resolution (Wednesday)",
            "Submit design handoffs to Mum and Dad via the Handoff tab",
            "Upload niche 1 to both platforms using Dad's + Mum's copy (Thursday)",
            "Upload niche 2 to both platforms + report Redbubble views to Dad (Friday)",
          ]} />

          <div style={{ marginTop: 20 }}>
            <HaydenStats state={state} accent={accent} />
          </div>

          <div style={{ marginTop: 16 }}>
            <DetergentFund state={state} update={update} editable={false} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================================
// WEEKLY SCOREBOARD — role-specific metrics bar
// ============================================================
const WeeklyScoreboard = ({ state, role, accent }) => {
  const thisWeek = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    return startOfWeek.toISOString();
  };
  const weekStart = thisWeek();

  const metrics = {
    founder: [
      { label: "Briefs Sent", value: (state.nicheBriefs||[]).filter(b => b.created_at >= weekStart).length, target: 2, icon: "📋" },
      { label: "Niches Validated", value: (state.trendReports||[]).filter(r => r.created_at >= weekStart).length, target: 4, icon: "🔍" },
      { label: "Listings Generated", value: (state.listingCopies||[]).filter(l => l.created_at >= weekStart).length, target: 10, icon: "📝" },
      { label: "Active Clients", value: (state.clients||[]).filter(c => c.status !== "Paid").length, target: 5, icon: "💼" },
      { label: "Pipeline Items", value: (state.pipeline||[]).length, target: 20, icon: "🚀" },
    ],
    operations: [
      { label: "Trends Captured", value: (state.urgentTrends||[]).filter(t => t.created_at >= weekStart).length, target: 5, icon: "🔥" },
      { label: "Reports Submitted", value: (state.trendReports||[]).filter(r => r.created_at >= weekStart).length, target: 1, icon: "📊" },
      { label: "Listings Uploaded", value: (state.listingCopies||[]).filter(l => l.status === "uploaded" && l.created_at >= weekStart).length, target: 10, icon: "⬆️" },
      { label: "RB Listings Written", value: (state.designHandoffs||[]).filter(h => h.rb_status === "completed" && h.created_at >= weekStart).length, target: 5, icon: "✍️" },
    ],
    designer: [
      { label: "Designs Created", value: (state.uploadLog||[]).filter(u => u.created_at >= weekStart).length, target: 10, icon: "🎨" },
      { label: "Live Designs", value: (state.uploadLog||[]).filter(u => u.status === "Live").length, target: 50, icon: "✅" },
      { label: "Handoffs Submitted", value: (state.designHandoffs||[]).filter(h => h.created_at >= weekStart).length, target: 2, icon: "🤝" },
      { label: "Rejections", value: (state.rejectionReports||[]).filter(r => r.created_at >= weekStart).length, target: 0, icon: "⚠️", inverse: true },
    ],
  };

  const items = metrics[role] || [];
  const weekTotal = items.filter(m => !m.inverse).reduce((sum, m) => sum + m.value, 0);

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${accent.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: accent.main, letterSpacing: "0.08em", textTransform: "uppercase" }}>This Week</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Week of {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12 }}>
        {items.map((m, i) => {
          const pct = m.target > 0 ? Math.min(100, Math.round((m.value / m.target) * 100)) : 0;
          const isGood = m.inverse ? m.value === 0 : m.value >= m.target;
          const barColor = m.inverse && m.value > 0 ? "#ef4444" : isGood ? accent.main : accent.muted;
          return (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.inverse && m.value > 0 ? "#ef4444" : accent.main, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6, marginTop: 2, fontWeight: 500 }}>/ {m.target}</div>
              <div style={{ height: 4, background: "#f0ece6", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, fontWeight: 600, letterSpacing: "0.02em" }}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// OPPORTUNITY PIPELINE
// ============================================================
const PIPELINE_STAGES = ["Captured", "Validated", "Designed", "Listed", "Live", "Sold"];

const PipelineBoard = ({ state, update, addNotification, accent, userRole }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ niche: "", design_angle: "", notes: "", stage: "Captured" });
  const [loading, setLoading] = useState(false);

  const pipeline = state.pipeline || [];

  const moveStage = async (item, direction) => {
    const idx = PIPELINE_STAGES.indexOf(item.stage);
    const newStage = PIPELINE_STAGES[idx + direction];
    if (!newStage) return;
    await update("pipeline", [
      { ...item, stage: newStage },
      ...pipeline.filter(p => p.id !== item.id),
    ]);
    if (newStage === "Live") addNotification("founder", `🚀 "${item.niche}" is now LIVE on the platform!`);
    if (newStage === "Sold") addNotification("founder", `💰 First sale recorded for "${item.niche}"!`);
  };

  const addItem = async () => {
    if (!newItem.niche) return;
    setLoading(true);
    await update("pipeline", [{ ...newItem, id: Date.now(), date: new Date().toDateString() }, ...pipeline]);
    setNewItem({ niche: "", design_angle: "", notes: "", stage: "Captured" });
    setShowAdd(false);
    setLoading(false);
  };

  const stageColors = {
    "Captured":  "#6b7280",
    "Validated": "#b5451b",
    "Designed":  "#5c5edc",
    "Listed":    "#d97706",
    "Live":      "#059669",
    "Sold":      "#2d6a4f",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <SectionTitle accent={accent} style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Opportunity Pipeline</SectionTitle>
        {userRole === "founder" && (
          <Btn accent={accent} small onClick={() => setShowAdd(!showAdd)}>+ Add Niche</Btn>
        )}
      </div>

      {showAdd && (
        <Card accent={accent}>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent.main, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>New Pipeline Entry</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Niche" value={newItem.niche} onChange={v => setNewItem(p => ({...p, niche: v}))} placeholder="e.g. Fishing Dad" small />
            <Field label="Design angle" value={newItem.design_angle} onChange={v => setNewItem(p => ({...p, design_angle: v}))} placeholder="e.g. Humour + text-based" small />
          </div>
          <Field label="Notes" value={newItem.notes} onChange={v => setNewItem(p => ({...p, notes: v}))} placeholder="Any context for the team…" small />
          <Btn accent={accent} small disabled={!newItem.niche || loading} onClick={addItem}>Add to Pipeline</Btn>
        </Card>
      )}

      {/* Stage columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
        {PIPELINE_STAGES.map(stage => {
          const items = pipeline.filter(p => p.stage === stage);
          return (
            <div key={stage} style={{ background: "#f9f7f4", border: "1.5px solid #e5e0d8", borderRadius: 10, padding: "10px 8px", minHeight: 80 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: stageColors[stage], letterSpacing: "0.06em", textTransform: "uppercase" }}>{stage}</div>
                <span style={{ background: stageColors[stage]+"20", color: stageColors[stage], borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{items.length}</span>
              </div>
              {items.map(item => (
                <div key={item.id} style={{ background: "#fff", border: "1.5px solid #e5e0d8", borderRadius: 8, padding: "8px 8px", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 2, lineHeight: 1.3 }}>{item.niche}</div>
                  {item.design_angle && <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6, lineHeight: 1.3 }}>{item.design_angle}</div>}
                  {userRole === "founder" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {PIPELINE_STAGES.indexOf(item.stage) > 0 && (
                        <button onClick={() => moveStage(item, -1)} style={{ background: "#f0ece6", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", color: "#6b7280" }}>←</button>
                      )}
                      {PIPELINE_STAGES.indexOf(item.stage) < PIPELINE_STAGES.length - 1 && (
                        <button onClick={() => moveStage(item, 1)} style={{ background: accent.light, border: `1px solid ${accent.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", color: accent.text, fontWeight: 700 }}>→</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && <div style={{ fontSize: 10, color: "#c4bdb4", textAlign: "center", paddingTop: 8 }}>Empty</div>}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PIPELINE_STAGES.map(stage => {
          const count = pipeline.filter(p => p.stage === stage).length;
          return count > 0 ? (
            <div key={stage} style={{ background: stageColors[stage]+"15", border: `1.5px solid ${stageColors[stage]}40`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: stageColors[stage] }}>
              {count} {stage}
            </div>
          ) : null;
        })}
        {pipeline.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>No niches in pipeline yet. Add your first one above.</div>}
      </div>
    </div>
  );
};

// ============================================================
// SUNDAY FAMILY REVIEW
// ============================================================
const SundayReview = ({ state, accent }) => {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const thisWeek = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    return startOfWeek.toISOString();
  };
  const weekStart = thisWeek();

  const buildContext = () => {
    const briefs = (state.nicheBriefs||[]).filter(b => b.created_at >= weekStart).length;
    const trendsCapt = (state.urgentTrends||[]).filter(t => t.created_at >= weekStart).length;
    const designsCreated = (state.uploadLog||[]).filter(u => u.created_at >= weekStart).length;
    const liveDesigns = (state.uploadLog||[]).filter(u => u.status === "Live").length;
    const listingsGen = (state.listingCopies||[]).filter(l => l.created_at >= weekStart).length;
    const listingsUp = (state.listingCopies||[]).filter(l => l.status === "uploaded" && l.created_at >= weekStart).length;
    const handoffs = (state.designHandoffs||[]).filter(h => h.created_at >= weekStart).length;
    const rejections = (state.rejectionReports||[]).filter(r => r.created_at >= weekStart).length;
    const clients = (state.clients||[]).length;
    const pipelineLive = (state.pipeline||[]).filter(p => p.stage === "Live").length;
    const pipelineSold = (state.pipeline||[]).filter(p => p.stage === "Sold").length;

    return { briefs, trendsCapt, designsCreated, liveDesigns, listingsGen, listingsUp, handoffs, rejections, clients, pipelineLive, pipelineSold };
  };

  const generate = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContext();
    const prompt = `You are the operating system for a family print-on-demand business. Generate a Sunday Family Review based on this week's activity data.

WEEK OF: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}

THIS WEEK'S DATA:
- Briefs sent by Sheldon (Dad): ${ctx.briefs}
- Trends captured by Sati (Mum): ${ctx.trendsCapt}
- Designs created by Hayden (Son): ${ctx.designsCreated}
- Total live designs: ${ctx.liveDesigns}
- Listing copy generated: ${ctx.listingsGen}
- Listings uploaded to Merch: ${ctx.listingsUp}
- Design handoffs completed: ${ctx.handoffs}
- Rejections this week: ${ctx.rejections}
- Active clients (List Peak): ${ctx.clients}
- Niches live on platforms: ${ctx.pipelineLive}
- Niches with first sales: ${ctx.pipelineSold}

Write a warm, honest Sunday review in this exact format:

🏆 WINS THIS WEEK
[List 2-3 genuine wins based on the data. Be specific. If numbers are zero, acknowledge the effort to set up systems.]

⚠️ MISSES
[List 1-2 honest gaps. Be constructive, not harsh. If everything was great, note what the stretch goal for next week should be.]

🎯 TOP 3 FOR NEXT WEEK
[Three specific, achievable actions for the family — one per person where possible.]

💡 ONE THING TO REMEMBER
[One motivational sentence grounded in the reality of building a POD business from scratch in Trinidad. Keep it real, not generic.]

Keep the whole review under 250 words. Write like you're part of the family, not a consultant.`;

    await callClaude(prompt, setOutput);
    setLoading(false);
  };

  return (
    <Card accent={accent}>
      <SectionTitle accent={accent} style={{ marginBottom: 10 }}>Sunday Family Review</SectionTitle>
      <Alert accent={accent} style={{ marginBottom: 12 }}>
        Run every Sunday evening. Auto-reads this week's activity and generates a team summary — wins, misses, and next week's top 3.
      </Alert>
      <Btn accent={accent} disabled={loading} onClick={generate}>
        {loading ? "Generating review…" : "Generate This Week's Review →"}
      </Btn>
      {loading && <Spinner accent={accent} />}
      {output && (
        <div style={{ background: "#fff", border: `1.5px solid ${accent.border}`, borderRadius: 10, padding: "16px 18px", marginTop: 14, fontSize: 13.5, color: "#374151", lineHeight: 1.85, whiteSpace: "pre-wrap", animation: "fadeUp 0.2s" }}>
          {output}
          <button onClick={() => navigator.clipboard.writeText(output)}
            style={{ display: "block", marginTop: 12, background: accent.light, border: `1.5px solid ${accent.border}`, color: accent.text, borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
            Copy to share with family →
          </button>
        </div>
      )}
    </Card>
  );
};

// ============================================================
// HAYDEN DESIGN STATS
// ============================================================
const HaydenStats = ({ state, accent }) => {
  const uploads = state.uploadLog || [];
  const handoffs = state.designHandoffs || [];
  const live = uploads.filter(u => u.status === "Live").length;
  const total = uploads.length;
  const rejected = uploads.filter(u => u.status === "Rejected").length;
  const thisWeek = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d.toISOString(); })();
  const weekDesigns = uploads.filter(u => u.created_at >= thisWeek).length;
  const target500weeks = Math.ceil((500 - live) / 10);
  const acceptRate = total > 0 ? Math.round(((total - rejected) / total) * 100) : 100;

  return (
    <Card accent={accent}>
      <SectionTitle accent={accent} style={{ marginBottom: 14 }}>Your Design Stats</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Uploaded", value: total, icon: "📤", sub: "all time" },
          { label: "Live Designs", value: live, icon: "✅", sub: "on platforms" },
          { label: "This Week", value: weekDesigns, icon: "🗓️", sub: "of 10 target" },
          { label: "Acceptance Rate", value: `${acceptRate}%`, icon: "🎯", sub: `${rejected} rejected` },
        ].map((s, i) => (
          <div key={i} style={{ background: "#f9f7f4", border: "1.5px solid #e5e0d8", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: accent.main, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{s.sub}</div>
              </div>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginTop: 8, letterSpacing: "0.02em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress to 500 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Road to 500 Live Designs</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: accent.main }}>{live}/500</div>
        </div>
        <div style={{ height: 8, background: "#f0ece6", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${Math.min(100, (live/500)*100)}%`, background: `linear-gradient(90deg, ${accent.main}, ${accent.muted})`, borderRadius: 4, transition: "width 0.5s" }} />
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          {live < 500
            ? `${500 - live} designs to go · at 10/week that's ~${target500weeks} weeks`
            : "🎉 500 designs milestone reached — income inflection point!"}
        </div>
      </div>

      {/* Handoffs this week */}
      <div style={{ paddingTop: 12, borderTop: "1.5px solid #f0ece6" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>Recent Handoffs</div>
        {handoffs.slice(0, 3).length === 0
          ? <div style={{ fontSize: 13, color: "#9ca3af" }}>No handoffs yet — submit your first batch via the Handoff tab.</div>
          : handoffs.slice(0, 3).map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f0ece6" }}>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{h.niche}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <Badge label={`${Array.isArray(h.designs) ? h.designs.length : 1} designs`} color={accent.main} />
                <Badge label={h.merch_status === "pending_merch_listings" ? "Pending Merch" : "Done"} color={h.merch_status === "pending_merch_listings" ? "#d97706" : "#059669"} />
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
};

// ============================================================
// LOGIN SCREEN — Supabase Auth
// ============================================================
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError("Incorrect email or password. Try again."); setLoading(false); return; }
      const { data: profile, error: profError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).single();
      if (profError || !profile) { setError("Account found but no profile set up. Contact Sheldon."); setLoading(false); return; }
      onLogin({ ...profile, email: authData.user.email });
    } catch (e) {
      setError("Something went wrong. Check your connection.");
    }
    setLoading(false);
  };

  // Detect role from email for accent colour preview
  const getPreviewAccent = () => {
    if (email.includes("shsram") || email.includes("sheldon")) return ACCENT.founder;
    if (email.includes("satik") || email.includes("sati")) return ACCENT.operations;
    if (email.includes("hayden")) return ACCENT.designer;
    return { main: "#374151", light: "#f3f4f6", border: "#d1d5db", text: "#374151" };
  };
  const acc = getPreviewAccent();

  return (
    <div style={{ minHeight: "100vh", background: "#f4f0eb", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f0eb; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        input:focus { outline: none; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp 0.3s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, background: "#fff", border: "1.5px solid #e5e0d8", borderRadius: 14, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 24 }}>🖨️</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111", letterSpacing: "-0.5px" }}>POD Studio OS</div>
          <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 6 }}>Sign in to your dashboard</div>
        </div>

        {/* Login form */}
        <div style={{ background: "#fff", border: "1.5px solid #e5e0d8", borderRadius: 14, padding: "24px 22px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && document.getElementById("pwInput").focus()}
              placeholder="your@email.com"
              autoFocus
              style={{ width: "100%", background: "#f9f7f4", border: `1.5px solid ${error ? "#fca5a5" : "#d9d4cc"}`, borderRadius: 9, padding: "11px 14px", color: "#111", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
          <div style={{ marginBottom: error ? 10 : 18 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Password</div>
            <input
              id="pwInput"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              style={{ width: "100%", background: "#f9f7f4", border: `1.5px solid ${error ? "#fca5a5" : "#d9d4cc"}`, borderRadius: 9, padding: "11px 14px", color: "#111", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
          {error && <div style={{ color: "#b91c1c", fontSize: 12.5, marginBottom: 14, textAlign: "center" }}>{error}</div>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: "100%", background: loading ? "#9ca3af" : acc.main, color: "#fff", border: "none", borderRadius: 9, padding: "13px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s" }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: "#9ca3af", textAlign: "center", marginTop: 16, lineHeight: 1.7 }}>
          Use the email and password Sheldon set up for you.<br/>
          Contact Sheldon if you need a password reset.
        </div>
      </div>
    </div>
  );
};
// ============================================================
// MAIN APP — Supabase Auth + Data
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // On mount: check for existing session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        if (profile) setUser({ ...profile, email: session.user.email });
      }
      setAuthChecked(true);
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) { setUser(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const { state, update, addNotification, clearNotification, reload } = useSharedState(user?.role);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Loading state while checking session
  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "#f4f0eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🖨️</div>
          <div style={{ fontSize: 14, color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>Loading POD Studio OS…</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  // Data isn't loaded yet — show skeleton
  if (!state.loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#f4f0eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🖨️</div>
          <div style={{ fontSize: 14, color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>Loading your dashboard…</div>
        </div>
      </div>
    );
  }

  const accent = ACCENT[user.role];
  const notifications = state.notifications || [];
  const greeting = getGreeting();

  const roleLabel = {
    founder: "Strategy & Research",
    operations: "Research & Operations",
    designer: "Design & Production",
  };

  const roleSubtitle = {
    founder: "VALIDATE · BRIEF · ANALYSE",
    operations: "RESEARCH · LISTINGS · CLIENTS",
    designer: "DESIGN · CREATE · UPLOAD",
  };

  // Wrap update calls for each dashboard — translates old key-based API to table-based
  const dbUpdate = async (key, val) => {
    const tableMap = {
      nicheBriefs:      { table: "niche_briefs",      op: "insert" },
      trendReports:     { table: "trend_reports",     op: "insert" },
      urgentTrends:     { table: "urgent_trends",     op: "insert" },
      designHandoffs:   { table: "design_handoffs",   op: "insert" },
      listingCopies:    { table: "listing_copies",    op: "insert" },
      uploadLog:        { table: "upload_log",        op: "insert" },
      rejectionReports: { table: "rejection_reports", op: "insert" },
      clients:          { table: "clients",           op: "insert" },
      pipeline:         { table: "pipeline",          op: "insert" },
    };

    // Special case: detergentFund is an upsert to single row
    if (key === "detergentFund") {
      await update("detergent_fund", "upsert", { id: 1, amount: val.amount, goal: val.goal });
      return;
    }

    // For array updates — if val is an array and longer than current, it's an insert of the first item
    const mapping = tableMap[key];
    if (!mapping) { await reload(); return; }

    const currentArr = state[key] || [];
    if (Array.isArray(val) && val.length > currentArr.length) {
      // New item is at index 0 (prepended)
      const newItem = val[0];
      // Remove client-side id and date fields — Supabase generates these
      const { id: _id, date: _date, ...insertData } = newItem;
      // Add created_by
      const { data: { session } } = await supabase.auth.getSession();
      const withUser = session ? { ...insertData, created_by: session.user.id } : insertData;
      await update(mapping.table, "insert", withUser);
    } else if (Array.isArray(val)) {
      // It's an in-place update (e.g. status change) — find the changed item
      for (let i = 0; i < val.length; i++) {
        const curr = currentArr[i];
        const next = val[i];
        if (curr && next && JSON.stringify(curr) !== JSON.stringify(next)) {
          await update(mapping.table, "update", { id: curr.id, values: next });
          break;
        }
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f0eb", fontFamily: "'DM Sans', sans-serif" }}>
      <GlobalStyles accentMain={accent.main} />

      {/* ── HEADER ── */}
      <div style={{ background: "#fff", borderBottom: "1.5px solid #e5e0d8", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, height: 58 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, background: accent.light, border: `1.5px solid ${accent.border}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            🖨️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111", letterSpacing: "-0.2px" }}>POD Studio OS</div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{user.name} · {roleLabel[user.role]}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotifBell notifications={notifications} onClear={(id) => clearNotification(id)} accent={accent} />
          <button
            onClick={handleSignOut}
            style={{ background: "#f9f7f4", border: "1.5px solid #e5e0d8", color: "#6b7280", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px" }}>

        {/* Welcome banner */}
        <div style={{ background: "#fff", border: `1.5px solid ${accent.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${accent.main}` }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#111", letterSpacing: "-0.3px" }}>{greeting}, {user.name}.</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 3 }}>
              {roleLabel[user.role]} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: accent.muted, fontWeight: 700, letterSpacing: "0.1em", textAlign: "right", lineHeight: 2 }}>
            {roleSubtitle[user.role].split(" · ").map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        </div>

        {/* Weekly Scoreboard — shown to all roles */}
        <WeeklyScoreboard state={state} role={user.role} accent={accent} />

        {/* Dashboard content */}
        {user.role === ROLES.FOUNDER && (
          <FounderDashboard state={state} update={dbUpdate} addNotification={addNotification} clearNotification={clearNotification} />
        )}
        {user.role === ROLES.OPERATIONS && (
          <OperationsDashboard state={state} update={dbUpdate} addNotification={addNotification} clearNotification={clearNotification} />
        )}
        {user.role === ROLES.DESIGNER && (
          <DesignerDashboard state={state} update={dbUpdate} addNotification={addNotification} clearNotification={clearNotification} />
        )}
      </div>
    </div>
  );
}
