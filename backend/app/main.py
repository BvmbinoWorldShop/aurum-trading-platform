"""Aurum backend API (FastAPI)."""
from __future__ import annotations

import asyncio
import contextlib
import secrets
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import agent, db, engine, intel, market_data, stats
from .backtest import run_backtest
from .brokers import BrokerError, all_balances, shutdown
from .config import get_settings
from .learning import LESSONS


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    db.conn()
    s = get_settings()
    if s.app_token == "change-me":
        db.log("APP_TOKEN is still 'change-me' — set a strong token in backend/.env", "warn")
    db.log(f"Backend started in {s.trading_mode.upper()} mode", "info")
    task = asyncio.create_task(engine.autopilot_loop())
    yield
    task.cancel()
    await market_data.close_clients()
    await shutdown()


app = FastAPI(title="Aurum Trading API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def auth(x_app_token: str = Header(default="")) -> None:
    if not secrets.compare_digest(x_app_token, get_settings().app_token):
        raise HTTPException(401, "Invalid app token")


def _err(e: Exception) -> HTTPException:
    return HTTPException(400, str(e))


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "mode": get_settings().trading_mode}


@app.get("/dashboard", dependencies=[Depends(auth)])
async def dashboard() -> dict:
    s, rt = get_settings(), db.get_runtime()
    balances = await all_balances()
    equity = sum(b.get("equity", 0) or 0 for b in balances if "equity" in b)
    sigs = sorted(engine.latest_signals.values(), key=lambda x: -x["confidence"])
    return {
        "mode": s.trading_mode, "equity": equity, "daily_pnl": engine.daily_pnl(), "stats": stats.performance(),
        "autopilot": {"armed": rt["autopilot_armed"], "kill_switch": rt["kill_switch"], **engine.state},
        "sentiment": await intel.fear_greed(), "top_signals": sigs[:6],
        "open_trades": db.query("SELECT * FROM trades WHERE status='open' ORDER BY opened_at DESC"),
        "ai_enabled": bool(s.gemini_api_key),
    }


@app.get("/markets", dependencies=[Depends(auth)])
async def markets() -> list[dict]:
    async def one(a):
        try:
            return await market_data.get_quote(a)
        except Exception as e:  # noqa: BLE001
            return {**a, "error": str(e)[:120]}
    return await asyncio.gather(*[one(a) for a in db.get_runtime()["watchlist"]])


@app.get("/candles", dependencies=[Depends(auth)])
async def candles(symbol: str, tf: str = "1h", limit: int = 200) -> list[dict]:
    try:
        df = await market_data.get_ohlcv(engine.find_asset(symbol), tf, max(limit, 300))
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    df = df.tail(limit)
    return [{"t": int(i.timestamp()), "o": r.open, "h": r.high, "l": r.low, "c": r.close} for i, r in df.iterrows()]


@app.get("/signals", dependencies=[Depends(auth)])
async def signal(symbol: str) -> dict:
    try:
        return (await engine.compute_signal(engine.find_asset(symbol))).to_dict()
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@app.post("/scan", dependencies=[Depends(auth)])
async def scan() -> list[dict]:
    return await engine.scan_once(trade=False)


class SymbolBody(BaseModel):
    symbol: str


@app.post("/backtest", dependencies=[Depends(auth)])
async def backtest(body: SymbolBody) -> dict:
    rt = db.get_runtime()
    try:
        a = engine.find_asset(body.symbol)
        df = await market_data.get_ohlcv(a)
        return await asyncio.to_thread(
            run_backtest, df, asset_class=a["asset_class"], min_confidence=rt["min_confidence"], tp_atr=rt["tp_atr"],
            sl_atr=rt["sl_atr"], horizon=rt["horizon_bars"], allow_short=a["asset_class"] != "crypto",
            risk_per_trade_pct=rt["risk_per_trade_pct"])
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@app.get("/trades", dependencies=[Depends(auth)])
async def trades(status: str | None = None) -> list[dict]:
    if status:
        return db.query("SELECT * FROM trades WHERE status=? ORDER BY opened_at DESC LIMIT 200", (status,))
    return db.query("SELECT * FROM trades ORDER BY opened_at DESC LIMIT 200")


@app.post("/trades/execute", dependencies=[Depends(auth)])
async def execute(body: SymbolBody) -> dict:
    try:
        a = engine.find_asset(body.symbol)
        sig = await engine.compute_signal(a)
        return await engine.execute(a, sig, "manual")
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@app.post("/trades/{trade_id}/close", dependencies=[Depends(auth)])
async def close(trade_id: int) -> dict:
    t = db.query("SELECT * FROM trades WHERE id=? AND status='open'", (trade_id,))
    if not t:
        raise HTTPException(404, "Open trade not found")
    try:
        q = await market_data.get_quote(engine.find_asset(t[0]["symbol"]))
        return await engine.close_trade(t[0], q["price"], "manual")
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@app.get("/vault", dependencies=[Depends(auth)])
async def vault() -> dict:
    balances = await all_balances()
    return {"mode": get_settings().trading_mode, "balances": balances,
            "total_equity": sum(b.get("equity", 0) or 0 for b in balances), "stats": stats.performance()}


@app.get("/settings", dependencies=[Depends(auth)])
async def get_rt() -> dict:
    return {**db.get_runtime(), "trading_mode": get_settings().trading_mode, "timeframe": get_settings().timeframe}


_LIMITS = {"risk_per_trade_pct": (0.1, 5), "max_daily_loss_pct": (0.5, 20), "max_open_positions": (1, 20),
           "max_position_pct": (1, 100), "min_confidence": (0.5, 0.99), "tp_atr": (0.3, 10), "sl_atr": (0.3, 10),
           "horizon_bars": (4, 200)}


@app.put("/settings", dependencies=[Depends(auth)])
async def put_rt(patch: dict[str, Any]) -> dict:
    patch.pop("autopilot_armed", None)  # use /autopilot
    for k, (lo, hi) in _LIMITS.items():
        if k in patch and not (lo <= float(patch[k]) <= hi):
            raise HTTPException(400, f"{k} must be between {lo} and {hi}")
    return db.update_runtime(patch)


class ArmBody(BaseModel):
    armed: bool
    confirm_live: bool = False


@app.post("/autopilot", dependencies=[Depends(auth)])
async def autopilot(body: ArmBody) -> dict:
    if body.armed and get_settings().trading_mode == "live" and not body.confirm_live:
        raise HTTPException(400, "Confirm that autopilot will trade REAL money")
    rt = db.update_runtime({"autopilot_armed": body.armed, "kill_switch": False if body.armed else db.get_runtime()["kill_switch"]})
    db.log(f"Autopilot {'ARMED' if body.armed else 'disarmed'}", "warn" if body.armed else "info")
    return rt


@app.post("/killswitch", dependencies=[Depends(auth)])
async def killswitch(close_all: bool = True) -> dict:
    db.update_runtime({"kill_switch": True, "autopilot_armed": False})
    closed, errors = [], []
    if close_all:
        for t in db.query("SELECT * FROM trades WHERE status='open'"):
            try:
                q = await market_data.get_quote(engine.find_asset(t["symbol"]))
                closed.append((await engine.close_trade(t, q["price"], "kill-switch"))["id"])
            except Exception as e:  # noqa: BLE001
                errors.append(f"{t['symbol']}: {e}")
    db.log("KILL SWITCH activated", "error")
    return {"closed": closed, "errors": errors}


class ChatBody(BaseModel):
    message: str
    session_id: str = "default"


@app.post("/agent/chat", dependencies=[Depends(auth)])
async def chat(body: ChatBody) -> dict:
    try:
        return await agent.chat(body.session_id, body.message)
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@app.get("/intel/news", dependencies=[Depends(auth)])
async def news(q: str = "crypto, forex, gold and AI stocks market news today") -> dict:
    try:
        return await intel.web_search(q)
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@app.get("/plugins", dependencies=[Depends(auth)])
async def plugins() -> list[dict]:
    return db.query("SELECT * FROM plugins ORDER BY status='pending' DESC, stars DESC")


@app.post("/plugins/discover", dependencies=[Depends(auth)])
async def discover(q: str = "crypto trading bot strategy") -> list[dict]:
    try:
        return await intel.discover_github(q)
    except Exception as e:  # noqa: BLE001
        raise _err(e)


class PluginStatus(BaseModel):
    status: str  # approved | rejected


@app.post("/plugins/{plugin_id}/status", dependencies=[Depends(auth)])
async def plugin_status(plugin_id: int, body: PluginStatus) -> dict:
    if body.status not in ("approved", "rejected", "pending"):
        raise HTTPException(400, "invalid status")
    db.execute("UPDATE plugins SET status=? WHERE id=?", (body.status, plugin_id))
    return db.query("SELECT * FROM plugins WHERE id=?", (plugin_id,))[0]


@app.get("/learn", dependencies=[Depends(auth)])
async def learn() -> list[dict]:
    return LESSONS


@app.get("/activity", dependencies=[Depends(auth)])
async def activity(limit: int = 60) -> list[dict]:
    return db.query("SELECT * FROM activity ORDER BY id DESC LIMIT ?", (limit,))


@app.exception_handler(BrokerError)
async def broker_error(_, exc: BrokerError):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"detail": str(exc)})
