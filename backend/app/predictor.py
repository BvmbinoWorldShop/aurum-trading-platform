"""Prediction engine.

Approach (used by professional quant desks, adapted for retail):
  * Stationary technical features (momentum, trend, volatility, volume).
  * Triple-barrier labelling: a sample is a "win" only if price hits the
    take-profit barrier BEFORE the stop-loss barrier within N bars.
  * Gradient-boosted trees, validated with purged walk-forward splits
    (no look-ahead leakage), then probability-calibrated so that
    "confidence 0.80" really means ~80% historical hit rate.
  * A trade is only proposed when the calibrated probability clears the
    user's minimum-confidence gate.  Higher gate => fewer, higher-quality trades.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import TimeSeriesSplit

from .indicators import atr, ema, features, rsi, adx

MIN_BARS = 400


def barrier_labels(df: pd.DataFrame, a: np.ndarray, tp_atr: float, sl_atr: float, horizon: int) -> tuple[np.ndarray, np.ndarray]:
    """Return (long_win, short_win) arrays. NaN where the future is unknown."""
    close, high, low = df["close"].to_numpy(), df["high"].to_numpy(), df["low"].to_numpy()
    n = len(df)
    lw = np.full(n, np.nan)
    sw = np.full(n, np.nan)
    for i in range(n - horizon):
        e, d = close[i], a[i]
        if not np.isfinite(d) or d <= 0:
            continue
        l_tp, l_sl = e + tp_atr * d, e - sl_atr * d
        s_tp, s_sl = e - tp_atr * d, e + sl_atr * d
        lres = sres = 0.0
        ldone = sdone = False
        for j in range(i + 1, i + horizon + 1):
            if not ldone:
                if low[j] <= l_sl:        # conservative: stop checked first
                    ldone = True
                elif high[j] >= l_tp:
                    lres, ldone = 1.0, True
            if not sdone:
                if high[j] >= s_sl:
                    sdone = True
                elif low[j] <= s_tp:
                    sres, sdone = 1.0, True
            if ldone and sdone:
                break
        lw[i], sw[i] = lres, sres
    return lw, sw


@dataclass
class SideModel:
    model: HistGradientBoostingClassifier | None
    calib: LogisticRegression | None
    oos_prob: np.ndarray
    oos_label: np.ndarray
    base_rate: float

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.model is None:
            return np.full(len(X), self.base_rate)
        raw = self.model.predict_proba(X)[:, 1]
        if self.calib is None:
            return raw
        return self.calib.predict_proba(raw.reshape(-1, 1))[:, 1]

    def validated(self, thr: float) -> tuple[float | None, int]:
        """Out-of-sample hit rate of signals that cleared the threshold."""
        mask = self.oos_prob >= thr
        n = int(mask.sum())
        return (float(self.oos_label[mask].mean()) if n else None), n


def _new_gbm() -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        max_iter=250, learning_rate=0.05, max_depth=4, min_samples_leaf=30,
        l2_regularization=1.0, random_state=7,
    )


def fit_side(X: np.ndarray, y: np.ndarray, horizon: int) -> SideModel:
    base = float(y.mean()) if len(y) else 0.5
    if len(y) < 200 or y.min() == y.max():
        return SideModel(None, None, np.array([]), np.array([]), base)
    oos_raw, oos_y = [], []
    for tr, te in TimeSeriesSplit(n_splits=4, gap=horizon).split(X):
        if len(np.unique(y[tr])) < 2:
            continue
        m = _new_gbm().fit(X[tr], y[tr])
        oos_raw.append(m.predict_proba(X[te])[:, 1])
        oos_y.append(y[te])
    model = _new_gbm().fit(X, y)
    calib = None
    oos_p = np.array([])
    oos_l = np.array([])
    if oos_raw:
        r, l = np.concatenate(oos_raw), np.concatenate(oos_y)
        if len(np.unique(l)) == 2:
            calib = LogisticRegression().fit(r.reshape(-1, 1), l)
            oos_p = calib.predict_proba(r.reshape(-1, 1))[:, 1]
            oos_l = l
    return SideModel(model, calib, oos_p, oos_l, base)


@dataclass
class Signal:
    symbol: str
    timeframe: str
    price: float
    direction: str            # LONG | SHORT | FLAT
    confidence: float
    p_long: float
    p_short: float
    stop: float | None
    take_profit: float | None
    atr: float
    validated_win_rate: float | None
    validated_trades: int
    base_rate: float
    regime: str
    reasons: list[str] = field(default_factory=list)
    generated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


_cache: dict[tuple, tuple[float, SideModel, SideModel]] = {}
MODEL_TTL = 1800


def _prepare(df: pd.DataFrame, tp_atr: float, sl_atr: float, horizon: int):
    feats = features(df)
    a = atr(df).to_numpy()
    lw, sw = barrier_labels(df, a, tp_atr, sl_atr, horizon)
    return feats, a, lw, sw


def train_models(df: pd.DataFrame, tp_atr: float, sl_atr: float, horizon: int) -> tuple[SideModel, SideModel]:
    feats, _, lw, sw = _prepare(df, tp_atr, sl_atr, horizon)
    valid = feats.notna().all(axis=1).to_numpy() & np.isfinite(lw)
    X = feats.to_numpy()[valid]
    return fit_side(X, lw[valid].astype(int), horizon), fit_side(X, sw[valid].astype(int), horizon)


def generate_signal(
    symbol: str, timeframe: str, df: pd.DataFrame, *, min_confidence: float, tp_atr: float,
    sl_atr: float, horizon: int, allow_short: bool,
) -> Signal:
    if len(df) < MIN_BARS:
        raise ValueError(f"Not enough history for {symbol}: {len(df)} bars (need {MIN_BARS})")
    key = (symbol, timeframe, tp_atr, sl_atr, horizon)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < MODEL_TTL:
        long_m, short_m = hit[1], hit[2]
    else:
        long_m, short_m = train_models(df, tp_atr, sl_atr, horizon)
        _cache[key] = (time.time(), long_m, short_m)

    feats = features(df)
    last = feats.iloc[[-1]].fillna(0).to_numpy()
    p_long = float(long_m.predict(last)[0])
    p_short = float(short_m.predict(last)[0]) if allow_short else 0.0

    close = df["close"]
    price = float(close.iloc[-1])
    a = float(atr(df).iloc[-1])
    r = float(rsi(close).iloc[-1])
    ad = float(adx(df).iloc[-1])
    e50, e200 = float(ema(close, 50).iloc[-1]), float(ema(close, 200).iloc[-1])
    regime = "trending" if ad >= 25 else "ranging"

    reasons = [
        f"Trend: price {'above' if price > e200 else 'below'} EMA200, EMA50 {'>' if e50 > e200 else '<'} EMA200",
        f"Momentum: RSI {r:.0f}, ADX {ad:.0f} ({regime})",
        f"Volatility: ATR {a / price * 100:.2f}% of price",
        f"Model: P(long wins)={p_long:.0%}" + (f", P(short wins)={p_short:.0%}" if allow_short else " (shorts disabled)"),
    ]

    direction, conf, stop, tp, side_model = "FLAT", max(p_long, p_short), None, None, None
    if p_long >= min_confidence and p_long >= p_short:
        direction, conf, side_model = "LONG", p_long, long_m
        stop, tp = price - sl_atr * a, price + tp_atr * a
    elif allow_short and p_short >= min_confidence:
        direction, conf, side_model = "SHORT", p_short, short_m
        stop, tp = price + sl_atr * a, price - tp_atr * a
    else:
        reasons.append(f"No trade: confidence below your {min_confidence:.0%} gate")

    vm = side_model or (long_m if p_long >= p_short else short_m)
    vwr, vn = vm.validated(min_confidence)
    return Signal(
        symbol=symbol, timeframe=timeframe, price=price, direction=direction, confidence=round(conf, 4),
        p_long=round(p_long, 4), p_short=round(p_short, 4), stop=stop, take_profit=tp, atr=a,
        validated_win_rate=vwr, validated_trades=vn, base_rate=round(vm.base_rate, 4), regime=regime,
        reasons=reasons,
    )
