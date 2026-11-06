import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  name: string;
  email: string;
  tier: string;
  currency: 'USD' | 'EUR' | 'GBP';
  avatarColor: string;
  bio: string;
  joinedAt: number;
}

export interface PaymentCard {
  id: string;
  brand: 'Visa' | 'Mastercard' | 'Amex' | 'Card';
  last4: string;
  cardholder: string;
  expMonth: string;
  expYear: string;
  isDefault: boolean;
  addedAt: number;
}

export interface PaymentTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payout';
  amount: number;
  cardLast4: string;
  status: 'completed' | 'pending';
  timestamp: number;
  note: string;
}

const STORAGE_KEYS = {
  PROFILE: '@aurum_local_profile_v1',
  CARDS: '@aurum_local_cards_v1',
  TRANSACTIONS: '@aurum_local_transactions_v1',
  LOCAL_BALANCE: '@aurum_local_user_balance_v1',
};

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Trader Sovereign',
  email: 'trader@local.device',
  tier: '100% Free Lifetime Sovereign',
  currency: 'USD',
  avatarColor: '#F4C430',
  bio: 'Zero-fee algorithmic and quantitative sovereign trading from my local device.',
  joinedAt: Date.now(),
};

// Profile operations
export async function loadLocalProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      await saveLocalProfile(DEFAULT_PROFILE);
      return DEFAULT_PROFILE;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveLocalProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

// Payment Card operations (100% local on device)
export async function loadLocalCards(): Promise<PaymentCard[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CARDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addLocalCard(card: Omit<PaymentCard, 'id' | 'addedAt'>): Promise<PaymentCard[]> {
  const current = await loadLocalCards();
  const newCard: PaymentCard = {
    ...card,
    id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    addedAt: Date.now(),
    isDefault: current.length === 0 ? true : card.isDefault,
  };

  const updated = current.map((c) => (newCard.isDefault ? { ...c, isDefault: false } : c));
  updated.unshift(newCard);
  await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(updated));
  return updated;
}

export async function deleteLocalCard(cardId: string): Promise<PaymentCard[]> {
  const current = await loadLocalCards();
  const filtered = current.filter((c) => c.id !== cardId);
  if (filtered.length > 0 && !filtered.some((c) => c.isDefault)) {
    filtered[0].isDefault = true;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(filtered));
  return filtered;
}

export async function setDefaultLocalCard(cardId: string): Promise<PaymentCard[]> {
  const current = await loadLocalCards();
  const updated = current.map((c) => ({
    ...c,
    isDefault: c.id === cardId,
  }));
  await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(updated));
  return updated;
}

// Transaction operations
export async function loadLocalTransactions(): Promise<PaymentTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordLocalTransaction(
  type: 'deposit' | 'withdrawal' | 'payout',
  amount: number,
  cardLast4: string,
  note: string = ''
): Promise<PaymentTransaction[]> {
  const current = await loadLocalTransactions();
  const tx: PaymentTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    amount,
    cardLast4,
    status: 'completed',
    timestamp: Date.now(),
    note,
  };
  current.unshift(tx);
  await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(current));

  // Update local funded balance
  const balance = await getLocalFundedBalance();
  const newBalance = type === 'deposit' ? balance + amount : Math.max(0, balance - amount);
  await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_BALANCE, newBalance.toString());

  return current;
}

export async function getLocalFundedBalance(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_BALANCE);
    return raw ? parseFloat(raw) : 10000;
  } catch {
    return 10000;
  }
}

// Full Export / Wipe for 100% Data Sovereignty
export async function exportAllLocalData(): Promise<string> {
  const profile = await loadLocalProfile();
  const cards = await loadLocalCards();
  const transactions = await loadLocalTransactions();
  const balance = await getLocalFundedBalance();

  return JSON.stringify(
    {
      app: 'Aurum Trading Platform',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profile,
      cards,
      transactions,
      balance,
    },
    null,
    2
  );
}

export async function wipeAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.CARDS,
    STORAGE_KEYS.TRANSACTIONS,
    STORAGE_KEYS.LOCAL_BALANCE,
  ]);
}
