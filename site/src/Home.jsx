import { useEffect, useState } from "react";
import { GAMES, COPY, pillFg } from "./theme.js";
import { fmt, changeStr, clickable } from "./format.js";
import { getSets } from "./data.js";
import { SearchResults } from "./App.jsx";

export default function Home({ gameFilter, setGameFilter, searchProps, focused, setFocused, showResults, ensureIndex }) {
  const [trending, setTrending] = useState(null);
  const [sets, setSets] = useState([]);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/trending.json").then((r) => r.json()).then(setTrending).catch(() => {});
    getSets().then(setSets).catch(() => {});
  }, []);

  const hasChanges = trending?.has_changes;
  const movers = (trending?.[gameFilter] ?? []).map((e) => ({ gid: e[0], name: e[1], set: e[2], code: e[3], rarity: e[4], price: e[5], change: e[6], game: e[7] }));
  const visibleSets = sets.filter((s) => gameFilter === "all" || s.game === gameFilter);

  const chips = [{ id: "all", label: "All games" }, ...Object.entries(GAMES).map(([id, g]) => ({ id, label: g.short }))];

  return (
    <main style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px 60px", width: "100%", boxSizing: "border-box" }}>
      <section style={{ padding: "56px 0 8px", textAlign: "center", animation: "rise .5s ease both", position: "relative", zIndex: 30 }}>
        <div style={{ display: "inline-block", background: "#ffe36a", border: "2px solid #241a45", borderRadius: 999, padding: "5px 14px", fontWeight: 700, fontSize: 13, transform: "rotate(-2deg)", boxShadow: "3px 3px 0 #241a45" }}>{COPY.heroBadge}</div>
        <h1 style={{ fontSize: "clamp(42px, 7vw, 82px)", fontWeight: 800, letterSpacing: "-2.5px", lineHeight: 1.02, margin: "18px 0 12px" }}>{COPY.heroTitle}</h1>
        <p style={{ fontSize: "clamp(16px, 2vw, 19px)", color: "#6e6396", margin: "0 auto", maxWidth: 560, textWrap: "pretty" }}>{COPY.heroSub}</p>
        <div style={{ position: "relative", maxWidth: 620, margin: "28px auto 0" }}>
          <input
            value={searchProps.q}
            onChange={searchProps.onQuery}
            onFocus={() => { setFocused("hero"); ensureIndex(); }}
            onBlur={searchProps.onBlur}
            onKeyDown={searchProps.onKey}
            placeholder="Search any card — try “Lightning Bolt”"
            style={{ width: "100%", boxSizing: "border-box", padding: "18px 24px", border: "2.5px solid #241a45", borderRadius: 20, background: "#fff", fontSize: 18, fontWeight: 600, outline: "none", boxShadow: "6px 6px 0 #241a45" }}
          />
          <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 22 }}>🔍</div>
          {showResults && focused === "hero" && (
            <SearchResults results={searchProps.results} loading={searchProps.loading} compact={false} onOpen={searchProps.openCard} />
          )}
        </div>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", padding: "26px 0 10px", animation: "rise .5s ease .08s both" }}>
        {chips.map((ch) => {
          const active = gameFilter === ch.id;
          return (
            <button key={ch.id} className="lift-btn" onClick={() => setGameFilter(ch.id)} style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", cursor: "pointer", background: active ? "#241a45" : "#fff", color: active ? "#fff6ea" : "#241a45", boxShadow: active ? "3px 3px 0 #ff5470" : "3px 3px 0 #241a45" }}>
              {ch.label}
            </button>
          );
        })}
      </section>

      <section style={{ paddingTop: 30, animation: "rise .5s ease .14s both" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 800, letterSpacing: "-1px", margin: 0 }}>{hasChanges ? COPY.trendTitle : COPY.bigTitle}</h2>
          <span style={{ color: "#6e6396", fontSize: 14 }}>{hasChanges ? COPY.trendSub : COPY.bigSub}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 18 }}>
          {movers.map((c) => {
            const g = GAMES[c.game];
            const up = (c.change ?? 0) >= 0;
            const cs = changeStr(c.change);
            const spark = null; // index entries carry no history; sparkline lives on the detail page
            return (
              <div key={c.gid} className="lift-tile" {...clickable(() => searchProps.openCard(c.gid))} style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 18, padding: 12, cursor: "pointer", boxShadow: "4px 4px 0 #241a45" }}>
                <div style={{ aspectRatio: "5/7", borderRadius: 12, border: "2px solid #241a45", background: `linear-gradient(150deg, ${g.accent2}, ${g.accent})`, position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
                  <div style={{ fontSize: 64, color: "rgba(255,255,255,.35)" }}>{g.glyph}</div>
                  <MoverArt gid={c.gid} name={c.name} />
                  <div style={{ position: "absolute", inset: 7, border: "1.5px solid rgba(255,255,255,.4)", borderRadius: 8, pointerEvents: "none" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#7c6fa8", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.short} · {c.set}</div>
                    <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, fontSize: 17 }}>{fmt(c.price)}</div>
                  </div>
                  {cs && (
                    <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 999, border: "1.5px solid #241a45", background: up ? "#d9f7e5" : "#fde2e2", color: up ? "#0e7a3d" : "#c0262d", whiteSpace: "nowrap" }}>{cs}</div>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ paddingTop: 52, animation: "rise .5s ease .2s both" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 800, letterSpacing: "-1px", margin: 0 }}>{COPY.setsTitle}</h2>
          <span style={{ color: "#6e6396", fontSize: 14 }}>{COPY.setsSub}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {visibleSets.map((s) => {
            const g = GAMES[s.game];
            return (
              <div key={s.game + s.code + s.name} className="lift-tile" {...clickable(() => setGameFilter(s.game))} style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 18, padding: 18, cursor: "pointer", position: "relative", boxShadow: "4px 4px 0 #241a45", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: `linear-gradient(90deg, ${g.accent2}, ${g.accent})` }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1.5px solid #241a45", background: g.accent, color: pillFg(s.game) }}>{g.short}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, background: "#ffe36a", border: "1.5px solid #241a45", borderRadius: 999, padding: "3px 10px", transform: "rotate(2deg)" }}>{s.tag}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginTop: 12 }}>{s.name}</div>
                <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12.5, color: "#6e6396", marginTop: 6 }}>{s.code} · {s.released} · {s.cards} cards</div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

// Lazily swaps the gradient placeholder for the real card scan.
import { getCard } from "./data.js";
function MoverArt({ gid, name }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    getCard(gid).then((c) => { if (live && c.image) setSrc(c.image); }).catch(() => {});
    return () => { live = false; };
  }, [gid]);
  if (!src) {
    return <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2, textShadow: "0 1px 4px rgba(0,0,0,.45)" }}>{name}</div>;
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setSrc(null)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}
