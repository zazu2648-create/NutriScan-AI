import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import type {
  AiFoodAnalysisResult,
  AlternativeSuggestion,
  AppSettings,
  AuthUser,
  FoodLogEntry,
  FoodProduct,
  LabelOcrResult,
  NutritionGoals,
  UserProfile,
} from '../types/nutrition';
import { localStore } from '../utils/storage';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStore.getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg =
      typeof json.error === 'string'
        ? json.error
        : `Request failed with status ${res.status}`;
    throw new Error(errMsg);
  }
  return json as T;
}

export const apiClient = {
  async lookupBarcode(barcode: string): Promise<{
    found: boolean;
    product?: FoodProduct;
    cached?: boolean;
    staleWarning?: string;
    offlineFallback?: boolean;
  }> {
    const clean = barcode.trim();
    if (!navigator.onLine) {
      const cached = localStore.getCachedProductByBarcode(clean);
      if (cached) {
        return { found: true, product: cached, cached: true, offlineFallback: true };
      }
      throw new Error('Offline: unable to perform new online barcode lookup.');
    }

    try {
      const data = await apiFetch<{
        found: boolean;
        product?: FoodProduct;
        cached?: boolean;
        staleWarning?: string;
      }>(`/api/products/barcode/${encodeURIComponent(clean)}`);
      if (data.found && data.product) {
        localStore.cacheProduct(data.product);
      }
      return data;
    } catch (err) {
      const cached = localStore.getCachedProductByBarcode(clean);
      if (cached) {
        return { found: true, product: cached, cached: true, offlineFallback: true };
      }
      throw err;
    }
  },

  async searchFood(
    query: string,
    category = 'all'
  ): Promise<{ results: FoodProduct[]; cached?: boolean }> {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    return apiFetch<{ results: FoodProduct[]; cached?: boolean }>(
      `/api/products/search?${params.toString()}`
    );
  },

  async getAlternatives(product: FoodProduct): Promise<AlternativeSuggestion[]> {
    const p100 = product.nutrientsPer100g;
    if (!product.category || !p100 || p100.caloriesKcal === null) {
      return [];
    }
    const params = new URLSearchParams({
      category: product.category,
      calories: String(p100.caloriesKcal),
    });
    if (product.barcode) params.set('barcode', product.barcode);
    if (p100.sugarsG !== null) params.set('sugars', String(p100.sugarsG));
    if (p100.sodiumMg !== null) params.set('sodium', String(p100.sodiumMg));
    if (p100.proteinG !== null) params.set('protein', String(p100.proteinG));
    if (p100.fiberG !== null) params.set('fiber', String(p100.fiberG));

    const data = await apiFetch<{ alternatives: AlternativeSuggestion[] }>(
      `/api/products/alternatives?${params.toString()}`
    );
    return data.alternatives || [];
  },

  async saveCustomProduct(product: FoodProduct): Promise<FoodProduct> {
    const data = await apiFetch<{ product: FoodProduct }>('/api/products/custom', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    if (data.product.barcode) {
      localStore.cacheProduct(data.product);
    }
    return data.product;
  },

  async analyzeFoodPhoto(
    imageBase64: string,
    mimeType: string,
    language: 'en' | 'ur'
  ): Promise<AiFoodAnalysisResult> {
    return apiFetch<AiFoodAnalysisResult>('/api/ai/analyze-food-photo', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType, language }),
    });
  },

  async scanNutritionLabel(
    imageBase64: string,
    mimeType: string
  ): Promise<LabelOcrResult> {
    return apiFetch<LabelOcrResult>('/api/ai/scan-nutrition-label', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType }),
    });
  },

  async register(name: string, email: string, password: string) {
    return apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async login(email: string, password: string) {
    return apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async deleteAccount() {
    return apiFetch<{ deleted: boolean }>('/api/auth/account', {
      method: 'DELETE',
    });
  },

  async syncPull() {
    return apiFetch<{
      profile: UserProfile | null;
      goals: NutritionGoals | null;
      settings: AppSettings | null;
      logs: FoodLogEntry[];
      favorites: FoodProduct[];
      syncedAt: string;
    }>('/api/sync/pull');
  },

  async syncPush(payload: {
    profile: UserProfile;
    goals: NutritionGoals;
    settings: AppSettings;
    logs: FoodLogEntry[];
    deletedLogIds: string[];
    favorites: FoodProduct[];
  }) {
    return apiFetch<{ syncedAt: string }>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async exportAccountData() {
    return apiFetch<Record<string, unknown>>('/api/export');
  },
};

export async function capturePhotoViaCapacitor(): Promise<{
  base64: string;
  mimeType: string;
} | null> {
  if (!isNativeAndroid()) return null;
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Prompt,
  });
  if (!photo.base64String) return null;
  return {
    base64: photo.base64String,
    mimeType: `image/${photo.format || 'jpeg'}`,
  };
}

export async function triggerNutritionNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (isNativeAndroid()) {
    const perms = await LocalNotifications.requestPermissions();
    if (perms.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 100000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
        },
      ],
    });
    return true;
  }

  if (typeof Notification === 'undefined') return false;
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') return false;
  new Notification(title, {
    body,
    icon: '/src/assets/images/nutriscan_app_icon_1794893955486.jpg',
  });
  return true;
}
