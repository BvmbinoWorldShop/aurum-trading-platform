"""SQLite persistence: trades journal, runtime settings, plugins, activity log."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from typing import Any

from .config import get_settings

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

DEFAULT_RUNTIME: dict[str, Any] = {
    "autopilot_armed": False,
    "kill_switch": False,
    "risk_per_trade_pct": 1.0,      # % of equity risked per trade (distance entry->stop)
    "max_daily_loss_pct": 3.0,      # autopilot halts for the day after this drawdown
    "max_open_positions": 3,
    "max_position_pct": 20.0,       # max notional of a single position, % of equity
    "min_confidence": 0.70,         # calibrated probability required to trade
    "tp_atr": 1.5,                  # take-profit distance in ATR multiples
    "sl_atr": 1.5,                  # stop-loss distance in ATR multiples
    "horizon_bars": 24,             # max holding time in bars
    "ai_veto": True,                # let Gemini veto trades based on fresh news
    "watchlist": [
        {"symbol": "BTC/USDT", "asset_class": "crypto", "broker": "binance", "yf": "BTC-USD", "name": "Bitcoin"},
        {"symbol": "ETH/USDT", "asset_class": "crypto", "broker": "binance", "yf": "ETH-USD", "name": "Ethereum"},
        {"symbol": "SOL/USDT", "asset_class": "crypto", "broker": "binance", "yf": "SOL-USD", "name": "Solana"},
        {"symbol": "EUR_USD", "asset_class": "forex", "broker": "oanda", "yf": "EURUSD=X", "name": "Euro / Dollar"},
        {"symbol": "XAU_USD", "asset_class": "commodity", "broker": "oanda", "yf": "GC=F", "name": "Gold"},
        {"symbol": "SOYBN_USD", "asset_class": "commodity", "broker": "oanda", "yf": "ZS=F", "name": "Soybeans"},
        {"symbol": "NVDA", "asset_class": "stock", "broker": "alpaca", "yf": "NVDA", "name": "NVIDIA"},
        {"symbol": "MSFT", "asset_class": "stock", "broker": "alpaca", "yf": "MSFT", "name": "Microsoft"},
    ],
}


def conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(get_settings().db_path, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _init(_conn)
    return _conn


def _init(c: sqlite3.Connection) -> None:
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT, asset_class TEXT, broker TEXT, side TEXT,
            qty REAL, entry REAL, stop REAL, take_profit REAL,
            exit REAL, pnl REAL, status TEXT, confidence REAL,
            source TEXT, reasons TEXT, broker_order_id TEXT,
            opened_at REAL, closed_at REAL, close_reason TEXT
        );
        CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS plugins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT UNIQUE, url TEXT, description TEXT, stars INTEGER,
            license TEXT, updated_at TEXT, status TEXT, found_at REAL
        );
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, level TEXT, message TEXT
        );
        """
    )
    c.commit()


def execute(sql: str, params: tuple = ()) -> int:
    with _lock:
        cur = conn().execute(sql, params)
        conn().commit()
        return cur.lastrowid or 0


def get_kv(k: str, default: Any = None) -> Any:
    rows = query("SELECT v FROM kv WHERE k=?", (k,))
    if rows:
        try:
            return json.loads(rows[0]["v"])
        except Exception:
            return rows[0]["v"]
    return default


def set_kv(k: str, v: Any) -> None:
    execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, json.dumps(v)))


def query(sql: str, params: tuple = ()) -> list[dict]:
    with _lock:
        return [dict(r) for r in conn().execute(sql, params).fetchall()]


# ---------------- runtime settings ----------------
def get_runtime() -> dict[str, Any]:
    rows = query("SELECT k, v FROM kv")
    data = dict(DEFAULT_RUNTIME)
    for r in rows:
        data[r["k"]] = json.loads(r["v"])
    return data


def update_runtime(patch: dict[str, Any]) -> dict[str, Any]:
    for k, v in patch.items():
        if k in DEFAULT_RUNTIME:
            execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, json.dumps(v)))
    return get_runtime()


def log(message: str, level: str = "info") -> None:
    execute("INSERT INTO activity (ts, level, message) VALUES (?, ?, ?)", (time.time(), level, message))
