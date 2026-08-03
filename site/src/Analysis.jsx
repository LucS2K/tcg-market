import { useEffect, useState } from "react";
import { GAMES } from "./theme.js";

const card = { background: "#fff", border: "2px solid #241a45", borderRadius: 18, boxShadow: "4px 4px 0 #241a45", padding: "20px 22px" };
const h2 = { fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 8px" };
const p = { fontSize: 15, lineHeight: 1.6, color: "#443a6b", margin: "0 0 10px" };
const mono = { fontFamily: "'Spline Sans Mono', monospace" };

function MultiLine({ series, height = 220, yRef = null, xLabel }) {
  // series: [{ id, color, pts: [[x, y], ...] }]
  const all = series.flatMap((s) => s.pts);
  if (!all.length) return null;
  const xs = all.map((p_) => p_[0]), ys = all.map((p_) => p_[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = 560, H = height, PAD = 12;
  const sx = (x) => ((x - x0) / (x1 - x0 || 1)) * (W - 2 * PAD) + PAD;
  const sy = (y) => PAD + (1 - (y - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        {yRef != null && yRef >= y0 && yRef <= y1 && (
          <line x1={PAD} x2={W - PAD} y1={sy(yRef)} y2={sy(yRef)} stroke="#241a45" strokeOpacity="0.25" strokeDasharray="5,5" strokeWidth="1.5" />
        )}
        {series.map((s) => (
          <polyline key={s.id} points={s.pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {xLabel && <div style={{ ...mono, fontSize: 11, color: "#7c6fa8", display: "flex", justifyContent: "space-between" }}><span>{xLabel[0]}</span><span>{xLabel[1]}</span></div>}
    </div>
  );
}

function Legend({ games }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 4px" }}>
      {games.map((id) => (
        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700 }}>
          <span style={{ width: 14, height: 4, borderRadius: 2, background: GAMES[id].accent, display: "inline-block", border: "1px solid #241a45" }} />
          {GAMES[id].short}
        </span>
      ))}
    </div>
  );
}

export default function Analysis({ goHome }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/analysis.json").then((r) => r.json()).then(setData).catch(() => {});
    document.title = "Do reprints kill prices? — NeighborsTCG";
    return () => { document.title = "NeighborsTCG — trading card prices"; };
  }, []);

  if (!data) return <main style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px", flex: 1, width: "100%", boxSizing: "border-box", color: "#7c6fa8" }}>Crunching the numbers…</main>;

  const monthIdx = (m) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo; };
  const indexSeries = Object.entries(data.index).map(([g, pts]) => ({
    id: g, color: GAMES[g].accent, pts: pts.map(([m, v]) => [monthIdx(m), v]),
  }));
  const decayGames = ["mtg", "onepiece", "lorcana", "pokemon"].filter((g) => data.decay[g]?.length);
  const decaySeries = decayGames.map((g) => ({
    id: g, color: GAMES[g].accent, pts: data.decay[g].map(([wk, r]) => [wk, r]),
  }));
  const wk16 = (g) => {
    const row = (data.decay[g] || []).filter(([wk]) => wk >= 14 && wk <= 17).pop();
    return row ? Math.round((row[1] - 1) * 100) : null;
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 60px", width: "100%", boxSizing: "border-box" }}>
      <button className="lift-btn" onClick={goHome} style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #241a45" }}>← Back to the binder</button>

      <section style={{ padding: "32px 0 10px", animation: "rise .45s ease both" }}>
        <div style={{ display: "inline-block", background: "#ffe36a", border: "2px solid #241a45", borderRadius: 999, padding: "5px 14px", fontWeight: 700, fontSize: 13, transform: "rotate(-2deg)", boxShadow: "3px 3px 0 #241a45" }}>preliminary · updates daily</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.08, margin: "14px 0 8px" }}>Do reprints kill prices?</h1>
        <p style={{ ...p, maxWidth: 640 }}>
          The question this site was built to answer. Every chart below is computed from our own
          daily snapshots plus archived TCGplayer history back to February 2024, and recomputes
          with every day of new data.
        </p>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "rise .5s ease .08s both" }}>
        <section style={card}>
          <h2 style={h2}>The market, one line per game</h2>
          <p style={p}>
            Median price of a fixed basket of cards — only cards priced continuously from each
            game's first observed month to now, indexed to 100 at the start. New releases never
            join the basket, so the line tracks what <em>holding</em> cards did, not what got printed.
          </p>
          <Legend games={Object.keys(data.index)} />
          <MultiLine series={indexSeries} yRef={100} xLabel={["Feb 2024", "today"]} />
          <p style={{ ...p, marginTop: 10, fontSize: 13.5 }}>
            Lorcana's cliff is the story: its basket lost roughly two-thirds of its value in the
            first months of 2024 as Ravensburger's reprint wave met the post-launch demand crash —
            and it never came back. Riftbound's short line starts at its 2025 launch
            ({data.basket_n.riftbound || 0}-card basket; hype-phase pricing, no supply discipline yet).
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>What a reprint does to the original printing</h2>
          <p style={p}>
            For every card that gained a new printing since May 2024 while an older printing
            already existed ({decayGames.map((g) => `${GAMES[g].short}: ${data.events_n[g]?.toLocaleString()}`).join(" · ")} events),
            we track the <em>original</em> printing's price, indexed to its level in the month
            before the reprint. The dashed line is "nothing happened."
          </p>
          <Legend games={decayGames} />
          <MultiLine series={decaySeries} yRef={1} xLabel={["17 weeks before reprint", "17 weeks after"]} />
          <p style={{ ...p, marginTop: 10, fontSize: 13.5 }}>
            Magic, with {data.events_n.mtg?.toLocaleString()} events of evidence, barely flinches:
            the median original drifts down {Math.abs(wk16("mtg") ?? 0)}% over four months — decades
            of reprints are already priced in. Lorcana is the counterfactual: originals run up into
            the reprint, then shed ~{Math.abs(wk16("lorcana") ?? 0)}% within four months — a whole
            scarcity cycle compressed into one chart (small sample: {data.events_n.lorcana} events).
            One Piece sits between. Pokemon's line actually <em>rises</em> — see the caveats.
          </p>
        </section>

        <section style={{ ...card, background: "#fdf0f3", boxShadow: "none" }}>
          <h2 style={h2}>The honest bit</h2>
          <ul style={{ ...p, paddingLeft: 18, margin: 0 }}>
            <li>Magic lineages use Scryfall's oracle ID (exact). Lorcana and One Piece group by full
              card name (reliable — names include subtitles). Pokemon groups by name alone, so "a new
              Pikachu" counts as a reprint of every old Pikachu — its rising line says more about that
              grouping than about supply. Treat the Pokemon curve as unreliable.</li>
            <li>Weekly price readings before May 2026; medians across events; originals below $0.50
              pre-reprint are excluded. Delisted products that never mapped to the current catalog
              are invisible — survivorship favors cards that stayed sellable.</li>
            <li>Lorcana's early collapse mixes reprint supply with the fading of launch-era
              speculative Disney-collector demand. We name that confound rather than model around it.</li>
            <li>Riftbound is excluded by design: zero reprints as of today. A watcher checks daily
              and files an alert the day Riot's first real reprint lands — at which point its
              before/after series starts here.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
