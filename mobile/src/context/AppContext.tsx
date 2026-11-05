import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, DashboardData } from '../api/endpoints';
import { setApiConfig } from '../api/client';
import { haptic } from '../utils/haptics';

interface AppContextType {
  dashboard: DashboardData | null;
  loading: boolean;
  connected: boolean;
  refreshing: boolean;
  error: string | null;
  refreshDashboard: () => Promise<void>;
  updateServerUrl: (url: string, token: string) => Promise<void>;
  toggleAutopilot: (armed: boolean, confirmLive?: boolean) => Promise<void>;
  triggerKillSwitch: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await api.dashboard();
      setDashboard(data);
      setConnected(true);
      setError(null);
    } catch (err: any) {
      setConnected(false);
      setError(err.message || 'Cannot reach trading backend');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const updateServerUrl = async (url: string, token: string) => {
    setApiConfig(url, token);
    haptic.medium();
    await refreshDashboard();
  };

  const toggleAutopilot = async (armed: boolean, confirmLive = false) => {
    try {
      await api.setAutopilot(armed, confirmLive);
      haptic.success();
      await refreshDashboard();
    } catch (err: any) {
      haptic.error();
      setError(err.message);
      throw err;
    }
  };

  const triggerKillSwitch = async () => {
    try {
      haptic.heavy();
      await api.killSwitch(true);
      haptic.error(); // deliberate feedback for emergency action
      await refreshDashboard();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    refreshDashboard();
    const interval = setInterval(() => {
      refreshDashboard();
    }, 10000); // 10s auto-refresh for live status
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  return (
    <AppContext.Provider
      value={{
        dashboard,
        loading,
        connected,
        refreshing,
        error,
        refreshDashboard,
        updateServerUrl,
        toggleAutopilot,
        triggerKillSwitch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
