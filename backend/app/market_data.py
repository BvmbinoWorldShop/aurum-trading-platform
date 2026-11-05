"""Unified OHLCV market data.

crypto  -> Binance public API via CCXT (no keys needed)
others  -> OANDA candles when configured, otherwise Yahoo Finance (yfinance)
"""
from __future__ import annotations

import asyncio
import time

import ccxt.async_support as ccxt
import httpx
import pandas as pd

from .config import get_settings

_YF_INTERVAL = {"15m": ("15m", "55d"), "1h": ("1h", "720d"), "4h": ("1h", "720d"), "1d": ("1d", "5y")}
_OANDA_GRAN = {"15m": "M15", "1h": "H1", "4h": "H4", "1d": "D"}
_cache: dict[tuple, tuple[float, pd.DataFrame]] = {}
CACHE_TTL = 60
_public_binance: ccxt.binance | None = None


async def _binance_public() -> ccxt.binance:
    global _public_binance
    if _public_binance is None:
        _public_binance = ccxt.binance({"enableRateLimit": True})
    return _public_binance


async def close_clients() -> None:
    global _public_binance
    if _public_binance is not None:
        await _public_binance.close()
        _public_binance = None


def _frame(rows: list[list], cols=("ts", "open", "high", "low", "close", "volume")) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=list(cols))
    df["ts"] = pd.to_datetime(df["ts"], unit="ms", utc=True)
    return df.set_index("ts").astype(float)


async def _crypto(symbol: str, tf: str, limit: int) -> pd.DataFrame:
    ex = await _binance_public()
    rows: list[list] = []
    since = None
    tf_ms = ex.parse_timeframe(tf) * 1000
    since = ex.milliseconds() - limit * tf_ms
    while len(rows) < limit:
        batch = await ex.fetch_ohlcv(symbol, tf, since=since, limit=1000)
        if not batch:
            break
        rows.extend(batch)
        since = batch[-1][0] + tf_ms
        if len(batch) < 1000:
            break
    return _frame(rows[-limit:])


async def _oanda(instrument: str, tf: str, limit: int) -> pd.DataFrame:
    s = get_settings()
    host = "https://api-fxpractice.oanda.com" if s.oanda_practice else "https://api-fxtrade.oanda.com"
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{host}/v3/instruments/{instrument}/candles",
            params={"granularity": _OANDA_GRAN.get(tf, "H1"), "count": min(limit, 5000), "price": "M"},
            headers={"Authorization": f"Bearer {s.oanda_api_key}"},
        )
        r.raise_for_status()
    rows = []
    for k in r.json()["candles"]:
        if not k.get("complete", True):
            continue
        m = k["mid"]
        ts = pd.Timestamp(k["time"]).value // 10**6
        rows.append([ts, m["o"], m["h"], m["l"], m["c"], k.get("volume", 0)])
    return _frame(rows)


def _yf_sync(ticker: str, tf: str, limit: int) -> pd.DataFrame:
    import yfinance as yf

    interval, period = _YF_INTERVAL.get(tf, ("1h", "720d"))
    raw = yf.download(ticker, interval=interval, period=period, progress=False, auto_adjust=True)
    if raw is None or raw.empty:
        raise ValueError(f"No data from Yahoo Finance for {ticker}")
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    df = raw.rename(columns=str.lower)[["open", "high", "low", "close", "volume"]].astype(float)
    if tf == "4h":
        df = df.resample("4h").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}).dropna()
    return df.tail(limit)


async def get_ohlcv(asset: dict, tf: str | None = None, limit: int = 1500) -> pd.DataFrame:
    s = get_settings()
    tf = tf or s.timeframe
    key = (asset["symbol"], tf, limit)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    if asset["asset_class"] == "crypto":
        df = await _crypto(asset["symbol"], tf, limit)
    elif asset["broker"] == "oanda" and s.oanda_api_key:
        df = await _oanda(asset["symbol"], tf, limit)
    else:
        df = await asyncio.to_thread(_yf_sync, asset.get("yf") or asset["symbol"], tf, limit)
    _cache[key] = (time.time(), df)
    return df


async def get_quote(asset: dict) -> dict:
    df = await get_ohlcv(asset, "1h", 500)
    last, prev = float(df["close"].iloc[-1]), float(df["close"].iloc[-25]) if len(df) > 25 else float(df["close"].iloc[0])
    spark = [round(float(v), 6) for v in df["close"].tail(48).tolist()]
    return {**asset, "price": last, "change_24h_pct": round((last / prev - 1) * 100, 2), "spark": spark}
