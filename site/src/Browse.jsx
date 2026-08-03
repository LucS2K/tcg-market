import { useEffect, useState } from "react";
import { GAMES } from "./theme.js";
import { fmt, changeStr, clickable } from "./format.js";
import { getIndex, getCard, norm, alnum } from "./data.js";

const PAGE_SIZE = 24;

export function browseHash(game, set, page) {
  const params = new URLSearchParams();
  if (set) params.set("set", set);
  if (page && page > 1) params.set("page", String(page));
  const q = params.toString();
  return `#/browse/${game}${q ? "?" + q : ""}`;
}

function TileArt({ gid, name, game }) {
  const g = GAMES[game];
  const [srcs, setSrcs] = useState([]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    let live = true;
    setIdx(0);
    getCard(gid)
      .then((c) => { if (live) setSrcs(c.images?.length ? c.images : c.image ? [c.image] : []); })
      .catch(() => {});
    return () => { live = false; };
  }, [gid]);
  const src = idx < srcs.length ? srcs[idx] : null;
  return (
    <div style={{ aspectRatio: "5/7", borderRadius: 12, border: "2px solid #241a45", background: `linear-gradient(150deg, ${g.accent2}, ${g.accent})`, position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div style={{ fontSize: 64, color: "rgba(255,255,255,.35)" }}>{g.glyph}</div>
      {src ? (
        <img src={src} alt={name} loading="lazy" onError={() => setIdx((i) => i + 1)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2, textShadow: "0 1px 4px rgba(0,0,0,.45)" }}>{name}</div>
      )}
      <div style={{ position: "absolute", inset: 7, border: "1.5px solid rgba(255,255,255,.4)", borderRadius: 8, pointerEvents: "none" }} />
    </div>
  );
}

function PageButton({ label, target, onPick, disabled, active }) {
  if (disabled) {
    return <span style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "2px solid #d9cdb9", color: "#b8ab93", background: "#fff" }}>{label}</span>;
  }
  const style = { fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "2px solid #241a45", cursor: "pointer", textDecoration: "none", background: active ? "#241a45" : "#fff", color: active ? "#fff6ea" : "#241a45", boxShadow: active ? "3px 3px 0 #ff5470" : "3px 3px 0 #241a45" };
  if (onPick) {
    return <button className="lift-btn" onClick={onPick} style={style}>{label}</button>;
  }
  return <a href={target} className="lift-btn" style={style}>{label}</a>;
}

export default function Browse({ game, set, page, openCard }) {
  const [index, setIndex] = useState(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("price_desc");
  const [localPage, setLocalPage] = useState(1);
  useEffect(() => {
    let live = true;
    setIndex(null);
    getIndex(game).then((i) => live && setIndex(i)).catch(() => {});
    return () => { live = false; };
  }, [game]);
  useEffect(() => { setFilter(""); setSort("price_desc"); setLocalPage(1); }, [game, set]);
  useEffect(() => { window.scrollTo(0, 0); }, [game, set, page]);

  const g = GAMES[game];
  const scoped = index ? (set ? index.filter((e) => e.set === set) : index) : null;
  const nf = norm(filter.trim());
  const cf = alnum(filter.trim());
  const filtering = nf.length > 0;
  const searched = scoped && filtering
    ? scoped.filter((e) => e.norm.includes(nf) || norm(e.set).includes(nf) || (cf.length >= 2 && e.codeNorm.includes(cf)))
    : scoped;
  // The index arrives sorted by price desc; other orders sort a copy.
  const filtered = !searched ? null
    : sort === "price_asc" ? [...searched].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    : sort === "az" ? [...searched].sort((a, b) => a.name.localeCompare(b.name))
    : searched;
  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  // Filtered or re-sorted views paginate locally; the default view keeps
  // shareable hash-based page links.
  const customView = filtering || sort !== "price_desc";
  const current = Math.min(Math.max(1, customView ? localPage : page), totalPages);
  const slice = filtered ? filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) : [];
  const pick = (n) => (customView ? () => { setLocalPage(n); window.scrollTo(0, 0); } : undefined);

  const windowStart = Math.max(1, Math.min(current - 3, totalPages - 6));
  const pageNumbers = [];
  for (let n = windowStart; n <= Math.min(totalPages, windowStart + 6); n++) pageNumbers.push(n);

  return (
    <main style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 20px 60px", width: "100%", boxSizing: "border-box" }}>
      <section style={{ animation: "rise .45s ease both" }}>
        <h1 style={{ fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "10px 0 4px" }}>
          {set ? set : "The whole binder"}
        </h1>
        <div style={{ color: "#6e6396", fontSize: 14, marginBottom: 16 }}>
          {filtered ? `${filtered.length.toLocaleString()} cards` : "counting cards…"} · {g.name} · sorted by price
          {set && (
            <>
              {" · "}
              <a href={browseHash(game, null, 1)} style={{ fontWeight: 700 }}>clear set filter ×</a>
            </>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {Object.entries(GAMES).map(([id, gg]) => (
            <a key={id} href={browseHash(id, null, 1)} className="lift-btn" style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", cursor: "pointer", textDecoration: "none", background: id === game ? "#241a45" : "#fff", color: id === game ? "#fff6ea" : "#241a45", boxShadow: id === game ? "3px 3px 0 #ff5470" : "3px 3px 0 #241a45" }}>
              {gg.short}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
          <input
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setLocalPage(1); }}
            placeholder={`Filter ${set || g.short} — name, set, or code`}
            style={{ flex: "1 1 260px", maxWidth: 440, boxSizing: "border-box", padding: "10px 18px", border: "2px solid #241a45", borderRadius: 999, background: "#fff", fontSize: 15, fontWeight: 600, outline: "none", boxShadow: "3px 3px 0 #241a45" }}
          />
          {[["price_desc", "price ↓"], ["price_asc", "price ↑"], ["az", "A–Z"]].map(([id, label]) => (
            <button key={id} className="lift-btn" onClick={() => { setSort(id); setLocalPage(1); }} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "2px solid #241a45", cursor: "pointer", background: sort === id ? "#241a45" : "#fff", color: sort === id ? "#fff6ea" : "#241a45", boxShadow: sort === id ? "3px 3px 0 #ff5470" : "3px 3px 0 #241a45" }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ animation: "rise .5s ease .08s both" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 18 }}>
          {slice.map((c) => {
            const cs = changeStr(c.change);
            const up = (c.change ?? 0) >= 0;
            return (
              <div key={c.gid} className="lift-tile" {...clickable(() => openCard(c.gid))} style={{ background: "#fff", border: "2px solid #241a45", borderRadius: 18, padding: 12, cursor: "pointer", boxShadow: "4px 4px 0 #241a45" }}>
                <TileArt gid={c.gid} name={c.name} game={game} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#7c6fa8", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.set}</div>
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
        {!index && <div style={{ color: "#7c6fa8", padding: "30px 0" }}>Flipping to the right page…</div>}
      </section>

      {totalPages > 1 && (
        <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 30 }}>
          <PageButton label="← prev" target={browseHash(game, set, current - 1)} onPick={pick(current - 1)} disabled={current === 1} />
          {windowStart > 1 && <PageButton label="1" target={browseHash(game, set, 1)} onPick={pick(1)} />}
          {windowStart > 2 && <span style={{ color: "#7c6fa8", padding: "8px 2px" }}>…</span>}
          {pageNumbers.map((n) => (
            <PageButton key={n} label={String(n)} target={browseHash(game, set, n)} onPick={pick(n)} active={n === current} />
          ))}
          {windowStart + 6 < totalPages - 1 && <span style={{ color: "#7c6fa8", padding: "8px 2px" }}>…</span>}
          {windowStart + 6 < totalPages && <PageButton label={String(totalPages)} target={browseHash(game, set, totalPages)} onPick={pick(totalPages)} />}
          <PageButton label="next →" target={browseHash(game, set, current + 1)} onPick={pick(current + 1)} disabled={current === totalPages} />
        </nav>
      )}
    </main>
  );
}
