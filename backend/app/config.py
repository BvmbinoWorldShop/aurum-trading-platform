"""Central configuration loaded from environment variables / .env file."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Security: the mobile app must send this token in the X-App-Token header
    app_token: str = "change-me"

    # --- Trading mode
    # "live"  -> orders go to the real broker accounts configured below
    # "paper" -> orders are simulated internally (no keys needed)
    trading_mode: Literal["live", "paper"] = "paper"
    paper_starting_balance: float = 10_000.0

    # --- Binance (crypto) via CCXT
    binance_api_key: str = ""
    binance_api_secret: str = ""
    binance_testnet: bool = False
    crypto_quote: str = "USDT"

    # --- OANDA (forex, gold, soybeans, other commodities/CFDs)
    oanda_api_key: str = ""
    oanda_account_id: str = ""
    oanda_practice: bool = True

    # --- Alpaca (US stocks / AI companies)
    alpaca_api_key: str = ""
    alpaca_api_secret: str = ""
    alpaca_paper: bool = True

    # --- Interactive Brokers (needs TWS or IB Gateway running + `pip install ib_async`)
    ibkr_enabled: bool = False
    ibkr_host: str = "127.0.0.1"
    ibkr_port: int = 7497
    ibkr_client_id: int = 17

    # --- Google Gemini (AI agent)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    # --- GitHub (optional token raises API rate limits for plugin discovery)
    github_token: str = ""

    # --- Engine
    timeframe: str = "1h"
    scan_interval_sec: int = 300
    db_path: str = "trading.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
