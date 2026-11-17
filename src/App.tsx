import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarcodeScannerView } from './components/BarcodeScannerView';
import { BottomNav } from './components/BottomNav';
import { DiaryTrackerView } from './components/DiaryTrackerView';
import { FoodSearchView } from './components/FoodSearchView';
import { HomeDashboard } from './components/HomeDashboard';
import { ManualProductModal } from './components/ManualProductModal';
import { PhotoScannerView } from './components/PhotoScannerView';
import { ProductDetailsView } from './components/ProductDetailsView';
import { ProfileAccountView } from './components/ProfileAccountView';
import { SettingsLegalView } from './components/SettingsLegalView';
import { TopBar, type AppTab } from './components/TopBar';
import { apiClient, triggerNutritionNotification } from './services/apiClient';
import type {
  AppSettings,
  AuthUser,
  FoodLogEntry,
  FoodProduct,
  MealType,
  NutritionGoals,
  UserProfile,
} from './types/nutrition';
import {
  calculateProductServing,
  getTodayDateKey,
} from './utils/nutritionMath';
import { localStore } from './utils/storage';

type ActiveScreen =
  | { kind: 'tab'; tab: AppTab }
  | { kind: 'product'; product: FoodProduct; returnTab: AppTab }
  | { kind: 'photo'; mode: 'meal' | 'ocr'; prefillBarcode?: string; returnTab: AppTab }
  | { kind: 'settings'; returnTab: AppTab };

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() =>
    localStore.getProfile()
  );
  const [goals, setGoals] = useState<NutritionGoals>(() =>
    localStore.getGoals()
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    localStore.getSettings()
  );
  const [logs, setLogs] = useState<FoodLogEntry[]>(() => localStore.getLogs());
  const [deletedLogIds, setDeletedLogIds] = useState<string[]>(() =>
    localStore.getDeletedLogIds()
  );
  const [recentScans, setRecentScans] = useState<FoodProduct[]>(() =>
    localStore.getRecentScans()
  );
  const [favorites, setFavorites] = useState<FoodProduct[]>(() =>
    localStore.getFavorites()
  );
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    localStore.getSearchHistory()
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(() =>
    localStore.getAuthUser()
  );
  const [lastSynced, setLastSynced] = useState<string | null>(() =>
    localStore.getLastSynced()
  );

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [screen, setScreen] = useState<ActiveScreen>({
    kind: 'tab',
    tab: 'home',
  });
  const [manualModalBarcode, setManualModalBarcode] = useState<
    string | null
  >(null);

  // Sync HTML theme (.dark) and language/RTL direction (dir="rtl" for Urdu)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.lang = settings.language;
    root.dir = settings.language === 'ur' ? 'rtl' : 'ltr';
  }, [settings.theme, settings.language]);

  // Monitor online/offline transitions
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Optional notification reminder check every minute when enabled
  useEffect(() => {
    if (!settings.notificationsEnabled || !settings.dailySummaryReminder) return;
    const timer = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const firedKey = `nutriscan_reminded_${getTodayDateKey()}_${hhmm}`;
      if (hhmm === settings.reminderTime && !sessionStorage.getItem(firedKey)) {
        sessionStorage.setItem(firedKey, '1');
        void triggerNutritionNotification(
          'NutriScan AI',
          settings.language === 'ur'
            ? 'آج کا روزانہ غذائی خلاصہ چیک کریں۔'
            : 'Time to review your daily calorie & macro summary.'
        );
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [
    settings.notificationsEnabled,
    settings.dailySummaryReminder,
    settings.reminderTime,
    settings.language,
  ]);

  const syncWithServer = useCallback(
    async (
      nextProfile = profile,
      nextGoals = goals,
      nextSettings = settings,
      nextLogs = logs,
      nextDeleted = deletedLogIds,
      nextFavorites = favorites
    ) => {
      if (!localStore.getAuthToken() || !navigator.onLine) {
        localStore.setPendingSync(true);
        return;
      }
      const res = await apiClient.syncPush({
        profile: nextProfile,
        goals: nextGoals,
        settings: nextSettings,
        logs: nextLogs,
        deletedLogIds: nextDeleted,
        favorites: nextFavorites,
      });
      localStore.saveDeletedLogIds([]);
      setDeletedLogIds([]);
      localStore.saveLastSynced(res.syncedAt);
      setLastSynced(res.syncedAt);
      localStore.setPendingSync(false);
    },
    [profile, goals, settings, logs, deletedLogIds, favorites]
  );

  // Auto-flush pending offline sync when connectivity returns
  useEffect(() => {
    if (isOnline && authUser && localStore.getPendingSync()) {
      void syncWithServer();
    }
  }, [isOnline, authUser, syncWithServer]);

  const currentTab: AppTab =
    screen.kind === 'tab' ? screen.tab : screen.returnTab;

  const todayLogs = useMemo(() => {
    const today = getTodayDateKey();
    return logs.filter((l) => l.dateKey === today);
  }, [logs]);

  const openProduct = (product: FoodProduct) => {
    const nextRecent = [
      product,
      ...recentScans.filter((p) => p.id !== product.id),
    ].slice(0, 30);
    setRecentScans(nextRecent);
    localStore.saveRecentScans(nextRecent);
    if (product.barcode) {
      localStore.cacheProduct(product);
    }
    setScreen({ kind: 'product', product, returnTab: currentTab });
  };

  const addLogEntries = (newEntries: FoodLogEntry[]) => {
    const updated = [...newEntries, ...logs];
    setLogs(updated);
    localStore.saveLogs(updated);
    if (authUser) {
      void syncWithServer(profile, goals, settings, updated, deletedLogIds, favorites);
    }
  };

  const handleUpdateLog = (updatedEntry: FoodLogEntry) => {
    const updated = logs.map((l) =>
      l.id === updatedEntry.id ? updatedEntry : l
    );
    setLogs(updated);
    localStore.saveLogs(updated);
    if (authUser) {
      void syncWithServer(profile, goals, settings, updated, deletedLogIds, favorites);
    }
  };

  const handleDeleteLog = (id: string) => {
    const updated = logs.filter((l) => l.id !== id);
    const nextDeleted = [...deletedLogIds, id];
    setLogs(updated);
    setDeletedLogIds(nextDeleted);
    localStore.saveLogs(updated);
    localStore.saveDeletedLogIds(nextDeleted);
    if (authUser) {
      void syncWithServer(profile, goals, settings, updated, nextDeleted, favorites);
    }
  };

  const handleToggleFavorite = (product: FoodProduct) => {
    const exists = favorites.some((f) => f.id === product.id);
    const updated = exists
      ? favorites.filter((f) => f.id !== product.id)
      : [product, ...favorites];
    setFavorites(updated);
    localStore.saveFavorites(updated);
    if (authUser) {
      void syncWithServer(profile, goals, settings, logs, deletedLogIds, updated);
    }
  };

  const handleQuickAddProduct = (product: FoodProduct, mealType: MealType) => {
    const calc = calculateProductServing(
      product,
      product.servingSizeGrams ? 'one_serving' : 'hundred_g',
      100
    );
    addLogEntries([
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dateKey: getTodayDateKey(),
        mealType,
        productId: product.id,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        dataSource: product.dataSource,
        servingLabel: calc.basisDescription,
        servingBasis: calc.basis,
        gramsConsumed: calc.grams,
        nutrients: calc.nutrients,
        loggedAt: new Date().toISOString(),
      },
    ]);
  };

  const handleSaveCustomProduct = async (product: FoodProduct) => {
    let saved = product;
    if (navigator.onLine) {
      try {
        saved = await apiClient.saveCustomProduct(product);
      } catch {
        // Keep local custom product when offline
      }
    }
    if (saved.barcode) {
      localStore.cacheProduct(saved);
    }
    const nextRecent = [
      saved,
      ...recentScans.filter((p) => p.id !== saved.id),
    ].slice(0, 30);
    setRecentScans(nextRecent);
    localStore.saveRecentScans(nextRecent);
  };

  const handleUpdateSettings = (next: AppSettings) => {
    setSettings(next);
    localStore.saveSettings(next);
    if (authUser) {
      void syncWithServer(profile, goals, next, logs, deletedLogIds, favorites);
    }
  };

  const handleSaveProfileAndGoals = (
    nextProfile: UserProfile,
    nextGoals: NutritionGoals
  ) => {
    setProfile(nextProfile);
    setGoals(nextGoals);
    localStore.saveProfile(nextProfile);
    localStore.saveGoals(nextGoals);
    if (authUser) {
      void syncWithServer(nextProfile, nextGoals, settings, logs, deletedLogIds, favorites);
    }
  };

  const pullAndMergeAccount = async (user: AuthUser, token: string) => {
    localStore.saveAuthToken(token);
    localStore.saveAuthUser(user);
    setAuthUser(user);

    const pulled = await apiClient.syncPull();
    const mergedLogsMap = new Map<string, FoodLogEntry>();
    for (const l of pulled.logs || []) mergedLogsMap.set(l.id, l);
    for (const l of logs) mergedLogsMap.set(l.id, l);
    const mergedLogs = Array.from(mergedLogsMap.values());

    const mergedProfile = pulled.profile || profile;
    const mergedGoals = pulled.goals || goals;
    const mergedSettings = pulled.settings || settings;
    const mergedFavs =
      pulled.favorites && pulled.favorites.length > 0
        ? pulled.favorites
        : favorites;

    setProfile(mergedProfile);
    setGoals(mergedGoals);
    setSettings(mergedSettings);
    setLogs(mergedLogs);
    setFavorites(mergedFavs);

    localStore.saveProfile(mergedProfile);
    localStore.saveGoals(mergedGoals);
    localStore.saveSettings(mergedSettings);
    localStore.saveLogs(mergedLogs);
    localStore.saveFavorites(mergedFavs);

    await syncWithServer(
      mergedProfile,
      mergedGoals,
      mergedSettings,
      mergedLogs,
      deletedLogIds,
      mergedFavs
    );
  };

  const handleLogin = async (email: string, password: string) => {
    const res = await apiClient.login(email, password);
    await pullAndMergeAccount(res.user, res.token);
  };

  const handleRegister = async (
    name: string,
    email: string,
    password: string
  ) => {
    const res = await apiClient.register(name, email, password);
    localStore.saveAuthToken(res.token);
    localStore.saveAuthUser(res.user);
    setAuthUser(res.user);
    const nextProfile = { ...profile, name: profile.name || res.user.name };
    setProfile(nextProfile);
    localStore.saveProfile(nextProfile);
    await syncWithServer(nextProfile, goals, settings, logs, deletedLogIds, favorites);
  };

  const handleLogout = () => {
    localStore.saveAuthToken(null);
    localStore.saveAuthUser(null);
    setAuthUser(null);
  };

  const handleDeleteAccount = async () => {
    await apiClient.deleteAccount();
    localStore.clearAllAccountData();
    setAuthUser(null);
    setLogs([]);
    setFavorites([]);
    setRecentScans([]);
    setRecentSearches([]);
    setLastSynced(null);
  };

  const recordSearch = (term: string) => {
    const next = [
      term,
      ...recentSearches.filter((s) => s.toLowerCase() !== term.toLowerCase()),
    ].slice(0, 12);
    setRecentSearches(next);
    localStore.saveSearchHistory(next);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8F7] dark:bg-[#0B120E] text-[#111C16] dark:text-[#EDF4EF]">
      <TopBar
        activeTab={currentTab}
        onNavigate={(tab) => setScreen({ kind: 'tab', tab })}
        language={settings.language}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
        {screen.kind === 'tab' && screen.tab === 'home' && (
          <HomeDashboard
            profile={profile}
            authUser={authUser}
            goals={goals}
            settings={settings}
            todayLogs={todayLogs}
            recentScans={recentScans}
            isOnline={isOnline}
            onNavigate={(tab) => setScreen({ kind: 'tab', tab })}
            onOpenPhotoScanner={(mode) =>
              setScreen({ kind: 'photo', mode, returnTab: 'home' })
            }
            onSelectProduct={openProduct}
            onDeleteLog={handleDeleteLog}
            onToggleTheme={() =>
              handleUpdateSettings({
                ...settings,
                theme: settings.theme === 'dark' ? 'light' : 'dark',
              })
            }
            onToggleLanguage={() =>
              handleUpdateSettings({
                ...settings,
                language: settings.language === 'en' ? 'ur' : 'en',
              })
            }
            onOpenSettings={() =>
              setScreen({ kind: 'settings', returnTab: 'home' })
            }
          />
        )}

        {screen.kind === 'tab' && screen.tab === 'scan' && (
          <BarcodeScannerView
            language={settings.language}
            onProductFound={openProduct}
            onOpenLabelOcr={(code) =>
              setScreen({
                kind: 'photo',
                mode: 'ocr',
                prefillBarcode: code,
                returnTab: 'scan',
              })
            }
            onOpenMealPhoto={() =>
              setScreen({ kind: 'photo', mode: 'meal', returnTab: 'scan' })
            }
            onOpenManualEntry={(code) => setManualModalBarcode(code || '')}
          />
        )}

        {screen.kind === 'tab' && screen.tab === 'search' && (
          <FoodSearchView
            language={settings.language}
            recentSearches={recentSearches}
            onRecordSearch={recordSearch}
            onClearRecentSearches={() => {
              setRecentSearches([]);
              localStore.saveSearchHistory([]);
            }}
            onSelectProduct={openProduct}
          />
        )}

        {screen.kind === 'tab' && screen.tab === 'diary' && (
          <DiaryTrackerView
            language={settings.language}
            logs={logs}
            goals={goals}
            favorites={favorites}
            recentScans={recentScans}
            onUpdateLog={handleUpdateLog}
            onDeleteLog={handleDeleteLog}
            onSelectProduct={openProduct}
            onQuickAddProduct={handleQuickAddProduct}
            onOpenScanner={() => setScreen({ kind: 'tab', tab: 'scan' })}
          />
        )}

        {screen.kind === 'tab' && screen.tab === 'profile' && (
          <ProfileAccountView
            language={settings.language}
            profile={profile}
            goals={goals}
            settings={settings}
            authUser={authUser}
            lastSynced={lastSynced}
            logs={logs}
            favorites={favorites}
            onSaveProfileAndGoals={handleSaveProfileAndGoals}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onLogout={handleLogout}
            onSyncNow={() => syncWithServer()}
            onOpenSettings={() =>
              setScreen({ kind: 'settings', returnTab: 'profile' })
            }
          />
        )}

        {screen.kind === 'product' && (
          <ProductDetailsView
            product={screen.product}
            goals={goals}
            language={settings.language}
            isFavorite={favorites.some((f) => f.id === screen.product.id)}
            onToggleFavorite={handleToggleFavorite}
            onAddToLog={(entry) => addLogEntries([entry])}
            onSelectProduct={openProduct}
            onBack={() =>
              setScreen({ kind: 'tab', tab: screen.returnTab })
            }
          />
        )}

        {screen.kind === 'photo' && (
          <PhotoScannerView
            initialMode={screen.mode}
            prefillBarcode={screen.prefillBarcode}
            language={settings.language}
            onLogEntries={addLogEntries}
            onSaveCustomProduct={handleSaveCustomProduct}
            onClose={() =>
              setScreen({ kind: 'tab', tab: screen.returnTab })
            }
          />
        )}

        {screen.kind === 'settings' && (
          <SettingsLegalView
            settings={settings}
            authUser={authUser}
            onUpdateSettings={handleUpdateSettings}
            onClearHistory={() => {
              localStore.clearHistoryOnly();
              setRecentScans([]);
              setRecentSearches([]);
            }}
            onDeleteAccount={handleDeleteAccount}
            onBack={() =>
              setScreen({ kind: 'tab', tab: screen.returnTab })
            }
          />
        )}
      </main>

      <BottomNav
        activeTab={currentTab}
        onNavigate={(tab) => setScreen({ kind: 'tab', tab })}
        language={settings.language}
      />

      {manualModalBarcode !== null && (
        <ManualProductModal
          prefillBarcode={manualModalBarcode}
          language={settings.language}
          onSave={async (prod) => {
            await handleSaveCustomProduct(prod);
            setManualModalBarcode(null);
            openProduct(prod);
          }}
          onClose={() => setManualModalBarcode(null)}
        />
      )}
    </div>
  );
}
