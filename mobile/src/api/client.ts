import { Platform } from 'react-native';

// Default: on Android emulator 10.0.2.2 points to host machine, localhost on web/iOS simulator
export const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

let currentBaseUrl = DEFAULT_API_URL;
let currentToken = 'change-me';

export function setApiConfig(url: string, token: string) {
  currentBaseUrl = url.replace(/\/+$/, '');
  currentToken = token;
}

export function getApiConfig() {
  return { baseUrl: currentBaseUrl, token: currentToken };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${currentBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});
  headers.set('X-App-Token', currentToken);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      msg = parsed.detail || parsed.message || msg;
    } catch {
      if (errorText) msg = errorText;
    }
    throw new Error(msg);
  }

  return res.json();
}
