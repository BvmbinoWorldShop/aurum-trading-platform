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


async def discover_github(query: str = "crypto trading bot strategy") -> list[dict]:
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
