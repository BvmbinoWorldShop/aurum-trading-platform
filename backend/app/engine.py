"""Risk manager, execution, position monitoring and the autonomous autopilot loop."""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone

from . import db
from .brokers import BrokerError, PaperBroker, broker_label, get_broker
from .config import get_settings
from .market_data import get_ohlcv
from .predictor import Signal, generate_signal

latest_signals: dict[str, dict] = {}
state = {"last_scan": None, "scanning": False, "last_error": None}


def find_asset(symbol: str) -> dict:
    for a in db.get_runtime()["watchlist"]:
        if a["symbol"] == symbol:
            return a
    raise KeyError(f"{symbol} is not in the watchlist")


async def compute_signal(asset: dict, rt: dict | None = None) -> Signal:
    rt = rt or db.get_runtime()
    df = await get_ohlcv(asset)
    sig = await asyncio.to_thread(
        generate_signal, asset["symbol"], get_settings().timeframe, df,
        min_confidence=rt["min_confidence"], tp_atr=rt["tp_atr"], sl_atr=rt["sl_atr"],
        horizon=rt["horizon_bars"], allow_short=asset["asset_class"] != "crypto",
    )
    latest_signals[asset["symbol"]] = {**sig.to_dict(), "name": asset.get("name"), "asset_class": asset["asset_class"]}
    return sig


# ------------------------------------------------------------------ risk
def _today_start() -> float:
    d = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return d.timestamp()


def daily_pnl() -> float:
    return db.query("SELECT COALESCE(SUM(pnl),0) AS p FROM trades WHERE status='closed' AND closed_at>=?",
                    (_today_start(),))[0]["p"]


def risk_check(asset: dict, sig: Signal, equity: float, rt: dict) -> tuple[bool, str, float]:
    if rt["kill_switch"]:
        return False, "Kill switch is active", 0
    if equity <= 0:
        return False, "Account equity is zero", 0
    if -daily_pnl() >= equity * rt["max_daily_loss_pct"] / 100:
        return False, f"Daily loss limit ({rt['max_daily_loss_pct']}%) reached — trading paused until tomorrow", 0
    open_trades = db.query("SELECT symbol FROM trades WHERE status='open'")
    if len(open_trades) >= rt["max_open_positions"]:
        return False, f"Max open positions ({rt['max_open_positions']}) reached", 0
    if any(t["symbol"] == asset["symbol"] for t in open_trades):
        return False, "Already in a position on this symbol", 0
    if sig.direction == "FLAT" or sig.stop is None:
        return False, "No qualifying signal", 0
    per_unit_risk = abs(sig.price - sig.stop)
    if per_unit_risk <= 0:
        return False, "Invalid stop distance", 0
    qty = equity * rt["risk_per_trade_pct"] / 100 / per_unit_risk
    qty = min(qty, equity * rt["max_position_pct"] / 100 / sig.price)
    return True, "ok", qty


# ------------------------------------------------------------------ execution
async def execute(asset: dict, sig: Signal, source: str) -> dict:
    rt = db.get_runtime()
    broker = get_broker(asset["broker"])
    equity = (await broker.balance())["equity"]
    ok, reason, qty = risk_check(asset, sig, equity, rt)
    if not ok:
        raise BrokerError(reason)
    side = "buy" if sig.direction == "LONG" else "sell"
    res = await broker.place(asset["symbol"], side, qty, sig.price, sig.stop, sig.take_profit)
    tid = db.execute(
        """INSERT INTO trades (symbol, asset_class, broker, side, qty, entry, stop, take_profit, status, confidence,
           source, reasons, broker_order_id, opened_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (asset["symbol"], asset["asset_class"], broker_label(asset["broker"]), sig.direction, res["qty"],
         res["fill_price"], sig.stop, sig.take_profit, "open", sig.confidence, source,
         json.dumps(sig.reasons), res["order_id"], time.time()),
    )
    db.log(f"OPENED {sig.direction} {asset['symbol']} qty={res['qty']:.6g} @ {res['fill_price']:.6g} "
           f"(conf {sig.confidence:.0%}, {source})", "trade")
    return db.query("SELECT * FROM trades WHERE id=?", (tid,))[0]


async def close_trade(trade: dict, price: float, reason: str) -> dict:
    broker = PaperBroker() if trade["broker"] == "paper" else get_broker(trade["broker"])
    exit_px = await broker.close(trade["symbol"], trade["side"], trade["qty"], price)
    direction = 1 if trade["side"] == "LONG" else -1
    pnl = (exit_px - trade["entry"]) * trade["qty"] * direction
    db.execute("UPDATE trades SET status='closed', exit=?, pnl=?, closed_at=?, close_reason=? WHERE id=?",
               (exit_px, pnl, time.time(), reason, trade["id"]))
    db.log(f"CLOSED {trade['side']} {trade['symbol']} @ {exit_px:.6g} P/L {pnl:+.2f} ({reason})", "trade")
    return db.query("SELECT * FROM trades WHERE id=?", (trade["id"],))[0]


async def monitor_open_trades() -> None:
    rt = db.get_runtime()
    for t in db.query("SELECT * FROM trades WHERE status='open'"):
        try:
            asset = find_asset(t["symbol"])
        except KeyError:
            asset = {"symbol": t["symbol"], "asset_class": t["asset_class"], "broker": t["broker"]}
        try:
            df = await get_ohlcv(asset, "1h", 500)
        except Exception as e:  # noqa: BLE001
            db.log(f"Monitor: no data for {t['symbol']}: {e}", "warn")
            continue
        since = df[df.index.map(lambda x: x.timestamp()) >= t["opened_at"] - 3600]
        last = float(df["close"].iloc[-1])
        long = t["side"] == "LONG"
        hit_stop = (since["low"] <= t["stop"]).any() if long else (since["high"] >= t["stop"]).any()
        hit_tp = (since["high"] >= t["take_profit"]).any() if long else (since["low"] <= t["take_profit"]).any()
        bar_sec = {"15m": 900, "1h": 3600, "4h": 14400, "1d": 86400}.get(get_settings().timeframe, 3600)
        expired = time.time() - t["opened_at"] > rt["horizon_bars"] * bar_sec
        try:
            if hit_stop:
                await close_trade(t, t["stop"], "stop-loss")
            elif hit_tp:
                await close_trade(t, t["take_profit"], "take-profit")
            elif expired:
                await close_trade(t, last, "time-exit")
        except Exception as e:  # noqa: BLE001
            db.log(f"Monitor: failed closing {t['symbol']}: {e}", "error")


# ------------------------------------------------------------------ autopilot
async def scan_once(trade: bool = True) -> list[dict]:
    from .agent import ai_veto  # local import to avoid cycle

    state["scanning"] = True
    rt = db.get_runtime()
    out = []
    try:
        await monitor_open_trades()
        for asset in rt["watchlist"]:
            try:
                sig = await compute_signal(asset, rt)
                out.append(latest_signals[asset["symbol"]])
                if not (trade and rt["autopilot_armed"] and not rt["kill_switch"] and sig.direction != "FLAT"):
                    continue
                if rt["ai_veto"] and get_settings().gemini_api_key:
                    verdict = await ai_veto(asset, sig)
                    if not verdict.get("approve", True):
                        db.log(f"AI vetoed {sig.direction} {asset['symbol']}: {verdict.get('reason')}", "info")
                        continue
                await execute(asset, sig, "autopilot")
            except BrokerError as e:
                db.log(f"Autopilot skipped {asset['symbol']}: {e}", "info")
            except Exception as e:  # noqa: BLE001
                db.log(f"Scan error {asset['symbol']}: {e}", "error")
        state["last_scan"] = time.time()
        state["last_error"] = None
    except Exception as e:  # noqa: BLE001
        state["last_error"] = str(e)
    finally:
        state["scanning"] = False
    return out


async def autopilot_loop() -> None:
    await asyncio.sleep(3)
    while True:
        await scan_once(trade=True)
        await asyncio.sleep(get_settings().scan_interval_sec)
