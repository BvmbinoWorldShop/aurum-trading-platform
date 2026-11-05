"""Walk-forward backtester: retrains the model periodically using ONLY past data."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .indicators import atr, features
from .predictor import barrier_labels, fit_side

FEE_PCT = {"crypto": 0.10, "forex": 0.02, "commodity": 0.05, "stock": 0.02}  # round-trip %


def run_backtest(
    df: pd.DataFrame, *, asset_class: str, min_confidence: float, tp_atr: float, sl_atr: float,
    horizon: int, allow_short: bool, risk_per_trade_pct: float, retrain_every: int = 120,
) -> dict:
    feats = features(df)
    a = atr(df).to_numpy()
    lw, sw = barrier_labels(df, a, tp_atr, sl_atr, horizon)
    X_all = feats.to_numpy()
    ok = feats.notna().all(axis=1).to_numpy()
    close, high, low = df["close"].to_numpy(), df["high"].to_numpy(), df["low"].to_numpy()
    n = len(df)
    start = max(int(n * 0.5), 300)
    fee = FEE_PCT.get(asset_class, 0.1) / 100

    equity, peak, max_dd = 1.0, 1.0, 0.0
    curve: list[float] = []
    trades: list[dict] = []
    long_m = short_m = None
    i = start
    last_train = -10**9
    while i < n - 1:
        if i - last_train >= retrain_every:
            tr = np.arange(0, i - horizon)                       # purge: labels must be fully known
            mask = ok[tr] & np.isfinite(lw[tr])
            Xt = X_all[tr][mask]
            long_m = fit_side(Xt, lw[tr][mask].astype(int), horizon)
            short_m = fit_side(Xt, sw[tr][mask].astype(int), horizon) if allow_short else None
            last_train = i
        if not ok[i]:
            curve.append(equity); i += 1; continue
        x = X_all[i:i + 1]
        pl = float(long_m.predict(x)[0])
        ps = float(short_m.predict(x)[0]) if short_m else 0.0
        side = 1 if pl >= min_confidence and pl >= ps else (-1 if ps >= min_confidence else 0)
        if side == 0 or not np.isfinite(a[i]):
            curve.append(equity); i += 1; continue

        e = close[i]
        stop = e - side * sl_atr * a[i]
        tp = e + side * tp_atr * a[i]
        exit_px, j, reason = close[min(i + horizon, n - 1)], min(i + horizon, n - 1), "time"
        for k in range(i + 1, min(i + horizon, n - 1) + 1):
            if (side == 1 and low[k] <= stop) or (side == -1 and high[k] >= stop):
                exit_px, j, reason = stop, k, "stop"; break
            if (side == 1 and high[k] >= tp) or (side == -1 and low[k] <= tp):
                exit_px, j, reason = tp, k, "target"; break
        move = side * (exit_px - e) / e - fee
        r_mult = move / (sl_atr * a[i] / e)
        equity *= 1 + r_mult * risk_per_trade_pct / 100
        peak = max(peak, equity)
        max_dd = max(max_dd, 1 - equity / peak)
        trades.append({"i": int(i), "side": "LONG" if side == 1 else "SHORT", "entry": float(e),
                       "exit": float(exit_px), "r": round(float(r_mult), 3), "reason": reason, "win": move > 0})
        curve.extend([equity] * (j - i))
        i = j + 1

    wins = [t for t in trades if t["win"]]
    gp = sum(t["r"] for t in wins)
    gl = -sum(t["r"] for t in trades if not t["win"])
    step = max(1, len(curve) // 120)
    return {
        "bars_tested": n - start,
        "trades": len(trades),
        "win_rate": round(len(wins) / len(trades), 4) if trades else None,
        "profit_factor": round(gp / gl, 3) if gl > 0 else None,
        "avg_r": round(float(np.mean([t["r"] for t in trades])), 3) if trades else None,
        "total_return_pct": round((equity - 1) * 100, 2),
        "buy_hold_return_pct": round((close[-1] / close[start] - 1) * 100, 2),
        "max_drawdown_pct": round(max_dd * 100, 2),
        "equity_curve": [round(v, 4) for v in curve[::step]],
        "recent_trades": trades[-15:],
        "settings": {"min_confidence": min_confidence, "tp_atr": tp_atr, "sl_atr": sl_atr, "horizon": horizon},
    }
