// Visual identity per game, from the design handoff.
export const GAMES = {
  mtg:       { name: "Magic: The Gathering", short: "Magic",     glyph: "✦", accent: "#7c5cff", accent2: "#3b2d7a", vibe: "arcane" },
  pokemon:   { name: "Pokémon TCG",          short: "Pokémon",   glyph: "◓", accent: "#ffcb05", accent2: "#c8420e", vibe: "electric" },
  onepiece:  { name: "One Piece Card Game",  short: "One Piece", glyph: "☠", accent: "#ff4d4d", accent2: "#0e5aa7", vibe: "adventure" },
  lorcana:   { name: "Disney Lorcana",       short: "Lorcana",   glyph: "✒", accent: "#e8b64c", accent2: "#4c2a72", vibe: "storybook" },
  riftbound: { name: "Riftbound",            short: "Riftbound", glyph: "⟁", accent: "#2dd4bf", accent2: "#7a1fa2", vibe: "rift" },
};

// Light accents take ink text on pills; dark accents take white.
export const darkPill = (game) => game === "pokemon" || game === "lorcana" || game === "riftbound";
export const pillFg = (game) => (darkPill(game) ? "#241a45" : "#fff");

export const COPY = {
  heroBadge: "the price is a vibe. we track the vibe.",
  heroTitle: "Look what you pulled.",
  heroSub: "Fast price lookups for Magic, Pokémon, One Piece, Lorcana, and Riftbound — with the full reprint saga behind every card.",
  trendTitle: "Movers & shakers", trendSub: "biggest 7-day swings right now",
  bigTitle: "The money cards", bigSub: "top prices today — swings appear once we have a week of history",
  setsTitle: "Fresh off the printer", setsSub: "recent sets worth flipping through",
  printsTitle: "Every time they printed it", printsSub: "same card, different decades, very different prices",
  condTitle: "How beat up is yours?", condSub: "what condition does to the number",
  relTitle: "Cards that hang out with this one", relSub: "other versions and usual suspects",
  backLabel: "← Back to the binder",
  flipHint: "Click the card for a flip. You know you want to.",
};
