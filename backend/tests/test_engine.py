import numpy as np
import pandas as pd
import pytest

from app.indicators import rsi, atr, adx, ema, features
from app.predictor import barrier_labels, fit_side, train_models, generate_signal
from app.backtest import run_backtest


def _synthetic_ohlcv(n: int = 500) -> pd.DataFrame:
    np.random.seed(42)
    dates = pd.date_range("2025-01-01", periods=n, freq="h", tz="UTC")
    steps = np.random.normal(loc=0.0005, scale=0.015, size=n)
    price = 100 * np.exp(np.cumsum(steps))

    high = price * (1 + np.random.uniform(0.001, 0.01, size=n))
    low = price * (1 - np.random.uniform(0.001, 0.01, size=n))
    open_p = (price + np.roll(price, 1)) / 2
    open_p[0] = price[0]
    vol = np.random.uniform(100, 1000, size=n)

    df = pd.DataFrame(
        {"open": open_p, "high": high, "low": low, "close": price, "volume": vol},
        index=dates,
    )
    return df


def test_indicators():
    df = _synthetic_ohlcv(100)
    r = rsi(df["close"])
    assert len(r) == 100
    assert 0 <= r.iloc[-1] <= 100

    a = atr(df)
    assert len(a) == 100
    assert a.iloc[-1] > 0

    ad = adx(df)
    assert len(ad) == 100

    feats = features(df)
    assert "rsi" in feats.columns
    assert "bb_pctb" in feats.columns
    assert "dist_ema200" in feats.columns


def test_predictor_and_barrier_labels():
    df = _synthetic_ohlcv(500)
    a = atr(df).to_numpy()
    lw, sw = barrier_labels(df, a, tp_atr=1.5, sl_atr=1.5, horizon=12)

    assert len(lw) == 500
    # Last 12 bars should be NaN because horizon extends into the future
    assert np.isnan(lw[-1])
    # Known bars should be 0.0 or 1.0
    known = lw[:400]
    assert set(np.unique(known)).issubset({0.0, 1.0})

    sig = generate_signal(
        symbol="BTC/USDT",
        timeframe="1h",
        df=df,
        min_confidence=0.60,
        tp_atr=1.5,
        sl_atr=1.5,
        horizon=12,
        allow_short=True,
    )
    assert sig.symbol == "BTC/USDT"
    assert sig.direction in ("LONG", "SHORT", "FLAT")
    assert 0.0 <= sig.confidence <= 1.0
    assert len(sig.reasons) > 0


def test_backtest_engine():
    df = _synthetic_ohlcv(500)
    res = run_backtest(
        df,
        asset_class="crypto",
        min_confidence=0.55,
        tp_atr=1.5,
        sl_atr=1.5,
        horizon=12,
        allow_short=False,
        risk_per_trade_pct=1.0,
    )
    assert "bars_tested" in res
    assert "total_return_pct" in res
    assert "max_drawdown_pct" in res
    assert isinstance(res["equity_curve"], list)
