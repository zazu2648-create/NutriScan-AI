import type {
  AppSettings,
  AuthUser,
  FoodLogEntry,
  FoodProduct,
  NutritionGoals,
  UserProfile,
} from '../types/nutrition';
import { calculateEstimatedGoals } from './nutritionMath';

const KEYS = {
  PROFILE: 'nutriscan_profile_v1',
  GOALS: 'nutriscan_goals_v1',
  SETTINGS: 'nutriscan_settings_v1',
  LOGS: 'nutriscan_logs_v1',
  DELETED_LOGS: 'nutriscan_deleted_logs_v1',
  RECENT_SCANS: 'nutriscan_recent_scans_v1',
  PRODUCT_CACHE: 'nutriscan_product_cache_v1',
  FAVORITES: 'nutriscan_favorites_v1',
  SEARCH_HISTORY: 'nutriscan_search_history_v1',
  AUTH_TOKEN: 'nutriscan_auth_token_v1',
  AUTH_USER: 'nutriscan_auth_user_v1',
  LAST_SYNCED: 'nutriscan_last_synced_v1',
  PENDING_SYNC: 'nutriscan_pending_sync_v1',
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: 28,
  sex: 'unspecified',
  heightCm: 170,
  weightKg: 70,
  activityLevel: 'moderate',
  fitnessGoal: 'maintain',
  onboardingCompleted: false,
};

export const DEFAULT_GOALS: NutritionGoals = calculateEstimatedGoals(DEFAULT_PROFILE);

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'light',
  unitSystem: 'metric',
  notificationsEnabled: false,
  mealReminders: true,
  dailySummaryReminder: true,
  reminderTime: '20:30',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota guard: trim cached products if needed
    try {
      localStorage.removeItem(KEYS.PRODUCT_CACHE);
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore if storage completely unavailable
    }
  }
}

export const localStore = {
  getProfile: (): UserProfile => ({
    ...DEFAULT_PROFILE,
    ...readJson<Partial<UserProfile>>(KEYS.PROFILE, {}),
  }),
  saveProfile: (profile: UserProfile) => writeJson(KEYS.PROFILE, profile),

  getGoals: (): NutritionGoals => ({
    ...DEFAULT_GOALS,
    ...readJson<Partial<NutritionGoals>>(KEYS.GOALS, {}),
  }),
  saveGoals: (goals: NutritionGoals) => writeJson(KEYS.GOALS, goals),

  getSettings: (): AppSettings => ({
    ...DEFAULT_SETTINGS,
    ...readJson<Partial<AppSettings>>(KEYS.SETTINGS, {}),
  }),
  saveSettings: (settings: AppSettings) => writeJson(KEYS.SETTINGS, settings),

  getLogs: (): FoodLogEntry[] => readJson<FoodLogEntry[]>(KEYS.LOGS, []),
  saveLogs: (logs: FoodLogEntry[]) => writeJson(KEYS.LOGS, logs),

  getDeletedLogIds: (): string[] => readJson<string[]>(KEYS.DELETED_LOGS, []),
  saveDeletedLogIds: (ids: string[]) => writeJson(KEYS.DELETED_LOGS, ids),

  getRecentScans: (): FoodProduct[] => readJson<FoodProduct[]>(KEYS.RECENT_SCANS, []),
  saveRecentScans: (items: FoodProduct[]) =>
    writeJson(KEYS.RECENT_SCANS, items.slice(0, 30)),

  getFavorites: (): FoodProduct[] => readJson<FoodProduct[]>(KEYS.FAVORITES, []),
  saveFavorites: (items: FoodProduct[]) => writeJson(KEYS.FAVORITES, items),

  getSearchHistory: (): string[] => readJson<string[]>(KEYS.SEARCH_HISTORY, []),
  saveSearchHistory: (items: string[]) =>
    writeJson(KEYS.SEARCH_HISTORY, items.slice(0, 15)),

  getCachedProductByBarcode: (barcode: string): FoodProduct | null => {
    const map = readJson<Record<string, FoodProduct>>(KEYS.PRODUCT_CACHE, {});
    return map[barcode] || null;
  },
  cacheProduct: (product: FoodProduct) => {
    if (!product.barcode) return;
    const map = readJson<Record<string, FoodProduct>>(KEYS.PRODUCT_CACHE, {});
    map[product.barcode] = product;
    const keys = Object.keys(map);
    if (keys.length > 80) {
      delete map[keys[0]];
    }
    writeJson(KEYS.PRODUCT_CACHE, map);
  },

  getAuthToken: (): string | null => localStorage.getItem(KEYS.AUTH_TOKEN),
  saveAuthToken: (token: string | null) => {
    if (token) localStorage.setItem(KEYS.AUTH_TOKEN, token);
    else localStorage.removeItem(KEYS.AUTH_TOKEN);
  },

  getAuthUser: (): AuthUser | null => readJson<AuthUser | null>(KEYS.AUTH_USER, null),
  saveAuthUser: (user: AuthUser | null) => {
    if (user) writeJson(KEYS.AUTH_USER, user);
    else localStorage.removeItem(KEYS.AUTH_USER);
  },

  getLastSynced: (): string | null => localStorage.getItem(KEYS.LAST_SYNCED),
  saveLastSynced: (iso: string | null) => {
    if (iso) localStorage.setItem(KEYS.LAST_SYNCED, iso);
    else localStorage.removeItem(KEYS.LAST_SYNCED);
  },

  getPendingSync: (): boolean => localStorage.getItem(KEYS.PENDING_SYNC) === '1',
  setPendingSync: (pending: boolean) => {
    if (pending) localStorage.setItem(KEYS.PENDING_SYNC, '1');
    else localStorage.removeItem(KEYS.PENDING_SYNC);
  },

  clearHistoryOnly: () => {
    localStorage.removeItem(KEYS.RECENT_SCANS);
    localStorage.removeItem(KEYS.SEARCH_HISTORY);
    localStorage.removeItem(KEYS.PRODUCT_CACHE);
  },

  clearAllAccountData: () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
