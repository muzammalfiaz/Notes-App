'use strict';

const SB = "https://yhqfdeslngsarmhcetoa.supabase.co";
const KEY = "sb_publishable_c2O9q1-ov-siNJ6H_RCyrQ_h_TXI6EL";
const QUEUE_KEY = "notes_offline_queue";
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

// AES-256-GCM Encryption
async function deriveKey(pass) {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt:enc.encode("notes-salt-v1"), iterations:100000, hash:"SHA-256" },
    raw, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}
async function encryptMsg(text, pass) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass);
  const ct = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, new TextEncoder().encode(text));
  const buf = new Uint8Array(iv.byteLength + ct.byteLength);
  buf.set(iv,0); buf.set(new Uint8Array(ct), iv.byteLength);
  return btoa(String.fromCharCode(...buf));
}
async function decryptMsg(b64, pass) {
  try {
    const buf = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
    const iv = buf.slice(0,12), ct = buf.slice(12);
    const key = await deriveKey(pass);
    const pt = await crypto.subtle.decrypt({name:"AES-GCM",iv}, key, ct);
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

// Supabase API
async function db(path, method="GET", body=null) {
  const r = await fetch(SB+"/rest/v1/"+path, {
    method,
    headers:{
      "apikey":KEY,
      "Authorization":"Bearer "+KEY,
      "Content-Type":"application/json",
      "Prefer": method==="POST"?"return=representation":""
    },
    body: body ? JSON.stringify(body) : null
  });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// Auto-delete notes older than 2 days
async function purgeOldData() {
  if (!navigator.onLine) return;
  const cutoff = Date.now() - TWO_DAYS;
  try {
    await db("notes?created_at=lt."+cutoff, "DELETE");
    await db("notifications?time=lt."+cutoff, "DELETE");
  } catch {}
}

// Offline queue
function getQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); } catch { return []; } }
function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
async function flushQueue() {
  const q = getQueue();
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try { await db("notes","POST",item); } catch { remaining.push(item); }
  }
  saveQueue(remaining);
  if (remaining.length < q.length) renderApp();
}

// Helpers
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function fmt(ts) { return new Date(ts).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
function el(tag, props={}, ...kids) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(props)) {
    if (k==="style" && typeof v==="object") Object.assign(e.style,v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(),v);
    else e[k]=v;
  }
  for (const k of kids) k!=null && e.appendChild(typeof k==="string"?document.createTextNode(k):k);
  return e;
}
function span(text,style={}) { return el("span",{style},text); }

// State — note: msg and pass are NOT in state to avoid re-render wiping inputs
let state = { tab:"new", notifs:[], err:"", ok:"", revealed:null, created:false };
function setState(patch) { Object.assign(state,patch); renderApp(); }

// Poll notifications
async function loadNotifs() {
  try {
    const d = await db("notifications?order=time.desc");
    state.notifs = d||[];
    renderApp();
  } catch {}
}
setInterval(()=>{ if(navigator.onLine) loadNotifs(); }, 9000);

// Init
(async()=>{
  await loadNotifs();
  flushQueue();
  purgeOldData();
})();

// Styles
const css = {
  app:  {padding:"1.5rem 1rem 2rem",maxWidth:"460px",margin:"0 auto"},
  logo: {fontSize:"20px",fontWeight:"600",color:"#e0dae8",textAlign:"center",marginBottom:"1.75rem",letterSpacing:"0.06em"},
  tabs: {display:"flex",borderRadius:"10px",overflow:"hidden",border:"1px solid #2a2530",background:"#131117",marginBottom:"1.5rem"},
  tab:  (a)=>({flex:"1",padding:"11px 0",fontSize:"13px",cursor:"pointer",border:"none",
    background:a?"#2a2435":"transparent",color:a?"#c9a0f0":"#6b6475",fontWeight:a?"600":"400",position:"relative"}),
  card: {background:"#131117",border:"1px solid #2a2530",borderRadius:"12px",padding:"1.25rem"},
  lbl:  {fontSize:"11px",color:"#6b6475",display:"block",marginBottom:"5px",letterSpacing:"0.07em",textTransform:"uppercase"},
  inp:  {width:"100%",background:"#0d0d0f",border:"1px solid #2a2530",borderRadius:"8px",
    padding:"11px 12px",color:"#c9c5d0",fontSize:"15px",outline:"none",marginBottom:"1rem",WebkitAppearance:"none"},
  ta:   {width:"100%",background:"#0d0d0f",border:"1px solid #2a2530",borderRadius:"8px",
    padding:"11px 12px",color:"#c9c5d0",fontSize:"15px",outline:"none",marginBottom:"1rem",
    resize:"vertical",minHeight:"110px"},
  btn:  {width:"100%",padding:"13px",background:"#2a1f3d",border:"1px solid #4a3470",
    borderRadius:"8px",color:"#c9a0f0",fontSize:"15px",fontWeight:"600",cursor:"pointer"},
  btnd: {width:"100%",padding:"13px",background:"#1a1528",border:"1px solid #2a2530",
    borderRadius:"8px",color:"#6b6475",fontSize:"15px",fontWeight:"600",cursor:"not-allowed"},
  err:  {color:"#c06080",fontSize:"13px",marginBottom:"0.75rem",padding:"8px 12px",background:"#1e1218",borderRadius:"6px"},
  suc:  {color:"#80c0a0",fontSize:"13px",marginBottom:"0.75rem",padding:"8px 12px",background:"#121e18",borderRadius:"6px"},
  rev:  {background:"#0d0d0f",border:"1px solid #2a2530",borderRadius:"8px",padding:"1rem",
    marginTop:"1rem",whiteSpace:"pre-wrap",fontSize:"15px",color:"#e0dae8",lineHeight:"1.65"},
  ni:   (read)=>({display:"flex",gap:"10px",padding:"11px 14px",borderBottom:"1px solid #1a1820",
    background:read?"transparent":"#16121e"}),
  dot:  {width:"7px",height:"7px",borderRadius:"50%",background:"#c9a0f0",marginTop:"5px",flexShrink:"0",display:"inline-block"},
  badge:{position:"absolute",top:"5px",right:"6px",background:"#c9a0f0",color:"#0d0d0f",
    borderRadius:"50%",width:"15px",height:"15px",fontSize:"9px",fontWeight:"700",
    display:"flex",alignItems:"center",justifyContent:"center"}
};

// Render
function renderApp() {
  const root = document.getElementById("root");
  root.innerHTML="";
  const app = el("div",{style:css.app});
  app.appendChild(el("div",{style:css.logo},"NOTES"));

  if (!navigator.onLine) {
    const q = getQueue();
    app.appendChild(el("div",{style:{...css.err,marginBottom:"1rem"}},
      q.length?"Offline — "+q.length+" note(s) will sync when connected.":"You are offline."
    ));
  }

  const unread = state.notifs.filter(n=>!n.read).length;
  const tabBar = el("div",{style:css.tabs});
  for (const [t,label] of [["new","New"],["retrieve","Retrieve"],["boom","Boom"]]) {
    const btn = el("button",{style:css.tab(state.tab===t), onClick:()=>{
      setState({tab:t,err:"",ok:"",revealed:null,created:false});
      if(t==="boom") markAllRead();
    }}, label);
    if (t==="boom" && unread>0) btn.appendChild(el("span",{style:css.badge},String(unread)));
    tabBar.appendChild(btn);
  }
  app.appendChild(tabBar);

  const card = el("div",{style:css.card});
  if (state.tab==="new") renderNew(card);
  else if (state.tab==="retrieve") renderRetrieve(card);
  else renderBoom(card);

  app.appendChild(card);
  root.appendChild(app);
}

function renderNew(card) {
  if (state.err) card.appendChild(el("div",{style:css.err},state.err));
  if (state.created) {
    card.appendChild(el("div",{style:css.suc},"Note encrypted and saved. Share your password with the recipient. Every note self-destructs after reading."));
    card.appendChild(el("button",{style:css.btn,onClick:()=>setState({created:false,err:"",ok:""})}, "Write another"));
    return;
  }

  card.appendChild(el("label",{style:css.lbl},"Note"));
  const ta = el("textarea",{style:css.ta, placeholder:"Write here"});
  card.appendChild(ta);

  card.appendChild(el("label",{style:css.lbl},"Password"));
  const pi = el("input",{type:"password",style:css.inp,placeholder:"Choose a password..."});
  card.appendChild(pi);

  const btn = el("button",{style:css.btn});
  btn.textContent = "Encrypt & lock";
  card.appendChild(btn);

  btn.addEventListener("click", async () => {
    const msg = ta.value.trim();
    const pass = pi.value;
    if (!msg) { state.err="Write something first."; renderApp(); return; }
    if (pass.length<3) { state.err="Password needs at least 3 characters."; renderApp(); return; }
    // disable button while working, do NOT re-render
    btn.textContent="Encrypting...";
    btn.style.cssText=css.btnd;
    btn.disabled=true;
    try {
      const cipher = await encryptMsg(msg, pass);
      const note = {id:genId(), cipher, self_destruct:true, created_at:Date.now()};
      if (navigator.onLine) { await db("notes","POST",note); }
      else { const q=getQueue(); q.push(note); saveQueue(q); }
      setState({created:true,err:""});
    } catch {
      state.err="Failed to save. Try again.";
      renderApp();
    }
  });
}

function renderRetrieve(card) {
  if (state.err) card.appendChild(el("div",{style:css.err},state.err));
  if (state.ok)  card.appendChild(el("div",{style:css.suc},state.ok));

  card.appendChild(el("label",{style:css.lbl},"Password"));
  const pi = el("input",{type:"password",style:css.inp,placeholder:"Enter password..."});
  card.appendChild(pi);

  const btn = el("button",{style:css.btn});
  btn.textContent="Decrypt & reveal";
  card.appendChild(btn);

  if (state.revealed) card.appendChild(el("div",{style:css.rev},state.revealed));

  btn.addEventListener("click", async () => {
    const pass = pi.value;
    if (!pass) { state.err="Enter your password."; renderApp(); return; }
    btn.textContent="Decrypting...";
    btn.disabled=true;
    btn.style.cssText=css.btnd;
    try {
      const all = await db("notes?order=created_at.desc");
      let found=null, text=null;
      for (const n of (all||[])) {
        const t = await decryptMsg(n.cipher, pass);
        if (t!==null) { found=n; text=t; break; }
      }
      if (!found) { state.err="Wrong password or no matching note."; renderApp(); return; }
      await db("notes?id=eq."+found.id,"DELETE");
      await db("notifications","POST",{note_id:found.id,time:Date.now(),read:false});
      setState({revealed:text,err:"",ok:""});
    } catch { state.err="Something went wrong."; renderApp(); }
  });
}

function renderBoom(card) {
  card.style.padding="0";
  card.style.overflow="hidden";
  if (!state.notifs.length) {
    card.style.padding="1.25rem";
    card.appendChild(el("div",{style:{textAlign:"center",color:"#6b6475",fontSize:"14px"}},"No notifications yet."));
    return;
  }
  for (const n of state.notifs) {
    const row = el("div",{style:css.ni(n.read)});
    row.appendChild(el("span",{style:css.dot}));
    const info = el("div");
    info.appendChild(el("div",{style:{fontSize:"13px",color:"#c9c5d0"}},
      "Note ",span("#"+(n.note_id||"").slice(0,8).toUpperCase(),{color:"#c9a0f0"})," was read."
    ));
    info.appendChild(el("div",{style:{fontSize:"11px",color:"#6b6475",marginTop:"2px"}},fmt(n.time)));
    row.appendChild(info);
    card.appendChild(row);
  }
}

async function markAllRead() {
  try {
    await db("notifications?read=eq.false","PATCH",{read:true});
    setTimeout(async()=>{
      await db("notifications","DELETE").catch(()=>{});
      setState({notifs:[]});
    },1200);
  } catch {}
}

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

renderApp();
window.addEventListener("online",  ()=>{ flushQueue(); renderApp(); });
window.addEventListener("offline", ()=>renderApp());