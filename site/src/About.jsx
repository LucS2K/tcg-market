import { COPY } from "./theme.js";

const card = {
  background: "#fff",
  border: "2px solid #241a45",
  borderRadius: 18,
  boxShadow: "4px 4px 0 #241a45",
  padding: "22px 24px",
};
const h2 = { fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 10px" };
const p = { fontSize: 15, lineHeight: 1.6, color: "#443a6b", margin: "0 0 10px" };
const mono = { fontFamily: "'Spline Sans Mono', monospace" };

export default function About({ goHome }) {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "26px 20px 60px", width: "100%", boxSizing: "border-box" }}>
      <button className="lift-btn" onClick={goHome} style={{ fontSize: 14, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "2px solid #241a45", background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #241a45" }}>{COPY.backLabel}</button>

      <section style={{ padding: "36px 0 8px", animation: "rise .45s ease both" }}>
        <h1 style={{ fontSize: "clamp(34px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "16px 0 8px" }}>About this site</h1>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "rise .5s ease .08s both" }}>
        <section style={card}>
          <h2 style={h2}>Why this exists</h2>
          <p style={{ ...p, margin: 0 }}>
            NeighborsTCG is a project I built for my card table. My friends, my family, and I collect
            and play across a bunch of games, so I made one place to check what things are worth. No
            ads, no affiliate links, no accounts. Just prices, updated daily.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>How it works</h2>
          <p style={p}>
            Once a day, a collector takes a price snapshot of every card in five games — Magic: The
            Gathering, Pokémon, Disney Lorcana, One Piece, and Riftbound — from{" "}
            <a href="https://scryfall.com">Scryfall</a>, <a href="https://pokemontcg.io">pokemontcg.io</a>,
            and TCGplayer market data via <a href="https://tcgapi.dev">tcgapi.dev</a>. Snapshots land as
            Parquet files in a public GitHub repo, get modeled with dbt into a small warehouse, and
            this site is rebuilt from the result. Same time, every day.
          </p>
          <ul style={{ ...p, paddingLeft: 20, margin: 0 }}>
            <li>Every version of a card is grouped into one page, so the printing timeline shows the
              full reprint history — Magic groups by Scryfall's oracle ID; other games group by card
              name.</li>
            <li>The headline price is the newest printing's market price in USD, preferring the
              plainest finish (non-foil before foil).</li>
            <li>7-day swings and trend charts come straight from the accumulated daily snapshots —
              the site launched 2026-08-03, so history fills in from there.</li>
            <li>Condition and graded prices are <em>estimates</em> scaled from the headline price,
              not live quotes. Treat them as ballparks.</li>
            <li>Ultra-rare promos sometimes show absurd listing prices (a{" "}
              <span style={mono}>$100,000</span> serial-numbered Shanks, say) — that's genuinely what
              the market lists them at, with roughly zero actual sales.</li>
            <li>Card images are hotlinked from the sources and belong to their publishers; artist
              names are shown where the data provides them.</li>
          </ul>
        </section>

        <section style={{ ...card, background: "#fdf0f3", boxShadow: "none" }}>
          <h2 style={h2}>What this is not</h2>
          <p style={{ ...p, margin: 0 }}>
            Not financial advice, not a store, not affiliated with any game publisher or marketplace.
            One price reading per day means intraday moves won't show. If you're making a real-money
            decision, check a live marketplace first.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>About me</h2>
          <p style={p}>
            Hi, I'm Luc, a business analyst. This one started at my card table: checking five
            different sites to answer "what's this worth?" got old, so I built one place. It's also
            my excuse to build a data pipeline end to end, done properly, because that's my idea of
            fun too.
          </p>
          <p style={p}>
            I did this end to end: choosing the games and sources, designing the daily collection
            and its rate-limit budgets, making the modeling and methodology decisions described on
            this page, and publishing the result. Implementation was AI-assisted (Claude Code); the
            judgment calls documented above are mine. If you're a hiring team evaluating a business
            analyst, my <a href="https://sf-inspections.vercel.app">SF health inspections project</a>{" "}
            is the formal work sample — this is the one I built for fun, and the pipeline is real
            either way.
          </p>
          <p style={{ ...p, margin: 0 }}>
            <a href="https://www.linkedin.com/in/luchnguyen/">LinkedIn</a> ·{" "}
            <a href="https://github.com/LucS2K">GitHub</a> ·{" "}
            <a href="mailto:ljr.luc.nguyen@gmail.com">ljr.luc.nguyen@gmail.com</a> ·{" "}
            <a href="https://github.com/LucS2K/tcg-market">source code</a>
          </p>
        </section>
      </div>
    </main>
  );
}
