"""Learning Academy content."""

LESSONS = [
    {"id": "basics-1", "track": "Foundations", "level": "Beginner", "minutes": 5, "icon": "school",
     "title": "How markets really move",
     "body": "Prices move when buyers and sellers disagree about value. Liquidity, news and positioning drive short-term moves; "
             "macro (interest rates, inflation, growth) drives long-term trends.\n\nKey idea: you don't need to predict every move — "
             "you need an edge that is positive on average and risk control that keeps you in the game."},
    {"id": "risk-1", "track": "Risk", "level": "Beginner", "minutes": 6, "icon": "shield-checkmark",
     "title": "The 1% rule & position sizing",
     "body": "Risk a small, fixed % of your account per trade (typically 0.5–2%).\n\nPosition size = (Equity × Risk%) ÷ |Entry − Stop|.\n\n"
             "With 1% risk, 10 losses in a row cost ~10% — survivable. With 10% risk, the same streak wipes out 65%. "
             "Aurum's risk manager applies this formula to every trade automatically."},
    {"id": "risk-2", "track": "Risk", "level": "Intermediate", "minutes": 7, "icon": "analytics",
     "title": "Win rate vs. risk/reward (the truth about 89%)",
     "body": "Expectancy = WinRate × AvgWin − LossRate × AvgLoss.\n\nA 90% win rate that wins $1 and loses $10 LOSES money. "
             "A 40% win rate that wins $3 and loses $1 is very profitable.\n\nYou can raise win rate by using closer targets and wider stops, "
             "or a stricter confidence gate — but that lowers payoff or trade frequency. Judge a strategy by profit factor, drawdown and expectancy, "
             "measured out-of-sample."},
    {"id": "ta-1", "track": "Technical Analysis", "level": "Beginner", "minutes": 8, "icon": "trending-up",
     "title": "Trend, momentum & volatility",
     "body": "• Trend: EMA 50/200 — price above a rising EMA200 = bullish regime.\n• Momentum: RSI (overbought >70, oversold <30), MACD histogram.\n"
             "• Trend strength: ADX >25 = trending, <20 = ranging.\n• Volatility: ATR sets realistic stops — Aurum places stops at a multiple of ATR."},
    {"id": "ai-1", "track": "AI & Quant", "level": "Intermediate", "minutes": 8, "icon": "hardware-chip",
     "title": "How Aurum's AI predicts",
     "body": "1. Builds 18 features (returns, RSI, MACD, Bollinger, ATR, ADX, EMA distances, volume).\n"
             "2. Labels history with the triple-barrier method: did price hit the target before the stop?\n"
             "3. Trains gradient-boosted trees with purged walk-forward validation (no peeking at the future).\n"
             "4. Calibrates probabilities so 'confidence 75%' ≈ 75% historical hit rate.\n"
             "5. Gemini checks fresh news for event risk before autopilot trades."},
    {"id": "ai-2", "track": "AI & Quant", "level": "Advanced", "minutes": 6, "icon": "flask",
     "title": "Overfitting: why backtests lie",
     "body": "A strategy tuned until the backtest looks perfect usually fails live. Defences: out-of-sample testing, walk-forward retraining, "
             "realistic fees/slippage, enough trades (>100) and skepticism toward any curve that only goes up."},
    {"id": "psy-1", "track": "Psychology", "level": "Beginner", "minutes": 6, "icon": "happy",
     "title": "Fear, greed & FOMO",
     "body": "Most retail losses are behavioral: chasing pumps (FOMO), cutting winners early (fear), holding losers (loss aversion), "
             "doubling down after a loss (revenge trading).\n\nCure: a written plan, fixed risk, automatic stops, and letting the system execute."},
    {"id": "psy-2", "track": "Psychology", "level": "Intermediate", "minutes": 5, "icon": "pulse",
     "title": "Reading crowd sentiment",
     "body": "The Fear & Greed index measures crowd emotion. Extreme fear often coincides with bottoms, extreme greed with tops — "
             "but extremes can persist. Use sentiment as a filter, not a trigger."},
    {"id": "mk-1", "track": "Markets", "level": "Beginner", "minutes": 7, "icon": "globe",
     "title": "Crypto, forex, gold, soybeans & AI stocks",
     "body": "• Crypto: 24/7, high volatility, driven by liquidity & flows.\n• Forex: most liquid market; driven by rate differentials.\n"
             "• Gold: safe haven, inverse to real yields & USD.\n• Soybeans: seasonal, weather, China demand.\n"
             "• AI stocks: earnings, capex cycles, rates. Each needs different risk settings."},
    {"id": "mk-2", "track": "Markets", "level": "Advanced", "minutes": 6, "icon": "key",
     "title": "API keys & account security",
     "body": "Create exchange API keys with trading enabled and WITHDRAWALS DISABLED. Restrict keys to your server's IP. "
             "Never share keys, and keep them only in the backend .env file — the mobile app never stores exchange keys."},
]
