// Data access over the static JSON exported by scripts/export_site_data.py.
const BASE = import.meta.env.BASE_URL + "data/";

let metaPromise = null;
const indexCache = {};
const shardCache = {};

async function getJson(path) {
  const resp = await fetch(BASE + path);
  if (!resp.ok) throw new Error(`fetch ${path}: ${resp.status}`);
  return resp.json();
}

export function getMeta() {
  metaPromise ??= getJson("meta.json");
  return metaPromise;
}

export function getSets() {
  return getJson("sets.json");
}

export const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const alnum = (s) => norm(s).replace(/[^a-z0-9]/g, "");

function mapEntry(e, game) {
  return {
    gid: e[0], name: e[1], set: e[2], code: e[3], rarity: e[4], price: e[5], change: e[6],
    game,
    norm: norm(e[1]),
    codeNorm: alnum(e[3]),
  };
}

// Search index entry: [gid, name, set, code, rarity, price, change]
export async function getAllIndexes() {
  const meta = await getMeta();
  const games = meta.games;
  const lists = await Promise.all(
    games.map((g) => (indexCache[g] ??= getJson(`index-${g}.json`)))
  );
  const out = [];
  games.forEach((g, i) => {
    for (const e of lists[i]) out.push(mapEntry(e, g));
  });
  return out;
}

export async function getIndex(game) {
  indexCache[game] ??= getJson(`index-${game}.json`);
  const list = await indexCache[game];
  return list.map((e) => mapEntry(e, game));
}

async function getShard(gid) {
  const meta = await getMeta();
  const shard = parseInt(gid, 16) % meta.num_shards;
  shardCache[shard] ??= getJson(`cards/${shard}.json`);
  return shardCache[shard];
}

export async function getCard(gid) {
  const shard = await getShard(gid);
  const card = shard[gid];
  if (!card) throw new Error(`card ${gid} not found`);
  return card;
}

export async function getCards(gids) {
  return Promise.all(gids.map((g) => getCard(g).catch(() => null)));
}

const histCache = {};

// Full dated history ([daysSinceEpoch, price] pairs) — separate shards,
// fetched only when a long chart range is opened.
export async function getHistory(gid) {
  const meta = await getMeta();
  const shard = parseInt(gid, 16) % meta.num_shards;
  histCache[shard] ??= getJson(`hist/${shard}.json`);
  const payload = await histCache[shard];
  return payload[gid] || [];
}

export function getSealed() {
  return getJson("sealed.json");
}
