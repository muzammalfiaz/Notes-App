const { useState, useEffect, useRef } = React;

const SUPABASE_URL = "https://yhqfdeslngsarmhcetoa.supabase.co";
const SUPABASE_KEY = "sb_publishable_c2O9q1-ov-siNJ6H_RCyrQ_h_TXI6EL";

const api = async (path, method = "GET", body = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : ""
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
};

function encrypt(text, pass) {
  return btoa(unescape(encodeURIComponent(text + "||" + pass)));
}
function decrypt(cipher, pass) {
  try {
    const dec = decodeURIComponent(escape(atob(cipher)));
    const idx = dec.lastIndexOf("||");
    if (idx === -1) return null;
    if (dec.slice(idx + 2) === pass) return dec.slice(0, idx);
    return null;
  } catch { return null; }
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmt(ts) { return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

const s = {
  app: { minHeight: "100vh", background: "#0d0d0f", color: "#c9c5d0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" },
  logo: { fontSize: 22, fontWeight: 600, color: "#e0dae8", letterSpacing: "0.05em", textAlign: "center", marginBottom: "2rem" },
  tabs: { display: "flex", marginBottom: "1.5rem", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2530", background: "#131117" },
  tab: (a) => ({ flex: 1, padding: "10px 0", fontSize: 12, cursor: "pointer", border: "none", background: a ? "#2a2435" : "transparent", color: a ? "#c9a0f0" : "#6b6475", fontWeight: a ? 600 : 400, position: "relative" }),
  card: { background: "#131117", border: "1px solid #2a2530", borderRadius: 12, padding: "1.25rem" },
  label: { fontSize: 12, color: "#6b6475", marginBottom: 6, display: "block", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { width: "100%", background: "#0d0d0f", border: "1px solid #2a2530", borderRadius: 8, padding: "10px 12px", color: "#c9c5d0", fontSize: 14, outline: "none", marginBottom: "1rem" },
  textarea: { width: "100%", background: "#0d0d0f", border: "1px solid #2a2530", borderRadius: 8, padding: "10px 12px", color: "#c9c5d0", fontSize: 14, outline: "none", marginBottom: "1rem", resize: "vertical", minHeight: 100 },
  btn: { width: "100%", padding: "11px", background: "#2a1f3d", border: "1px solid #4a3470", borderRadius: 8, color: "#c9a0f0", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  error: { color: "#c06080", fontSize: 13, marginBottom: "0.75rem", padding: "8px 12px", background: "#1e1218", borderRadius: 6 },
  success: { color: "#80c0a0", fontSize: 13, marginBottom: "0.75rem", padding: "8px 12px", background: "#121e18", borderRadius: 6 },
  revealBox: { background: "#0d0d0f", border: "1px solid #2a2530", borderRadius: 8, padding: "1rem", marginTop: "1rem", whiteSpace: "pre-wrap", fontSize: 14, color: "#e0dae8", lineHeight: 1.6 },
  noteRow: { background: "#0d0d0f", border: "1px solid #2a2530", borderRadius: 8, padding: "12px", marginBottom: 10 },
  notifItem: (read) => ({ display: "flex", gap: 10, padding: "10px 12px", borderBottom: "1px solid #1a1820", background: read ? "transparent" : "#16121e" }),
  badgeCount: { position: "absolute", top: 5, right: 8, background: "#c9a0f0", color: "#0d0d0f", borderRadius: "50%", width: 15, height: 15, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }
};

function App() {
  const [tab, setTab] = useState("create");
  const [notes, setNotes] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [pass, setPass] = useState("");
  const [sd, setSd] = useState(false);
  const [created, setCreated] = useState(false);
  const [findPass, setFindPass] = useState("");
  const [revealed, setRevealed] = useState(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const pollRef = useRef(null);

  const unread = notifs.filter(n => !n.read).length;

  async function loadNotes() { try { setNotes(await api("notes?order=created_at.desc") || []); } catch {} }
  async function loadNotifs() { try { setNotifs(await api("notifications?order=time.desc") || []); } catch {} }

  useEffect(() => {
    loadNotes(); loadNotifs();
    pollRef.current = setInterval(loadNotifs, 8000);
    return () => clearInterval(pollRef.current);
  }, []);

  async function createNote() {
    if (!msg.trim()) return setErr("Write something first.");
    if (pass.length < 3) return setErr("Password must be at least 3 characters.");
    setErr(""); setLoading(true);
    try {
      await api("notes", "POST", { id: genId(), cipher: encrypt(msg.trim(), pass), self_destruct: sd, created_at: Date.now() });
      setCreated(true); setMsg(""); setPass(""); setSd(false);
      await loadNotes();
    } catch { setErr("Failed to save. Try again."); }
    setLoading(false);
  }

  async function revealNote() {
    setErr(""); setRevealed(null); setOk(""); setLoading(true);
    try {
      const all = await api("notes?order=created_at.desc");
      const note = (all || []).find(n => decrypt(n.cipher, findPass) !== null);
      if (!note) { setErr("Wrong password or no matching note."); setLoading(false); return; }
      const text = decrypt(note.cipher, findPass);
      await api("notes?id=eq." + note.id, "DELETE");
      await api("notifications", "POST", { note_id: note.id, time: Date.now(), read: false });
      if (note.self_destruct) setOk("This note self-destructed after reading.");
      setRevealed(text);
      await loadNotes();
    } catch { setErr("Something went wrong."); }
    setLoading(false);
  }

  async function markAllRead() {
    try { await api("notifications?read=eq.false", "PATCH", { read: true }); await loadNotifs(); } catch {}
  }

  async function deleteNote(id) {
    try { await api("notes?id=eq." + id, "DELETE"); await loadNotes(); } catch {}
  }

  return (
    <div style={s.app}>
      <div style={s.logo}>📝 NOTES</div>
      <div style={s.tabs}>
        {[["create","✏️ New"],["retrieve","🔓 Retrieve"],["vault","🗄️ Vault"],["notifs","🔔 Alerts"]].map(([t, label]) => (
          <button key={t} style={s.tab(tab===t)} onClick={async () => {
            setTab(t); setErr(""); setOk(""); setCreated(false); setRevealed(null);
            if (t === "vault") await loadNotes();
            if (t === "notifs") { await loadNotifs(); await markAllRead(); }
          }}>
            {label}
            {t === "notifs" && unread > 0 && <span style={s.badgeCount}>{unread}</span>}
          </button>
        ))}
      </div>

      {tab === "create" && (
        <div style={s.card}>
          {err && <div style={s.error}>{err}</div>}
          {created ? (
            <>
              <div style={s.success}>✅ Note saved! Share your password with the recipient.</div>
              <button style={s.btn} onClick={() => setCreated(false)}>✏️ Write another</button>
            </>
          ) : (
            <>
              <label style={s.label}>Message</label>
              <textarea style={s.textarea} placeholder="Write your secret message..." value={msg} onChange={e => setMsg(e.target.value)} />
              <label style={s.label}>Password</label>
              <input type="password" style={s.input} placeholder="Choose a password..." value={pass} onChange={e => setPass(e.target.value)} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
                <input type="checkbox" id="sd" checked={sd} onChange={e => setSd(e.target.checked)} />
                <label htmlFor="sd" style={{ fontSize: 13, color: "#6b6475", cursor: "pointer" }}>Self-destruct after reading</label>
              </div>
              <button style={s.btn} disabled={loading} onClick={createNote}>{loading ? "Encrypting..." : "🔒 Encrypt & lock"}</button>
            </>
          )}
        </div>
      )}

      {tab === "retrieve" && (
        <div style={s.card}>
          {err && <div style={s.error}>{err}</div>}
          {ok && <div style={s.success}>{ok}</div>}
          <label style={s.label}>Password</label>
          <input type="password" style={s.input} placeholder="Enter password..." value={findPass} onChange={e => setFindPass(e.target.value)} />
          <button style={s.btn} disabled={loading} onClick={revealNote}>{loading ? "Decrypting..." : "🔓 Decrypt & reveal"}</button>
          {revealed && <div style={s.revealBox}>{revealed}</div>}
        </div>
      )}

      {tab === "vault" && (
        <div>
          {notes.length === 0
            ? <div style={{ ...s.card, textAlign: "center", color: "#6b6475", fontSize: 14 }}>No notes stored yet.</div>
            : notes.map(n => (
              <div key={n.id} style={s.noteRow}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#c9a0f0", fontWeight: 600 }}>#{(n.id||"").toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: "#6b6475", marginTop: 3 }}>{fmt(n.created_at)}</div>
                  </div>
                  <button onClick={() => deleteNote(n.id)} style={{ background: "none", border: "none", color: "#4a2535", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab === "notifs" && (
        <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
          {notifs.length === 0
            ? <div style={{ textAlign: "center", color: "#6b6475", fontSize: 14, padding: "1.5rem" }}>No notifications yet.</div>
            : notifs.map(n => (
              <div key={n.id} style={s.notifItem(n.read)}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a0f0", marginTop: 5, flexShrink: 0, display: "inline-block" }} />
                <div>
                  <div style={{ fontSize: 13, color: "#c9c5d0" }}>Note <span style={{ color: "#c9a0f0" }}>#{(n.note_id||"").toUpperCase()}</span> was read.</div>
                  <div style={{ fontSize: 11, color: "#6b6475", marginTop: 2 }}>{fmt(n.time)}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));