import React, { useState, useRef, useEffect } from "react";

const ROLES = { FOUNDER: "founder", OPERATIONS: "operations", DESIGNER: "designer" };

const USERS = [
  { id: 1, name: "Sheldon", role: "founder",    pin: "1234", tagline: "Strategy & Research" },
  { id: 2, name: "Sati",    role: "operations", pin: "5678", tagline: "Research & Operations" },
  { id: 3, name: "Hayden",  role: "designer",   pin: "9012", tagline: "Design & Production" },
];

const ACCENT = {
  founder:    { main: "#10d98a", dim: "rgba(16,217,138,0.1)",  border: "rgba(16,217,138,0.25)", text: "#6effc9" },
  operations: { main: "#f0a832", dim: "rgba(240,168,50,0.1)",  border: "rgba(240,168,50,0.25)",  text: "#ffd980" },
  designer:   { main: "#9b7ff4", dim: "rgba(155,127,244,0.1)", border: "rgba(155,127,244,0.25)", text: "#cdbfff" },
};

const BG = { bg0:"#080c14", bg1:"#0d1424", bg2:"#111827", border:"#1e2d47", text0:"#eef2ff", text1:"#94a3c8", text2:"#4a5878" };

function Login({ onLogin }) {
  const [sel, setSel] = React.useState(null);
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState("");

  const go = () => {
    if (!sel) return;
    if (sel.pin === pin) onLogin(sel);
    else { setErr("Incorrect PIN. Try again."); setPin(""); }
  };

  return (
    <div style={{ minHeight:"100vh", background:BG.bg0, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"system-ui, sans-serif" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:28, fontWeight:700, color:BG.text0, marginBottom:8 }}>POD Studio OS</div>
          <div style={{ fontSize:13, color:BG.text2 }}>List Peak · Internal Operations</div>
        </div>

        <div style={{ fontSize:11, color:BG.text2, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Select your profile</div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {USERS.map(u => {
            const acc = ACCENT[u.role];
            const active = sel && sel.id === u.id;
            return (
              <button key={u.id} onClick={() => { setSel(u); setErr(""); setPin(""); }}
                style={{ background: active ? acc.dim : BG.bg1, border:"1px solid " + (active ? acc.main : BG.border), borderRadius:14, padding:"16px 20px", cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:acc.dim, border:"1px solid "+acc.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {u.role === "founder" ? "⬡" : u.role === "operations" ? "◈" : "◎"}
                  </div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:600, color:BG.text0 }}>{u.name}</div>
                    <div style={{ fontSize:11, color:acc.text, marginTop:2 }}>{u.tagline}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {sel && (
          <div>
            <div style={{ fontSize:11, color:BG.text2, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>PIN for {sel.name}</div>
            <input type="password" value={pin} onChange={e => { setPin(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && go()} maxLength={4} placeholder="••••" autoFocus
              style={{ width:"100%", background:BG.bg1, border:"2px solid "+ACCENT[sel.role].border, borderRadius:12, padding:"14px 20px", color:BG.text0, fontSize:24, letterSpacing:10, textAlign:"center", fontFamily:"monospace", marginBottom:8, boxSizing:"border-box" }} />
            {err && <div style={{ color:"#ef4444", fontSize:12, textAlign:"center", marginBottom:8 }}>{err}</div>}
            <div style={{ fontSize:11, color:BG.text2, textAlign:"center", marginBottom:14 }}>Demo: Sheldon=1234 · Sati=5678 · Hayden=9012</div>
            <button onClick={go}
              style={{ width:"100%", background:ACCENT[sel.role].main, color:BG.bg0, border:"none", borderRadius:12, padding:"15px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
              Enter Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ user, onSignOut }) {
  const accent = ACCENT[user.role];
  return (
    <div style={{ minHeight:"100vh", background:BG.bg0, fontFamily:"system-ui, sans-serif" }}>
      <div style={{ borderBottom:"1px solid "+BG.border, padding:"14px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", background:BG.bg0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:accent.dim, border:"1px solid "+accent.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
            {user.role === "founder" ? "⬡" : user.role === "operations" ? "◈" : "◎"}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:BG.text0 }}>POD Studio OS</div>
            <div style={{ fontSize:10, color:BG.text2, letterSpacing:"0.06em" }}>{user.name.toUpperCase()} · {user.role.toUpperCase()}</div>
          </div>
        </div>
        <button onClick={onSignOut} style={{ background:"transparent", border:"1px solid "+BG.border, color:BG.text1, borderRadius:10, padding:"7px 16px", fontSize:12, cursor:"pointer" }}>Sign out</button>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"40px 24px", textAlign:"center" }}>
        <div style={{ background:accent.dim, border:"1px solid "+accent.border, borderRadius:16, padding:"40px 32px", display:"inline-block", minWidth:320 }}>
          <div style={{ fontSize:40, marginBottom:16 }}>{user.role === "founder" ? "⬡" : user.role === "operations" ? "◈" : "◎"}</div>
          <div style={{ fontSize:24, fontWeight:700, color:BG.text0, marginBottom:8 }}>Welcome, {user.name}!</div>
          <div style={{ fontSize:14, color:accent.text, marginBottom:24 }}>{user.tagline}</div>
          <div style={{ fontSize:13, color:BG.text1, lineHeight:1.6 }}>
            ✅ Login working<br/>
            ✅ Role detection working<br/>
            ✅ App deployed successfully<br/><br/>
            Full dashboard loading next...
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = React.useState(null);
  if (!user) return <Login onLogin={setUser} />;
  return <Dashboard user={user} onSignOut={() => setUser(null)} />;
}
