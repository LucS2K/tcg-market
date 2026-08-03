import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAMES } from "./theme.js";
import { fmt } from "./format.js";
import { getAllIndexes, getMeta } from "./data.js";
import Home from "./Home.jsx";
import CardDetail from "./CardDetail.jsx";
import About from "./About.jsx";

function viewFromHash() {
  const m = window.location.hash.match(/^#\/card\/([0-9a-f]+)/);
  if (m) return { t: "card", id: m[1] };
  if (window.location.hash.startsWith("#/about")) return { t: "about" };
  return { t: "home" };
}

function SearchResults({ results, loading, compact, onOpen }) {
  const pad = compact ? "9px 12px" : "11px 16px";
  return (
    <div style={{ position: "absolute", top: compact ? 46 : 72, left: 0, right: 0, zIndex: 40, background: "#fff", border: "2px solid #241a45", borderRadius: compact ? 16 : 18, boxShadow: (compact ? "5px 5px" : "6px 6px") + " 0 #241a45", overflow: "hidden", textAlign: "left", animation: "pop .15s ease both" }}>
      {results.map((r) => {
        const g = GAMES[r.game];
        return (
          <div key={r.gid} className="result-row" onMouseDown={() => onOpen(r.gid)} style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 12, padding: pad, cursor: "pointer", borderBottom: "1px solid #eee4d4" }}>
            <div style={{ width: compact ? 26 : 32, height: compact ? 36 : 44, borderRadius: compact ? 4 : 5, border: "1.5px solid #241a45", background: `linear-gradient(135deg, ${g.accent2}, ${g.accent})`, display: "grid", placeItems: "center", color: "rgba(255,255,255,.85)", fontSize: 15, flexShrink: 0 }}>{compact ? "" : g.glyph}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: compact ? 14 : 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              <div style={{ fontSize: compact ? 11.5 : 12, color: "#7c6fa8" }}>{g.short} · {r.set}{compact ? "" : " · " + r.rarity}</div>
            </div>
            <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontWeight: 700, fontSize: compact ? 13 : 15 }}>{fmt(r.price)}</div>
          </div>
        );
      })}
      {loading && <div style={{ padding: compact ? "12px 14px" : "14px 18px", fontSize: compact ? 13 : 14, color: "#7c6fa8" }}>Flipping through the binder…</div>}
      {!loading && results.length === 0 && (
        <div style={{ padding: compact ? "12px 14px" : "14px 18px", fontSize: compact ? 13 : 14, color: "#7c6fa8" }}>No hits. Try a card name like “Shanks” or a set like “Origins”.</div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(null);
  const [gameFilter, setGameFilter] = useState("all");
  const [meta, setMeta] = useState(null);
  const [index, setIndex] = useState(null);
  const indexLoading = useRef(false);
  const resultsRef = useRef([]);

  useEffect(() => { getMeta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openCard = useCallback((gid) => {
    window.location.hash = `#/card/${gid}`;
    setQ("");
    setFocused(null);
    window.scrollTo(0, 0);
  }, []);
  const goHome = useCallback(() => {
    window.location.hash = "#/";
    setQ("");
    setFocused(null);
  }, []);

  const ensureIndex = useCallback(() => {
    if (index || indexLoading.current) return;
    indexLoading.current = true;
    getAllIndexes().then(setIndex).catch(() => { indexLoading.current = false; });
  }, [index]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query || !index) return [];
    const scored = [];
    for (const e of index) {
      const name = e.name.toLowerCase();
      let score = -1;
      if (name.startsWith(query)) score = 2;
      else if (name.includes(query)) score = 1.5;
      else if ((e.set + " " + GAMES[e.game].name + " " + e.code).toLowerCase().includes(query)) score = 1;
      if (score > 0) scored.push({ e, score });
    }
    scored.sort((a, b) => b.score - a.score || (b.e.price || 0) - (a.e.price || 0));
    return scored.slice(0, 6).map((x) => x.e);
  }, [query, index]);
  resultsRef.current = results;

  const searchProps = {
    q,
    onQuery: (e) => { setQ(e.target.value); ensureIndex(); },
    onKey: (e) => {
      if (e.key === "Enter" && resultsRef.current.length) openCard(resultsRef.current[0].gid);
      if (e.key === "Escape") { setQ(""); setFocused(null); }
    },
    onBlur: () => setTimeout(() => setFocused(null), 150),
    results,
    loading: !!query && !index,
    openCard,
  };
  const showResults = !!query && !!focused;
  const isCard = view.t === "card";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff6ea", borderBottom: "2px solid #241a45" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div onClick={goHome} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "#ff5470", border: "2px solid #241a45", boxShadow: "3px 3px 0 #241a45", display: "grid", placeItems: "center", color: "#fff6ea", fontSize: 19, fontWeight: 800 }}>✦</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>NeighborsTCG</div>
          </div>
          {isCard && (
            <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
              <input
                value={q}
                onChange={searchProps.onQuery}
                onFocus={() => { setFocused("header"); ensureIndex(); }}
                onBlur={searchProps.onBlur}
                onKeyDown={searchProps.onKey}
                placeholder="Search another card…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 16px", border: "2px solid #241a45", borderRadius: 999, background: "#fff", fontSize: 15, outline: "none" }}
              />
              {showResults && focused === "header" && (
                <SearchResults results={results} loading={searchProps.loading} compact onOpen={openCard} />
              )}
            </div>
          )}
          <div style={{ marginLeft: "auto", fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, background: "#fff", border: "2px solid #241a45", borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>
            real data · {meta ? meta.snapshot_date : "refreshed daily"}
          </div>
        </div>
      </header>

      {view.t === "about" ? (
        <About goHome={goHome} />
      ) : isCard ? (
        <CardDetail key={view.id} gid={view.id} openCard={openCard} goHome={goHome} />
      ) : (
        <Home
          gameFilter={gameFilter}
          setGameFilter={setGameFilter}
          searchProps={searchProps}
          focused={focused}
          setFocused={setFocused}
          showResults={showResults}
          ensureIndex={ensureIndex}
        />
      )}

      <footer style={{ marginTop: "auto", background: "#241a45", color: "#fff6ea" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 20px", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>✦ NeighborsTCG</div>
          <div style={{ fontSize: 13, color: "#b8aee0", maxWidth: 640, lineHeight: 1.5 }}>
            A hobby project tracking daily market prices. Card names, sets, and images belong to their publishers — Wizards of the Coast, The Pokémon Company, Bandai, Ravensburger &amp; Disney, and Riot Games. Unofficial fan content; not affiliated with or endorsed by any of them. Prices via Scryfall, pokemontcg.io, and TCGplayer market data.{" "}
            <a href="#/about" style={{ color: "#fff6ea", fontWeight: 700 }}>About this site →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { SearchResults };
