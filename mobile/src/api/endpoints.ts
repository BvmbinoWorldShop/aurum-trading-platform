import { apiFetch } from './client';

export interface DashboardData {
  mode: 'live' | 'paper';
  equity: number;
  daily_pnl: number;
  stats: {
    closed_trades: number;
    win_rate: number | null;
    net_pnl: number;
    profit_factor: number | null;
    pnl_curve: number[];
    open_trades: number;
  };
  autopilot: {
    armed: boolean;
    kill_switch: boolean;
    scanning: boolean;
    last_scan: number | null;
    last_error: string | null;
  };
  sentiment: {
    value: number | null;
    label: string;
    history: number[];
  };
  top_signals: SignalData[];
  open_trades: Trade[];
  ai_enabled: boolean;
}

export interface MarketAsset {
  symbol: string;
  name: string;
  asset_class: 'crypto' | 'forex' | 'commodity' | 'stock';
  broker: string;
  price: number;
  change_24h_pct: number;
  spark?: number[];
  error?: string;
}

export interface SignalData {
  symbol: string;
  name?: string;
  asset_class?: string;
  timeframe: string;
  price: number;
  direction: 'LONG' | 'SHORT' | 'FLAT';
  confidence: number;
  p_long: number;
  p_short: number;
  stop: number | null;
  take_profit: number | null;
  atr: number;
  validated_win_rate: number | null;
  validated_trades: number;
  base_rate: number;
  regime: string;
  reasons: string[];
  generated_at: number;
}

export interface Trade {
  id: number;
  symbol: string;
  asset_class: string;
  broker: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entry: number;
  stop: number;
  take_profit: number;
  exit?: number;
  pnl?: number;
  status: 'open' | 'closed';
  confidence: number;
  source: string;
  reasons: string;
  broker_order_id?: string;
  opened_at: number;
  closed_at?: number;
  close_reason?: string;
}

export interface VaultData {
  mode: 'live' | 'paper';
  balances: Array<{
    broker: string;
    equity?: number;
    cash?: number;
    currency?: string;
    configured?: boolean;
    testnet?: boolean;
    practice?: boolean;
    paper?: boolean;
    assets?: Array<{ asset: string; amount: number; value: number }>;
    error?: string;
  }>;
  total_equity: number;
  stats: any;
}

export interface BacktestResult {
  bars_tested: number;
  trades: number;
  win_rate: number | null;
  profit_factor: number | null;
  avg_r: number | null;
  total_return_pct: number;
  buy_hold_return_pct: number;
  max_drawdown_pct: number;
  equity_curve: number[];
  recent_trades: any[];
  settings: any;
}

export interface Lesson {
  id: string;
  track: string;
  level: string;
  minutes: number;
  icon: string;
  title: string;
  body: string;
}

export interface PluginItem {
  id: number;
  full_name: string;
  url: string;
  description: string;
  stars: number;
  license: string;
  updated_at: string;
  status: 'pending' | 'approved' | 'rejected';
  found_at: number;
}

export const api = {
  health: () => apiFetch<{ ok: boolean; mode: string }>('/health'),
  dashboard: () => apiFetch<DashboardData>('/dashboard'),
  markets: () => apiFetch<MarketAsset[]>('/markets'),
  signal: (symbol: string) => apiFetch<SignalData>(`/signals?symbol=${encodeURIComponent(symbol)}`),
  candles: (symbol: string, tf = '1h', limit = 100) =>
    apiFetch<Array<{ t: number; o: number; h: number; l: number; c: number }>>(
      `/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=${limit}`
    ),
  scan: () => apiFetch<SignalData[]>('/scan', { method: 'POST' }),
  backtest: (symbol: string) => apiFetch<BacktestResult>('/backtest', { method: 'POST', body: JSON.stringify({ symbol }) }),
  trades: (status?: string) => apiFetch<Trade[]>(`/trades${status ? `?status=${status}` : ''}`),
  executeTrade: (symbol: string) => apiFetch<Trade>('/trades/execute', { method: 'POST', body: JSON.stringify({ symbol }) }),
  closeTrade: (tradeId: number) => apiFetch<Trade>(`/trades/${tradeId}/close`, { method: 'POST' }),
  vault: () => apiFetch<VaultData>('/vault'),
  settings: () => apiFetch<any>('/settings'),
  updateSettings: (patch: any) => apiFetch<any>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  setAutopilot: (armed: boolean, confirmLive = false) =>
    apiFetch<any>('/autopilot', { method: 'POST', body: JSON.stringify({ armed, confirm_live: confirmLive }) }),
  killSwitch: (closeAll = true) => apiFetch<any>(`/killswitch?close_all=${closeAll}`, { method: 'POST' }),
  chat: (message: string, sessionId = 'mobile-session') =>
    apiFetch<{ reply: string; tools_used: string[] }>('/agent/chat', { method: 'POST', body: JSON.stringify({ message, session_id: sessionId }) }),
  news: (q?: string) => apiFetch<any>(`/intel/news${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  plugins: () => apiFetch<PluginItem[]>('/plugins'),
  discoverPlugins: (q: string) => apiFetch<PluginItem[]>(`/plugins/discover?q=${encodeURIComponent(q)}`, { method: 'POST' }),
  setPluginStatus: (id: number, status: 'approved' | 'rejected') =>
    apiFetch<PluginItem>(`/plugins/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  learn: () => apiFetch<Lesson[]>('/learn'),
  activity: (limit = 40) => apiFetch<any[]>(`/activity?limit=${limit}`),
};
