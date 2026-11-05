"""Technical indicators (pure pandas, no TA-Lib dependency)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    up = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    down = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = up / down.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    prev = df["close"].shift()
    tr = pd.concat([df["high"] - df["low"], (df["high"] - prev).abs(), (df["low"] - prev).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean()


def adx(df: pd.DataFrame, n: int = 14) -> pd.Series:
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)
    a = atr(df, n).replace(0, np.nan)
    plus_di = 100 * pd.Series(plus_dm, index=df.index).ewm(alpha=1 / n, adjust=False).mean() / a
    minus_di = 100 * pd.Series(minus_dm, index=df.index).ewm(alpha=1 / n, adjust=False).mean() / a
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return dx.ewm(alpha=1 / n, adjust=False).mean().fillna(0)


def features(df: pd.DataFrame) -> pd.DataFrame:
    """Build a stationary feature matrix from OHLCV data."""
    c = df["close"]
    f = pd.DataFrame(index=df.index)
    for k in (1, 3, 6, 12, 24):
        f[f"ret_{k}"] = c.pct_change(k)
    f["rsi"] = rsi(c) / 100
    macd = ema(c, 12) - ema(c, 26)
    f["macd_hist"] = (macd - ema(macd, 9)) / c
    mid = c.rolling(20).mean()
    sd = c.rolling(20).std()
    f["bb_pctb"] = (c - (mid - 2 * sd)) / (4 * sd).replace(0, np.nan)
    f["bb_width"] = 4 * sd / mid
    a = atr(df)
    f["atr_pct"] = a / c
    f["adx"] = adx(df) / 100
    f["dist_ema20"] = c / ema(c, 20) - 1
    f["dist_ema50"] = c / ema(c, 50) - 1
    f["dist_ema200"] = c / ema(c, 200) - 1
    lo, hi = df["low"].rolling(14).min(), df["high"].rolling(14).max()
    f["stoch"] = (c - lo) / (hi - lo).replace(0, np.nan)
    vol = df["volume"].replace(0, np.nan)
    f["vol_z"] = ((vol - vol.rolling(50).mean()) / vol.rolling(50).std()).fillna(0)
    f["volatility_24"] = c.pct_change().rolling(24).std()
    return f.replace([np.inf, -np.inf], np.nan)
