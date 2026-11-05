"""Broker adapters: Binance (CCXT), OANDA v20, Alpaca, Interactive Brokers, Paper."""
from __future__ import annotations

import math
import time
import uuid

import ccxt.async_support as ccxt
import httpx

from . import db
from .config import get_settings


class BrokerError(Exception):
    pass


class Broker:
    name = "base"

    @property
    def configured(self) -> bool:
        return False

    async def balance(self) -> dict: ...
    async def place(self, symbol: str, side: str, qty: float, price: float, stop: float, tp: float) -> dict: ...
    async def close(self, symbol: str, position_side: str, qty: float, price: float) -> float: ...

    def round_qty(self, symbol: str, qty: float) -> float:
        return qty


# --------------------------------------------------------------------------- paper
class PaperBroker(Broker):
    name = "paper"
    configured = True

    async def balance(self) -> dict:
        s = get_settings()
        realized = db.query("SELECT COALESCE(SUM(pnl),0) AS p FROM trades WHERE status='closed' AND broker LIKE '%paper%'")[0]["p"]
        eq = s.paper_starting_balance + realized
        return {"broker": "paper", "equity": eq, "cash": eq, "currency": "USD", "assets": []}

    async def place(self, symbol, side, qty, price, stop, tp) -> dict:
        return {"order_id": f"paper-{uuid.uuid4().hex[:10]}", "fill_price": price, "qty": qty}

    async def close(self, symbol, position_side, qty, price) -> float:
        return price


# --------------------------------------------------------------------------- binance
class BinanceBroker(Broker):
    name = "binance"

    def __init__(self) -> None:
        self._ex: ccxt.binance | None = None

    @property
    def configured(self) -> bool:
        s = get_settings()
        return bool(s.binance_api_key and s.binance_api_secret)

    async def ex(self) -> ccxt.binance:
        if self._ex is None:
            s = get_settings()
            self._ex = ccxt.binance({"apiKey": s.binance_api_key, "secret": s.binance_api_secret,
                                     "enableRateLimit": True, "options": {"defaultType": "spot"}})
            if s.binance_testnet:
                self._ex.set_sandbox_mode(True)
            await self._ex.load_markets()
        return self._ex

    async def aclose(self) -> None:
        if self._ex:
            await self._ex.close()
            self._ex = None

    async def balance(self) -> dict:
        ex = await self.ex()
        quote = get_settings().crypto_quote
        bal = await ex.fetch_balance()
        totals = {k: v for k, v in (bal.get("total") or {}).items() if v and v > 0}
        assets, equity = [], float(totals.get(quote, 0))
        others = [f"{a}/{quote}" for a in totals if a != quote and f"{a}/{quote}" in ex.markets]
        tickers = await ex.fetch_tickers(others) if others else {}
        for a, amt in totals.items():
            px = 1.0 if a == quote else float((tickers.get(f"{a}/{quote}") or {}).get("last") or 0)
            if a != quote:
                equity += amt * px
            assets.append({"asset": a, "amount": amt, "value": round(amt * px, 2)})
        assets.sort(key=lambda x: -x["value"])
        return {"broker": "binance", "equity": equity, "cash": float(totals.get(quote, 0)), "currency": quote,
                "assets": assets[:25], "testnet": get_settings().binance_testnet}

    async def place(self, symbol, side, qty, price, stop, tp) -> dict:
        if side != "buy":
            raise BrokerError("Spot crypto: short selling is disabled")
        ex = await self.ex()
        amount = float(ex.amount_to_precision(symbol, qty))
        min_cost = ((ex.markets[symbol].get("limits") or {}).get("cost") or {}).get("min") or 5
        if amount * price < min_cost:
            raise BrokerError(f"Order value {amount * price:.2f} below exchange minimum {min_cost}")
        order = await ex.create_order(symbol, "market", "buy", amount)
        filled = float(order.get("filled") or amount)
        fill_px = float(order.get("average") or price)
        # Exchange-side protective stop (survives app/server downtime)
        try:
            sell_qty = float(ex.amount_to_precision(symbol, filled * 0.999))
            await ex.create_order(symbol, "STOP_LOSS_LIMIT", "sell", sell_qty,
                                  float(ex.price_to_precision(symbol, stop * 0.995)),
                                  {"stopPrice": float(ex.price_to_precision(symbol, stop)), "timeInForce": "GTC"})
        except Exception as e:  # noqa: BLE001
            db.log(f"Binance protective stop for {symbol} failed: {e}. Bot will manage the stop.", "warn")
        return {"order_id": str(order.get("id")), "fill_price": fill_px, "qty": filled}

    async def close(self, symbol, position_side, qty, price) -> float:
        ex = await self.ex()
        try:
            await ex.cancel_all_orders(symbol)
        except Exception:  # noqa: BLE001
            pass
        base = symbol.split("/")[0]
        free = float(((await ex.fetch_balance()).get("free") or {}).get(base) or 0)
        amount = float(ex.amount_to_precision(symbol, min(qty, free)))
        if amount <= 0:
            return price  # protective stop already filled on the exchange
        order = await ex.create_order(symbol, "market", "sell", amount)
        return float(order.get("average") or price)


# --------------------------------------------------------------------------- oanda
class OandaBroker(Broker):
    name = "oanda"
    _precision: dict[str, int] = {}

    @property
    def configured(self) -> bool:
        s = get_settings()
        return bool(s.oanda_api_key and s.oanda_account_id)

    def _base(self) -> str:
        return "https://api-fxpractice.oanda.com" if get_settings().oanda_practice else "https://api-fxtrade.oanda.com"

    async def _req(self, method: str, path: str, **kw) -> dict:
        s = get_settings()
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.request(method, f"{self._base()}/v3/accounts/{s.oanda_account_id}{path}",
                                headers={"Authorization": f"Bearer {s.oanda_api_key}"}, **kw)
        if r.status_code >= 400:
            raise BrokerError(f"OANDA {r.status_code}: {r.text[:300]}")
        return r.json()

    async def _prec(self, inst: str) -> int:
        if inst not in self._precision:
            d = await self._req("GET", "/instruments", params={"instruments": inst})
            self._precision[inst] = int(d["instruments"][0]["displayPrecision"])
        return self._precision[inst]

    async def balance(self) -> dict:
        a = (await self._req("GET", "/summary"))["account"]
        return {"broker": "oanda", "equity": float(a["NAV"]), "cash": float(a["balance"]), "currency": a["currency"],
                "assets": [{"asset": "Unrealized P/L", "amount": float(a["unrealizedPL"]), "value": float(a["unrealizedPL"])}],
                "practice": get_settings().oanda_practice}

    def round_qty(self, symbol, qty) -> float:
        return float(math.floor(qty))

    async def place(self, symbol, side, qty, price, stop, tp) -> dict:
        units = int(math.floor(qty))
        if units < 1:
            raise BrokerError("Position size rounds to 0 units — increase equity or risk %")
        p = await self._prec(symbol)
        body = {"order": {"type": "MARKET", "instrument": symbol, "units": str(units if side == "buy" else -units),
                          "timeInForce": "FOK", "positionFill": "DEFAULT",
                          "stopLossOnFill": {"price": f"{stop:.{p}f}"}, "takeProfitOnFill": {"price": f"{tp:.{p}f}"}}}
        d = await self._req("POST", "/orders", json=body)
        fill = d.get("orderFillTransaction")
        if not fill:
            raise BrokerError(f"OANDA order not filled: {d.get('orderCancelTransaction', {}).get('reason', d)}")
        return {"order_id": fill["id"], "fill_price": float(fill["price"]), "qty": units}

    async def close(self, symbol, position_side, qty, price) -> float:
        key = "longUnits" if position_side == "LONG" else "shortUnits"
        try:
            d = await self._req("PUT", f"/positions/{symbol}/close", json={key: "ALL"})
        except BrokerError:
            return price  # already closed by broker-side SL/TP
        t = d.get("longOrderFillTransaction") or d.get("shortOrderFillTransaction") or {}
        return float(t.get("price") or price)


# --------------------------------------------------------------------------- alpaca
class AlpacaBroker(Broker):
    name = "alpaca"

    @property
    def configured(self) -> bool:
        s = get_settings()
        return bool(s.alpaca_api_key and s.alpaca_api_secret)

    async def _req(self, method: str, path: str, **kw) -> dict | list:
        s = get_settings()
        base = "https://paper-api.alpaca.markets" if s.alpaca_paper else "https://api.alpaca.markets"
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.request(method, base + path, headers={"APCA-API-KEY-ID": s.alpaca_api_key,
                                                              "APCA-API-SECRET-KEY": s.alpaca_api_secret}, **kw)
        if r.status_code >= 400:
            raise BrokerError(f"Alpaca {r.status_code}: {r.text[:300]}")
        return r.json() if r.content else {}

    async def balance(self) -> dict:
        a = await self._req("GET", "/v2/account")
        pos = await self._req("GET", "/v2/positions")
        return {"broker": "alpaca", "equity": float(a["equity"]), "cash": float(a["cash"]), "currency": a.get("currency", "USD"),
                "assets": [{"asset": p["symbol"], "amount": float(p["qty"]), "value": float(p["market_value"])} for p in pos],
                "paper": get_settings().alpaca_paper}

    def round_qty(self, symbol, qty) -> float:
        return float(math.floor(qty))

    async def place(self, symbol, side, qty, price, stop, tp) -> dict:
        q = int(math.floor(qty))
        if q < 1:
            raise BrokerError("Position size rounds to 0 shares — increase equity or risk %")
        o = await self._req("POST", "/v2/orders", json={
            "symbol": symbol, "qty": str(q), "side": side, "type": "market", "time_in_force": "gtc",
            "order_class": "bracket", "take_profit": {"limit_price": round(tp, 2)},
            "stop_loss": {"stop_price": round(stop, 2)}})
        return {"order_id": o["id"], "fill_price": float(o.get("filled_avg_price") or price), "qty": q}

    async def close(self, symbol, position_side, qty, price) -> float:
        try:  # cancel only this symbol's open bracket legs
            for o in await self._req("GET", "/v2/orders", params={"status": "open", "symbols": symbol, "nested": "false"}):
                await self._req("DELETE", f"/v2/orders/{o['id']}")
        except BrokerError:
            pass
        try:
            await self._req("DELETE", f"/v2/positions/{symbol}")
        except BrokerError:
            pass
        return price


# --------------------------------------------------------------------------- IBKR
class IBKRBroker(Broker):
    """Requires TWS / IB Gateway running locally and `pip install ib_async`."""
    name = "ibkr"

    def __init__(self) -> None:
        self._ib = None

    @property
    def configured(self) -> bool:
        return get_settings().ibkr_enabled

    async def ib(self):
        try:
            from ib_async import IB  # type: ignore
        except ImportError as e:
            raise BrokerError("Install ib_async (pip install ib_async) to use Interactive Brokers") from e
        if self._ib is None or not self._ib.isConnected():
            s = get_settings()
            self._ib = IB()
            await self._ib.connectAsync(s.ibkr_host, s.ibkr_port, clientId=s.ibkr_client_id)
        return self._ib

    def _contract(self, symbol: str):
        from ib_async import Forex, Stock  # type: ignore
        if "_" in symbol and len(symbol) == 7:
            return Forex(symbol.replace("_", ""))
        return Stock(symbol, "SMART", "USD")

    async def balance(self) -> dict:
        ib = await self.ib()
        vals = {v.tag: v for v in await ib.accountSummaryAsync()}
        nl = vals.get("NetLiquidation")
        cash = vals.get("TotalCashValue")
        return {"broker": "ibkr", "equity": float(nl.value) if nl else 0, "cash": float(cash.value) if cash else 0,
                "currency": nl.currency if nl else "USD", "assets": []}

    def round_qty(self, symbol, qty) -> float:
        return float(math.floor(qty))

    async def place(self, symbol, side, qty, price, stop, tp) -> dict:
        ib = await self.ib()
        c = self._contract(symbol)
        await ib.qualifyContractsAsync(c)
        q = int(math.floor(qty))
        if q < 1:
            raise BrokerError("Position size rounds to 0")
        orders = ib.bracketOrder("BUY" if side == "buy" else "SELL", q, round(price, 2), round(tp, 2), round(stop, 2))
        trades = [ib.placeOrder(c, o) for o in orders]
        return {"order_id": str(trades[0].order.orderId), "fill_price": price, "qty": q}

    async def close(self, symbol, position_side, qty, price) -> float:
        from ib_async import MarketOrder  # type: ignore
        ib = await self.ib()
        c = self._contract(symbol)
        await ib.qualifyContractsAsync(c)
        ib.placeOrder(c, MarketOrder("SELL" if position_side == "LONG" else "BUY", int(qty)))
        return price


# --------------------------------------------------------------------------- registry
_live = {"binance": BinanceBroker(), "oanda": OandaBroker(), "alpaca": AlpacaBroker(), "ibkr": IBKRBroker()}
_paper = PaperBroker()


def get_broker(name: str) -> Broker:
    if get_settings().trading_mode == "paper":
        return _paper
    b = _live.get(name)
    if b is None or not b.configured:
        raise BrokerError(f"Broker '{name}' is not configured. Add its API keys to backend/.env")
    return b


def broker_label(name: str) -> str:
    return "paper" if get_settings().trading_mode == "paper" else name


async def all_balances() -> list[dict]:
    if get_settings().trading_mode == "paper":
        return [await _paper.balance()]
    out = []
    for name, b in _live.items():
        if not b.configured:
            out.append({"broker": name, "configured": False})
            continue
        try:
            out.append({**await b.balance(), "configured": True})
        except Exception as e:  # noqa: BLE001
            out.append({"broker": name, "configured": True, "error": str(e)[:200]})
    return out


async def shutdown() -> None:
    await _live["binance"].aclose()  # type: ignore[attr-defined]


def now() -> float:
    return time.time()
