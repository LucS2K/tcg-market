"""Shared plumbing: paths, logging, HTTP session, Parquet writing."""
from __future__ import annotations

import logging
import os
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
USER_AGENT = "tcg-market-collector/0.1 (github.com/LucS2K/tcg-market)"

GAMES = ("mtg", "pokemon", "lorcana", "onepiece", "riftbound")

log = logging.getLogger("collector")


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def make_session() -> requests.Session:
    # 429 deliberately absent from status_forcelist: a daily-cap 429 must
    # fail the run, not burn budget on retries.
    retry = Retry(
        total=5,
        backoff_factor=2,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    return session


def snapshot_path(game: str, date_str: str) -> Path:
    return DATA_DIR / f"game={game}" / f"date={date_str}" / "prices.parquet"


def reference_path(game: str) -> Path:
    return DATA_DIR / "reference" / f"game={game}" / "cards.parquet"


def fnum(value) -> float | None:
    """Source APIs mix numbers, numeric strings, and null for prices."""
    if value is None or value == "":
        return None
    return float(value)


def latest_prior_partition(game: str, date_str: str) -> Path | None:
    base = DATA_DIR / f"game={game}"
    if not base.exists():
        return None
    dates = sorted(
        d.name.split("=", 1)[1]
        for d in base.iterdir()
        if d.is_dir() and d.name.startswith("date=")
    )
    dates = [d for d in dates if d < date_str]
    return snapshot_path(game, dates[-1]) if dates else None


def guard_row_count(game: str, date_str: str, out_path: Path) -> None:
    """Discard today's partition and fail loudly if it shrank suspiciously.

    A source quietly returning half its catalog would otherwise be
    committed as truth. Discarding keeps the run retryable: the next
    attempt re-collects instead of skipping a bad partition.
    """
    prior = latest_prior_partition(game, date_str)
    if prior is None:
        return
    today_rows = pq.read_metadata(out_path).num_rows
    prior_rows = pq.read_metadata(prior).num_rows
    if prior_rows and today_rows < 0.5 * prior_rows:
        out_path.unlink()
        raise RuntimeError(
            f"{game}: row count {today_rows} is less than half of {prior_rows} "
            f"({prior.parent.name}); partition discarded — source likely returned partial data"
        )


def write_partition(rows: list[dict], schema: pa.Schema, out_path: Path) -> None:
    if not rows:
        raise RuntimeError(f"refusing to write empty partition: {out_path}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pylist(rows, schema=schema)
    tmp = out_path.with_name(out_path.name + ".tmp")
    pq.write_table(table, tmp, compression="zstd")
    os.replace(tmp, out_path)
    log.info(
        "wrote %s (rows=%d, %.1f KiB)",
        out_path.relative_to(REPO_ROOT).as_posix(),
        table.num_rows,
        out_path.stat().st_size / 1024,
    )
