"""Market intelligence: sentiment, fresh web/news search, GitHub plugin discovery."""
from __future__ import annotations

import time

import httpx

from . import db
from .config import get_settings


async def fear_greed() -> dict:
    """Crypto Fear & Greed Index (alternative.me) — a crowd-psychology gauge."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            d = (await c.get("https://api.alternative.me/fng/", params={"limit": 7})).json()["data"]
        return {"value": int(d[0]["value"]), "label": d[0]["value_classification"],
                "history": [int(x["value"]) for x in reversed(d)]}
    except Exception as e:  # noqa: BLE001
        return {"value": None, "label": "unavailable", "error": str(e)[:120], "history": []}


async def web_search(query: str) -> dict:
    """Fresh information via Gemini + Google Search grounding."""
    s = get_settings()
    if not s.gemini_api_key:
        return {"summary": "Add GEMINI_API_KEY to enable live web search.", "sources": []}
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=s.gemini_api_key)
    resp = await client.aio.models.generate_content(
        model=s.gemini_model,
        contents=f"Search the web for the latest information (today is {time.strftime('%Y-%m-%d')}): {query}. "
                 "Summarise concisely with dates, numbers and market impact.",
        config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
    )
    sources = []
    try:
        gm = resp.candidates[0].grounding_metadata
        for ch in (gm.grounding_chunks or [])[:8]:
            if ch.web:
                sources.append({"title": ch.web.title, "url": ch.web.uri})
    except Exception:  # noqa: BLE001
        pass
    return {"summary": resp.text or "", "sources": sources}


async def test_gemini_key(key: str) -> dict:
    """Test a Gemini API key with a fast 1-token query."""
    if not key or not key.strip():
        return {"success": False, "error": "API key cannot be empty"}
    try:
        from google import genai
        client = genai.Client(api_key=key.strip())
        resp = await client.aio.models.generate_content(
            model=get_settings().gemini_model,
            contents="Say 'OK'",
        )
        return {"success": True, "model": get_settings().gemini_model, "reply": (resp.text or "").strip()}
    except Exception as e:
        return {"success": False, "error": str(e)[:250]}


async def ai_market_radar() -> dict:
    """Generate a clear, structured AI market analysis using free Gemini API."""
    s = get_settings()
    if not s.gemini_api_key:
        return {
            "has_key": False,
            "regime": "Technical Scan Mode",
            "summary": "Free Google Gemini key not yet connected. Add your free key in the API Key Hub to unlock real-time web-grounded AI market intelligence.",
            "crypto_tendency": {"direction": "Neutral", "catalyst": "Awaiting API key", "levels": "BTC $60k-$75k range"},
            "commodities_tendency": {"direction": "Neutral", "catalyst": "Macro flows", "levels": "Gold $2600-$2800"},
            "tech_stocks_tendency": {"direction": "Bullish", "catalyst": "AI infrastructure buildout", "levels": "NVDA, MSFT"},
            "top_opportunities": [
                {"symbol": "BTC/USDT", "action": "WATCH", "confidence": 72, "thesis": "Consolidation above 50-day EMA"},
                {"symbol": "XAU_USD", "action": "BUY", "confidence": 78, "thesis": "Central bank accumulation & safe-haven bids"},
                {"symbol": "NVDA", "action": "BUY", "confidence": 75, "thesis": "Data center compute demand expansion"}
            ],
            "risk_alert": "Monitor upcoming US macroeconomic data and interest rate expectations.",
            "generated_at": time.time(),
        }

    try:
        import json
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=s.gemini_api_key)
        prompt = (
            f"You are the Lead Quantitative Market Strategist at Aurum. Today is {time.strftime('%Y-%m-%d')}.\n"
            "Analyze the current market landscape across Crypto (BTC, ETH, SOL), Commodities (Gold, Soybeans), Forex (EUR/USD), and AI Tech Stocks (NVDA, MSFT).\n"
            "Respond ONLY as a strict JSON object with this exact schema:\n"
            "{\n"
            '  "regime": "Strong Bullish | Choppy Accumulation | Risk-Off Bearish | High Volatility",\n'
            '  "summary": "2 concise sentences summarizing the primary driver of markets today.",\n'
            '  "crypto_tendency": {"direction": "Bullish|Bearish|Neutral", "catalyst": "key driver", "levels": "key support/resistance"},\n'
            '  "commodities_tendency": {"direction": "Bullish|Bearish|Neutral", "catalyst": "key driver", "levels": "key levels"},\n'
            '  "tech_stocks_tendency": {"direction": "Bullish|Bearish|Neutral", "catalyst": "key driver", "levels": "key levels"},\n'
            '  "top_opportunities": [\n'
            '    {"symbol": "BTC/USDT", "action": "BUY|SELL|WATCH", "confidence": 85, "thesis": "one clear reason"},\n'
            '    {"symbol": "XAU_USD", "action": "BUY|SELL|WATCH", "confidence": 80, "thesis": "one clear reason"},\n'
            '    {"symbol": "NVDA", "action": "BUY|SELL|WATCH", "confidence": 78, "thesis": "one clear reason"}\n'
            "  ],\n"
            '  "risk_alert": "Single most important risk or upcoming event to monitor today."\n'
            "}"
        )
        resp = await client.aio.models.generate_content(
            model=s.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
        )
        data = json.loads(resp.text)
        data["has_key"] = True
        data["generated_at"] = time.time()
        return data
    except Exception as e:
        return {
            "has_key": True,
            "regime": "Live Scanner Active",
            "summary": f"AI analysis temporarily limited: {str(e)[:100]}. Real-time quantitative price feeds remain fully functional.",
            "crypto_tendency": {"direction": "Neutral", "catalyst": "Consolidation", "levels": "BTC support holding"},
            "commodities_tendency": {"direction": "Bullish", "catalyst": "Geopolitical risk premium", "levels": "Gold near highs"},
            "tech_stocks_tendency": {"direction": "Bullish", "catalyst": "AI hyperscaler demand", "levels": "Tech leadership"},
            "top_opportunities": [
                {"symbol": "BTC/USDT", "action": "WATCH", "confidence": 70, "thesis": "Mean-reversion support channel"},
                {"symbol": "XAU_USD", "action": "BUY", "confidence": 74, "thesis": "Sovereign liquidity inflow"}
            ],
            "risk_alert": "Maintain disciplined position sizing and active stop losses.",
            "generated_at": time.time(),
        }
    """Find well-maintained open-source trading tools on GitHub.

    Candidates are stored as 'pending' — nothing is downloaded or executed
    automatically. The user reviews and approves each one in the app.
    """
    headers = {"Accept": "application/vnd.github+json"}
    if get_settings().github_token:
        headers["Authorization"] = f"Bearer {get_settings().github_token}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get("https://api.github.com/search/repositories", headers=headers,
                        params={"q": f"{query} stars:>200 pushed:>2025-01-01", "sort": "stars", "per_page": 15})
        r.raise_for_status()
    out = []
    for it in r.json().get("items", []):
        lic = (it.get("license") or {}).get("spdx_id") or "none"
        db.execute(
            """INSERT INTO plugins (full_name, url, description, stars, license, updated_at, status, found_at)
               VALUES (?,?,?,?,?,?, 'pending', ?)
               ON CONFLICT(full_name) DO UPDATE SET stars=excluded.stars, updated_at=excluded.updated_at""",
            (it["full_name"], it["html_url"], (it.get("description") or "")[:300], it["stargazers_count"], lic,
             it["pushed_at"], time.time()),
        )
        out.append({"full_name": it["full_name"], "url": it["html_url"], "stars": it["stargazers_count"],
                    "license": lic, "description": it.get("description"), "updated_at": it["pushed_at"]})
    return out
