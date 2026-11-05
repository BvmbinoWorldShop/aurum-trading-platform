"""Aurum AI agent — Gemini with tools for markets, risk and trading psychology."""
from __future__ import annotations

import json
import time
from typing import Any

from . import db
from .config import get_settings

SYSTEM_PROMPT = """You are AURUM, an elite AI trading analyst and coach inside a premium trading app.
Expertise: crypto, forex, commodities (gold, soybeans, oil), equities (especially AI companies),
technical analysis, quantitative models, macroeconomics, on-chain data, risk management and
human/trading psychology (fear, greed, FOMO, loss aversion, revenge trading, overconfidence).

Rules:
- Use your tools to fetch REAL data (prices, model signals, backtests, news, sentiment, portfolio) before
  giving opinions. Never invent numbers.
- Always quantify risk: stop-loss, position size, risk/reward, and what invalidates the idea.
- Be honest: no strategy wins every trade and no one can guarantee a win rate. Report the model's
  validated (out-of-sample) hit rate and sample size, and say when the evidence is thin.
- Coach the user's psychology when you detect emotional decisions; protect capital first.
- Only call place_trade when the user explicitly asks you to execute a specific trade.
- Be concise, structured, and use short bullet points. Today's date: {date}.
"""

_sessions: dict[str, list] = {}


def _decls():
    from google.genai import types

    S = types.Schema
    obj = lambda props=None, req=None: S(type="OBJECT", properties=props or {}, required=req or [])  # noqa: E731
    sym = {"symbol": S(type="STRING", description="Watchlist symbol, e.g. BTC/USDT, XAU_USD, EUR_USD, NVDA")}
    return [types.Tool(function_declarations=[
        types.FunctionDeclaration(name="get_market_overview", description="Live prices and 24h change for the whole watchlist", parameters=obj()),
        types.FunctionDeclaration(name="get_signal", description="Run the ML prediction model on a symbol: direction, calibrated confidence, stop, target, validated hit rate", parameters=obj(sym, ["symbol"])),
        types.FunctionDeclaration(name="run_backtest", description="Walk-forward backtest of the model on a symbol (win rate, profit factor, drawdown)", parameters=obj(sym, ["symbol"])),
        types.FunctionDeclaration(name="search_web", description="Search the internet for fresh news, macro events, earnings, regulation", parameters=obj({"query": S(type="STRING")}, ["query"])),
        types.FunctionDeclaration(name="get_sentiment", description="Crypto Fear & Greed index (crowd psychology)", parameters=obj()),
        types.FunctionDeclaration(name="get_portfolio", description="Balances across brokers, open trades, performance stats and risk settings", parameters=obj()),
        types.FunctionDeclaration(name="discover_github_tools", description="Find reputable open-source trading tools/strategies on GitHub (saved for the user to review; nothing is installed)", parameters=obj({"query": S(type="STRING")}, ["query"])),
        types.FunctionDeclaration(name="place_trade", description="Execute the model's current signal on a symbol through the risk manager. ONLY when the user explicitly asks.", parameters=obj(sym, ["symbol"])),
    ])]


async def _call_tool(name: str, args: dict[str, Any]) -> Any:
    from . import engine, intel, market_data, stats
    from .backtest import run_backtest

    rt = db.get_runtime()
    if name == "get_market_overview":
        out = []
        for a in rt["watchlist"]:
            try:
                q = await market_data.get_quote(a)
                out.append({k: q[k] for k in ("symbol", "name", "price", "change_24h_pct")})
            except Exception as e:  # noqa: BLE001
                out.append({"symbol": a["symbol"], "error": str(e)[:80]})
        return out
    if name == "get_signal":
        return (await engine.compute_signal(engine.find_asset(args["symbol"]), rt)).to_dict()
    if name == "run_backtest":
        a = engine.find_asset(args["symbol"])
        df = await market_data.get_ohlcv(a)
        r = run_backtest(df, asset_class=a["asset_class"], min_confidence=rt["min_confidence"], tp_atr=rt["tp_atr"],
                         sl_atr=rt["sl_atr"], horizon=rt["horizon_bars"], allow_short=a["asset_class"] != "crypto",
                         risk_per_trade_pct=rt["risk_per_trade_pct"])
        r.pop("equity_curve", None)
        return r
    if name == "search_web":
        return await intel.web_search(args["query"])
    if name == "get_sentiment":
        return await intel.fear_greed()
    if name == "get_portfolio":
        from .brokers import all_balances
        return {"balances": await all_balances(), "stats": stats.performance(),
                "open_trades": db.query("SELECT symbol, side, qty, entry, stop, take_profit FROM trades WHERE status='open'"),
                "risk": {k: rt[k] for k in ("risk_per_trade_pct", "max_daily_loss_pct", "max_open_positions", "min_confidence")}}
    if name == "discover_github_tools":
        return await intel.discover_github(args["query"])
    if name == "place_trade":
        a = engine.find_asset(args["symbol"])
        sig = await engine.compute_signal(a, rt)
        return await engine.execute(a, sig, "ai-agent")
    return {"error": f"unknown tool {name}"}


async def chat(session_id: str, message: str) -> dict:
    s = get_settings()
    if not s.gemini_api_key:
        return {"reply": "Add your GEMINI_API_KEY to backend/.env to activate the AI agent.", "tools_used": []}
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=s.gemini_api_key)
    history = _sessions.setdefault(session_id, [])
    history.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))
    config = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT.format(date=time.strftime("%Y-%m-%d")),
                                         tools=_decls(), temperature=0.4)
    used: list[str] = []
    for _ in range(6):
        resp = await client.aio.models.generate_content(model=s.gemini_model, contents=history, config=config)
        cand = resp.candidates[0].content
        history.append(cand)
        calls = resp.function_calls or []
        if not calls:
            break
        parts = []
        for fc in calls:
            used.append(fc.name)
            try:
                result = await _call_tool(fc.name, dict(fc.args or {}))
            except Exception as e:  # noqa: BLE001
                result = {"error": str(e)[:300]}
            parts.append(types.Part.from_function_response(name=fc.name, response={"result": json.loads(json.dumps(result, default=str))}))
        history.append(types.Content(role="user", parts=parts))
    del history[:-40]
    text = "".join(p.text for p in (cand.parts or []) if getattr(p, "text", None)) if cand else ""
    return {"reply": text or "I couldn't produce an answer — please try again.", "tools_used": used}


async def ai_veto(asset: dict, sig) -> dict:
    """Second opinion before autopilot executes: checks fresh news for event risk."""
    s = get_settings()
    from google import genai
    from google.genai import types

    from .intel import web_search

    try:
        news = await web_search(f"{asset.get('name', asset['symbol'])} ({asset['symbol']}) market news last 24 hours")
        client = genai.Client(api_key=s.gemini_api_key)
        prompt = (f"A quantitative model wants to open a {sig.direction} trade on {asset['symbol']} at {sig.price} "
                  f"(stop {sig.stop}, target {sig.take_profit}, confidence {sig.confidence:.0%}).\n"
                  f"Latest news:\n{news['summary'][:3000]}\n\n"
                  "Should this trade be blocked because of major event risk (e.g. imminent central-bank decision, "
                  "earnings, hack, regulation, news strongly contradicting the direction)? Answer as JSON "
                  '{"approve": true|false, "reason": "short reason"}.')
        resp = await client.aio.models.generate_content(
            model=s.gemini_model, contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1))
        return json.loads(resp.text)
    except Exception as e:  # noqa: BLE001
        db.log(f"AI veto unavailable ({e}); proceeding with risk-managed trade", "warn")
        return {"approve": True, "reason": "veto unavailable"}
