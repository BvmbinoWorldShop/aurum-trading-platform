"""Performance statistics from the trade journal."""
from __future__ import annotations

from . import db


def performance() -> dict:
    closed = db.query("SELECT pnl, confidence, closed_at FROM trades WHERE status='closed' ORDER BY closed_at")
    n = len(closed)
    wins = [t for t in closed if (t["pnl"] or 0) > 0]
    gp = sum(t["pnl"] for t in wins)
    gl = -sum(t["pnl"] for t in closed if (t["pnl"] or 0) <= 0)
    cum, curve = 0.0, []
    for t in closed:
        cum += t["pnl"] or 0
        curve.append(round(cum, 2))
    return {
        "closed_trades": n,
        "win_rate": round(len(wins) / n, 4) if n else None,
        "net_pnl": round(sum(t["pnl"] or 0 for t in closed), 2),
        "profit_factor": round(gp / gl, 3) if gl > 0 else None,
        "pnl_curve": curve[-100:],
        "open_trades": db.query("SELECT COUNT(*) AS c FROM trades WHERE status='open'")[0]["c"],
    }
