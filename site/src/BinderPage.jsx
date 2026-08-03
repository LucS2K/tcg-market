import { useEffect, useMemo, useState } from "react";
import { GAMES } from "./theme.js";
import { fmt, changeStr, clickable } from "./format.js";
import { getCards } from "./data.js";
import { loadBinder, setQty, onBinderChange, exportCode, decodeCode, importCode, binderSize } from "./binder.js";

const card = { background: "#fff", border: "2px solid #241a45", borderRadius: 18, boxShadow: "4px 4px 0 #241a45", padding: "18px 20px" };

export default function BinderPage({ sharedCode, openCard, goHome }) {
  const [binder, setBinder] = useState(() => (sharedCode ? decodeCode(sharedCode) || {} : loadBinder()));
  const [details, setDetails] = useState({});
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState(null);
  const readOnly = !!sharedCode;

  useEffect(() => {
    if (readOnly) return undefined;
    return onBinderChange(setBinder);
  }, [readOnly]);

  const gids = useMemo(() => Object.keys(binder), [binder]);
  useEffect(() => {
    let live = true;
    if (!gids.length) { setDetails({}); return undefined; }
    getCards(gids).then((cards) => {
      if (!live) return;
      const map = {};
      cards.forEach((c) => { if (c) map[c.id] = c; });
      setDetails(map);
    });
    return () => { live = false; };
  }, [gids.join(",")]);

  const rows = gids
    .map((gid) => ({ gid, qty: binder[gid], det: details[gid] }))
    .filter((r) => r.det)
    .sort((a, b) => (b.det.price || 0) * b.qty - (a.det.price || 0) * a.qty);
  const total = rows.reduce((sum, r) => sum + (r.det.price || 0) * r.qty, 0);
  const weekAgoTotal = rows.reduce((sum, r) => {
    const p = r.det.price || 0;
    const c = r.det.change;
    return sum + (c != null ? (p / (1 + c / 100)) * r.qty : p * r.qty);
  }, 0);
  const totalChange = weekAgoTotal > 0 ? ((total - weekAgoTotal) / weekAgoTotal) * 100 : null;
  const tcs = changeStr(totalChange != null ? Math.round(totalChange * 10) / 10 : null);

  const copyCode = () => {
    navigator.clipboard?.writeText(exportCode(binder)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const doImport = () => {
    if (importCode(importText)) {
      setImportMsg("binder restored ✓");
      setImportText("");
      setBinder(loadBinder());
    } else {
      setImportMsg("that code didn't parse — check the paste");
    }
    setTimeout(() => setImportMsg(null), 3000);
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 60px", width: "100%", boxSizing: "border-box" }}>
      <button className="lift-btn" onClick={goHome} style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #241a45" }}>← Back to the binder</button>

      <section style={{ padding: "30px 0 14px", animation: "rise .45s ease both" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "0 0 6px" }}>
          {readOnly ? "A shared binder" : "My binder"}
        </h1>
        <div style={{ color: "#6e6396", fontSize: 14 }}>
          {binderSize(binder)} cards · {rows.length ? "" : gids.length ? "fetching prices…" : "empty so far"}
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 22, animation: "rise .5s ease .06s both" }}>
        <div style={{ ...card, flex: "1 1 220px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6fa8", textTransform: "uppercase", letterSpacing: 1 }}>Total value</div>
          <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: "clamp(30px, 4vw, 42px)", fontWeight: 700 }}>{fmt(Math.round(total * 100) / 100)}</div>
          {tcs && <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, fontWeight: 700, color: (totalChange ?? 0) >= 0 ? "#0e7a3d" : "#c0262d" }}>{tcs} · 7d</div>}
        </div>
        {!readOnly && (
          <div style={{ ...card, flex: "2 1 320px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6fa8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Backup &amp; share</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button className="lift-btn" onClick={copyCode} style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "2px solid #241a45", background: "#ffe36a", cursor: "pointer", boxShadow: "2px 2px 0 #241a45" }}>
                {copied ? "copied ✓" : "copy binder code"}
              </button>
              <input value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="paste a binder code to restore…" style={{ flex: "1 1 180px", boxSizing: "border-box", padding: "7px 14px", border: "2px solid #241a45", borderRadius: 999, fontSize: 13, outline: "none" }} />
              <button className="lift-btn" onClick={doImport} disabled={!importText.trim()} style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", boxShadow: "2px 2px 0 #241a45" }}>restore</button>
            </div>
            {importMsg && <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, marginTop: 8 }}>{importMsg}</div>}
            <div style={{ fontSize: 12.5, color: "#7c6fa8", marginTop: 10, lineHeight: 1.5 }}>
              Your binder lives on this device only. Copy the code somewhere safe to back it up or move phones — paste it into a text to share a read-only view. Adding the site to your home screen keeps iOS from clearing it.
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 && !gids.length && (
        <div style={{ ...card, color: "#443a6b", fontSize: 15, lineHeight: 1.6, animation: "rise .5s ease .1s both" }}>
          Nothing in here yet. Open any card and hit <b>+ add to binder</b> — your collection's value updates with every daily price pull.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "rise .5s ease .1s both" }}>
        {rows.map(({ gid, qty, det }) => {
          const rg = GAMES[det.game];
          const rcs = changeStr(det.change);
          return (
            <div key={gid} style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, boxShadow: "3px 3px 0 #241a45" }}>
              <div {...clickable(() => openCard(gid))} style={{ width: 44, height: 62, borderRadius: 7, border: "2px solid #241a45", background: `linear-gradient(150deg, ${rg.accent2}, ${rg.accent})`, display: "grid", placeItems: "center", color: "rgba(255,255,255,.8)", fontSize: 20, flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                {det.images?.[0] || det.image ? <img src={det.images?.[0] || det.image} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : rg.glyph}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div {...clickable(() => openCard(gid))} style={{ fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{det.name}</div>
                <div style={{ fontSize: 12, color: "#7c6fa8" }}>{rg.short} · {det.set}</div>
              </div>
              {!readOnly ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="lift-btn" onClick={() => setQty(gid, qty - 1)} style={{ width: 28, height: 28, borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", fontWeight: 800 }}>−</button>
                  <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, minWidth: 26, textAlign: "center" }}>{qty}</span>
                  <button className="lift-btn" onClick={() => setQty(gid, qty + 1)} style={{ width: 28, height: 28, borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", fontWeight: 800 }}>+</button>
                </div>
              ) : (
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700 }}>×{qty}</span>
              )}
              <div style={{ textAlign: "right", minWidth: 80 }}>
                <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, fontSize: 15 }}>{fmt((det.price || 0) * qty)}</div>
                {rcs && <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11.5, fontWeight: 700, color: (det.change ?? 0) >= 0 ? "#0e7a3d" : "#c0262d" }}>{rcs}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
