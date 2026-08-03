import { useEffect, useState } from "react";
import { GAMES, COPY, pillFg } from "./theme.js";
import { fmt, changeStr, clickable, sparkPts } from "./format.js";
import { getCard, getCards } from "./data.js";

export default function CardDetail({ gid, openCard, goHome }) {
  const [card, setCard] = useState(null);
  const [related, setRelated] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setCard(null); setRelated([]); setFlipped(false); setImgIdx(0); setError(false);
    getCard(gid)
      .then((c) => {
        if (!live) return;
        document.title = `${c.name} — NeighborsTCG`;
        setCard(c);
        if (c.related?.length) getCards(c.related).then((rs) => live && setRelated(rs.filter(Boolean)));
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
      document.title = "NeighborsTCG — trading card prices";
    };
  }, [gid]);

  if (error) {
    return (
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "60px 20px", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
        <h1 style={{ fontWeight: 800 }}>That card slipped out of the binder.</h1>
        <button className="lift-btn" onClick={goHome} style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #241a45" }}>{COPY.backLabel}</button>
      </main>
    );
  }
  if (!card) {
    return <main style={{ maxWidth: 1160, margin: "0 auto", padding: "60px 20px", flex: 1, width: "100%", boxSizing: "border-box", color: "#7c6fa8" }}>Fetching the card…</main>;
  }

  const g = GAMES[card.game];
  // Candidate art, tried in order: own product photo, sibling printings,
  // the base-name card (same illustration for most promo variants).
  const artSrcs = card.images?.length ? card.images : card.image ? [card.image] : [];
  const artSrc = imgIdx < artSrcs.length ? artSrcs[imgIdx] : null;
  const up = (card.change ?? 0) >= 0;
  const cs = changeStr(card.change);
  const spark = card.spark?.length ? card.spark : [card.price];
  const hi = Math.max(...spark), lo = Math.min(...spark);
  const chartPts = sparkPts(spark, 560, 170, 10);
  const sparkColor = up ? "#17a34a" : "#e14545";
  const sparkFill = up ? "rgba(23,163,74,.14)" : "rgba(225,69,69,.12)";
  const maxCond = Math.max(...card.conditions.map((x) => x[1]));
  const weeksOfHistory = spark.length;

  return (
    <main style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 20px 60px", width: "100%", boxSizing: "border-box" }}>
      <button className="lift-btn" onClick={goHome} style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #241a45" }}>{COPY.backLabel}</button>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 40, marginTop: 26, animation: "rise .45s ease both" }}>
        <div style={{ flex: "0 1 340px", minWidth: 260, margin: "0 auto" }}>
          <div onClick={() => setFlipped((f) => !f)} style={{ perspective: 1200, cursor: "pointer" }} title="Click to flip">
            <div style={{ position: "relative", aspectRatio: "5/7", transformStyle: "preserve-3d", transition: "transform .6s cubic-bezier(.4, .1, .2, 1.1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 18, border: "2.5px solid #241a45", background: `linear-gradient(150deg, ${g.accent2}, ${g.accent})`, boxShadow: "8px 8px 0 #241a45", overflow: "hidden", display: "grid", placeItems: "center" }}>
                <div style={{ fontSize: 130, color: "rgba(255,255,255,.32)" }}>{g.glyph}</div>
                {artSrc ? (
                  <img src={artSrc} alt={card.name} onError={() => setImgIdx((i) => i + 1)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    <div style={{ position: "absolute", inset: 12, border: "2px solid rgba(255,255,255,.4)", borderRadius: 12, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: 22, left: 22, right: 22, color: "#fff", fontWeight: 800, fontSize: 21, lineHeight: 1.15, textShadow: "0 1px 5px rgba(0,0,0,.45)" }}>{card.name}</div>
                    <div style={{ position: "absolute", bottom: 22, left: 22, right: 22, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,.9)", fontFamily: "'Spline Sans Mono', monospace", fontSize: 12 }}><span>{card.code}</span><span>{card.rarity}</span></div>
                  </>
                )}
              </div>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 18, border: "2.5px solid #241a45", background: g.accent2, boxShadow: "8px 8px 0 #241a45", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, padding: 28, boxSizing: "border-box", color: "#fff" }}>
                <div style={{ fontSize: 40, opacity: 0.5 }}>{g.glyph}</div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, textWrap: "pretty" }}>{card.blurb}</div>
                {card.artist && <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, opacity: 0.85 }}>Art: {card.artist}</div>}
                <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, opacity: 0.7 }}>Image © the game's publisher. Hotlinked from the source — nothing stored here.</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 12.5, color: "#7c6fa8", marginTop: 14 }}>{COPY.flipHint}</div>
          {card.artist && <div style={{ textAlign: "center", fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: "#7c6fa8", marginTop: 4 }}>Art: {card.artist}</div>}
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 300 }}>
          <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, border: "2px solid #241a45", background: g.accent, color: pillFg(card.game) }}>{g.name}</span>
          <h1 style={{ fontSize: "clamp(32px, 4.5vw, 52px)", fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "14px 0 6px" }}>{card.name}</h1>
          <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, color: "#7c6fa8", marginTop: 4 }}>{card.set} · {card.code} · {card.rarity}</div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginTop: 24 }}>
            <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: "clamp(40px, 5vw, 56px)", fontWeight: 700, lineHeight: 1 }}>{fmt(card.price)}</div>
            {cs ? (
              <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 15, fontWeight: 700, padding: "5px 12px", borderRadius: 999, border: "2px solid #241a45", background: up ? "#d9f7e5" : "#fde2e2", color: up ? "#0e7a3d" : "#c0262d", marginBottom: 6 }}>{cs} · 7d</div>
            ) : (
              <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", color: "#7c6fa8", marginBottom: 6 }}>7d trend soon</div>
            )}
          </div>

          <div style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 18, boxShadow: "4px 4px 0 #241a45", padding: 18, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{weeksOfHistory >= 12 ? "Last 12 weeks" : "Price history so far"}</div>
              <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: "#7c6fa8" }}>high {fmt(hi)} · low {fmt(lo)}</div>
            </div>
            <svg viewBox="0 0 560 170" preserveAspectRatio="none" style={{ width: "100%", height: 170, display: "block", marginTop: 10 }}>
              <polygon points={chartPts + " 560,170 0,170"} fill={sparkFill} />
              <polyline points={chartPts} fill="none" stroke={sparkColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={{ background: "#fdf0f3", border: "2px solid #241a45", borderRadius: 18, padding: "18px 20px", marginTop: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>The honest bit</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.55, color: "#443a6b" }}>
              <li>Prices are daily market snapshots from Scryfall, pokemontcg.io, and TCGplayer data — one reading per day, so intraday moves won't show.</li>
              {weeksOfHistory < 2 && <li>We started tracking this card recently, so the trend chart is still short. It fills in one day at a time.</li>}
              <li>Condition and graded prices below are estimates scaled from the headline price, not live quotes for each grade.</li>
            </ul>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 56, animation: "rise .5s ease .1s both" }}>
        <h2 style={{ fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 4px" }}>{COPY.printsTitle}</h2>
        <div style={{ color: "#6e6396", fontSize: 14, marginBottom: 20 }}>{COPY.printsSub}</div>
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, position: "relative", minWidth: "min-content", paddingTop: 10 }}>
            <div style={{ position: "absolute", top: 16, left: 10, right: 10, height: 3, background: "#241a45", opacity: 0.15, borderRadius: 2 }} />
            {card.printings.map((p, i) => (
              <div key={i} style={{ minWidth: 210, maxWidth: 240, position: "relative" }}>
                <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2.5px solid #241a45", background: p.current ? g.accent : "#fff6ea", marginLeft: 10 }} />
                <div style={{ background: p.current ? "#fffdf7" : "#fff", border: "2px solid #241a45", borderRadius: 16, padding: "14px 16px", marginTop: 10, boxShadow: p.current ? `4px 4px 0 ${g.accent2}` : "3px 3px 0 #241a45" }}>
                  <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, fontWeight: 700, color: "#7c6fa8" }}>{p.year ?? "—"}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2, marginTop: 3 }}>{p.set}</div>
                  <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, color: "#7c6fa8", marginTop: 2 }}>{p.code}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, fontSize: 17 }}>{fmt(p.price)}</span>
                    {p.current && <span style={{ fontSize: 11, fontWeight: 700, background: "#ffe36a", border: "1.5px solid #241a45", borderRadius: 999, padding: "2px 8px" }}>this page</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 40, marginTop: 52, animation: "rise .5s ease .16s both" }}>
        <section style={{ flex: "1 1 400px", minWidth: 300 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 4px" }}>{COPY.condTitle}</h2>
          <div style={{ color: "#6e6396", fontSize: 14, marginBottom: 18 }}>{COPY.condSub}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {card.conditions.map(([label, price]) => (
              <div key={label} style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 150, flexShrink: 0, fontWeight: 700, fontSize: 14 }}>{label}</div>
                <div style={{ flex: 1, height: 14, background: "#f3ead9", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(6, Math.round((price / maxCond) * 100))}%`, background: `linear-gradient(90deg, ${g.accent2}, ${g.accent})`, borderRadius: 999 }} />
                </div>
                <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, fontSize: 14, width: 82, textAlign: "right" }}>{fmt(price)}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ flex: "1 1 400px", minWidth: 300 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 4px" }}>{COPY.relTitle}</h2>
          <div style={{ color: "#6e6396", fontSize: 14, marginBottom: 18 }}>{COPY.relSub}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {related.map((r) => {
              const rg = GAMES[r.game];
              const rcs = changeStr(r.change);
              return (
                <div key={r.id} className="lift-row" {...clickable(() => openCard(r.id))} style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "3px 3px 0 #241a45" }}>
                  <div style={{ width: 44, height: 62, borderRadius: 7, border: "2px solid #241a45", background: `linear-gradient(150deg, ${rg.accent2}, ${rg.accent})`, display: "grid", placeItems: "center", color: "rgba(255,255,255,.8)", fontSize: 20, flexShrink: 0, overflow: "hidden" }}>
                    {r.image ? <img src={r.image} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : rg.glyph}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#7c6fa8" }}>{rg.short} · {r.set}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, fontSize: 15 }}>{fmt(r.price)}</div>
                    {rcs && <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11.5, fontWeight: 700, color: (r.change ?? 0) >= 0 ? "#0e7a3d" : "#c0262d" }}>{rcs}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
