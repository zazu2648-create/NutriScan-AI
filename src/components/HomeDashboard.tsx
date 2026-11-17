import React from 'react';
import {
  Camera,
  ChevronRight,
  FileText,
  Globe,
  Moon,
  Plus,
  ScanBarcode,
  Search,
  Settings,
  Sun,
  Trash2,
  WifiOff,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  AppSettings,
  AuthUser,
  FoodLogEntry,
  FoodProduct,
  NutritionGoals,
  UserProfile,
} from '../types/nutrition';
import { sumDailyLogs } from '../utils/nutritionMath';
import { CircularProgressRing, MacroProgressBar } from './CircularProgressRing';
import { ProductImage } from './ProductImage';
import type { AppTab } from './TopBar';

interface HomeDashboardProps {
  profile: UserProfile;
  authUser: AuthUser | null;
  goals: NutritionGoals;
  settings: AppSettings;
  todayLogs: FoodLogEntry[];
  recentScans: FoodProduct[];
  isOnline: boolean;
  onNavigate: (tab: AppTab) => void;
  onOpenPhotoScanner: (mode: 'meal' | 'ocr') => void;
  onSelectProduct: (product: FoodProduct) => void;
  onDeleteLog: (id: string) => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  authUser,
  goals,
  settings,
  todayLogs,
  recentScans,
  isOnline,
  onNavigate,
  onOpenPhotoScanner,
  onSelectProduct,
  onDeleteLog,
  onToggleTheme,
  onToggleLanguage,
  onOpenSettings,
}) => {
  const language: LanguageCode = settings.language;
  const t = TRANSLATIONS[language];
  const totals = sumDailyLogs(todayLogs);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t.home.greetingMorning
      : hour < 17
        ? t.home.greetingAfternoon
        : t.home.greetingEvening;

  const displayName = profile.name?.trim() || authUser?.name || t.home.guestLabel;
  const remainingCal = Math.round(goals.caloriesKcal - totals.caloriesKcal);

  return (
    <div className="space-y-6">
      {!isOnline && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 text-sm">
          <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{t.home.offlineNotice}</p>
        </div>
      )}

      {/* Workspace greeting & quick accessibility utilities (Theme, Language, Settings) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-[#4C6154] dark:text-[#9BB5A4]">
                {greeting} · {displayName}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111C16] dark:text-[#EDF4EF]">
                {t.tagline}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleLanguage}
                aria-label="Switch language"
                className="min-h-[40px] px-3 py-2 rounded-xl border border-emerald-950/12 dark:border-emerald-100/15 text-xs font-semibold text-[#111C16] dark:text-[#EDF4EF] hover:bg-emerald-950/5 dark:hover:bg-white/5 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Globe className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{language === 'en' ? 'اردو' : 'EN'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl border border-emerald-950/12 dark:border-emerald-100/15 text-[#111C16] dark:text-[#EDF4EF] hover:bg-emerald-950/5 dark:hover:bg-white/5 inline-flex items-center justify-center cursor-pointer"
              >
                {settings.theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-[#14532D]" />
                )}
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label={t.settings.title}
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl border border-emerald-950/12 dark:border-emerald-100/15 text-[#111C16] dark:text-[#EDF4EF] hover:bg-emerald-950/5 dark:hover:bg-white/5 inline-flex items-center justify-center cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Primary central action cluster */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onNavigate('scan')}
              className="w-full min-h-[56px] px-6 py-4 rounded-2xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] dark:hover:bg-[#16A34A] text-white font-semibold text-base flex items-center justify-center gap-3 shadow-sm transition-colors cursor-pointer"
            >
              <ScanBarcode className="w-6 h-6" />
              <span>{t.home.scanFoodCta}</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('search')}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] hover:bg-emerald-950/10 dark:hover:bg-white/10 text-[#111C16] dark:text-[#EDF4EF] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Search className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{t.home.searchFoodBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenPhotoScanner('meal')}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] hover:bg-emerald-950/10 dark:hover:bg-white/10 text-[#111C16] dark:text-[#EDF4EF] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Camera className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{t.home.scanPhotoBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenPhotoScanner('ocr')}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] hover:bg-emerald-950/10 dark:hover:bg-white/10 text-[#111C16] dark:text-[#EDF4EF] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{t.home.scanLabelBtn}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero visual frame */}
        <div className="lg:col-span-5 relative rounded-3xl overflow-hidden border border-emerald-950/10 dark:border-emerald-100/10 min-h-[220px]">
          <img
            src="/src/assets/images/nutriscan_hero_banner_1794893956414.jpg"
            alt="Fresh whole foods and packaged grain snack"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex flex-col justify-end p-6 text-white">
            <p className="text-xs font-medium text-emerald-200">
              Open Food Facts · USDA FoodData Central · Gemini Vision
            </p>
            <p className="text-lg font-semibold leading-snug mt-1">
              {language === 'ur'
                ? 'پیکٹ بند اور تازہ کھانوں کی تصدیق شدہ غذائی معلومات'
                : 'Verified package barcodes, label OCR, and visual meal tracking.'}
            </p>
          </div>
        </div>
      </section>

      {/* Daily Progress Section: Circular rings + Macro bars */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.home.dailySummary}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="text-xs font-medium text-[#15803D] dark:text-[#4ADE80] hover:underline cursor-pointer"
            >
              {t.profile.targetsSection}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 items-center pb-6 border-b border-emerald-950/10 dark:border-emerald-100/10">
            <CircularProgressRing
              value={totals.caloriesKcal}
              max={goals.caloriesKcal}
              label={t.home.dailyCalories}
              unit="kcal"
              sublabel={
                remainingCal >= 0
                  ? `${remainingCal.toLocaleString()} kcal ${t.home.remaining}`
                  : `${Math.abs(remainingCal).toLocaleString()} kcal ${t.home.overTarget}`
              }
              accentColor="#14532D"
            />
            <CircularProgressRing
              value={totals.proteinG}
              max={goals.proteinG}
              label={t.home.protein}
              unit="g"
              sublabel={`${Math.round((totals.proteinG / Math.max(1, goals.proteinG)) * 100)}%`}
              accentColor="#15803D"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-6">
            <MacroProgressBar
              label={t.home.carbs}
              value={totals.carbsG}
              max={goals.carbsG}
              barClass="bg-emerald-600 dark:bg-emerald-400"
            />
            <MacroProgressBar
              label={t.home.fat}
              value={totals.fatG}
              max={goals.fatG}
              barClass="bg-amber-600 dark:bg-amber-400"
            />
            <MacroProgressBar
              label={t.home.fiber}
              value={totals.fiberG}
              max={goals.fiberG}
              barClass="bg-teal-600 dark:bg-teal-400"
            />
          </div>

          <div className="mt-5 pt-4 border-t border-emerald-950/10 dark:border-emerald-100/10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
            <span>
              {t.home.sugars}: <strong className="text-[#111C16] dark:text-[#EDF4EF]">{totals.sugarsG} g</strong>
            </span>
            <span>
              {t.home.satFat}: <strong className="text-[#111C16] dark:text-[#EDF4EF]">{totals.saturatedFatG} g</strong>
            </span>
            <span>
              {t.home.sodium}: <strong className="text-[#111C16] dark:text-[#EDF4EF]">{totals.sodiumMg} mg</strong>
            </span>
          </div>
        </div>

        {/* Today's Food Log */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.home.todaysLog}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('diary')}
              className="text-xs font-medium text-[#15803D] dark:text-[#4ADE80] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t.home.viewAllDiary}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayLogs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-3">
              <img
                src="/src/assets/images/nutriscan_empty_plate_1794893955870.jpg"
                alt="Empty ceramic plate"
                referrerPolicy="no-referrer"
                className="w-36 h-28 object-cover rounded-2xl border border-emerald-950/10 dark:border-emerald-100/10"
              />
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-medium text-[#111C16] dark:text-[#EDF4EF]">
                  {t.home.noLogsYet}
                </p>
                <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">
                  {t.home.noLogsHint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('scan')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.diary.addFood}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-emerald-950/10 dark:divide-emerald-100/10 overflow-y-auto max-h-[340px]">
              {todayLogs.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductImage
                      src={entry.imageUrl}
                      alt={entry.name}
                      className="w-11 h-11 rounded-xl"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111C16] dark:text-[#EDF4EF] truncate">
                        {entry.name}
                      </p>
                      <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] truncate tabular-nums">
                        {t.diary[entry.mealType]} · {entry.servingLabel} ·{' '}
                        {entry.nutrients.caloriesKcal ?? 0} kcal
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteLog(entry.id)}
                    aria-label={`${t.diary.deleteEntry} ${entry.name}`}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#4C6154] hover:text-red-600 dark:text-[#9BB5A4] dark:hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recently Scanned Products */}
      <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#111C16] dark:text-[#EDF4EF]">
            {t.home.recentlyScanned}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="text-xs font-medium text-[#15803D] dark:text-[#4ADE80] hover:underline cursor-pointer"
          >
            {t.diary.favoritesTab}
          </button>
        </div>

        {recentScans.length === 0 ? (
          <p className="text-sm text-[#4C6154] dark:text-[#9BB5A4]">
            {t.home.noRecentScans}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentScans.slice(0, 8).map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => onSelectProduct(prod)}
                className="text-left p-3 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] hover:bg-emerald-950/5 dark:hover:bg-white/10 border border-emerald-950/5 dark:border-emerald-100/10 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <ProductImage
                  src={prod.imageUrl}
                  alt={prod.name}
                  className="w-12 h-12 rounded-xl"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#111C16] dark:text-[#EDF4EF] truncate">
                    {prod.name}
                  </p>
                  <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] truncate tabular-nums">
                    {prod.brand ? `${prod.brand} · ` : ''}
                    {prod.nutrientsPer100g?.caloriesKcal !== null &&
                    prod.nutrientsPer100g?.caloriesKcal !== undefined
                      ? `${prod.nutrientsPer100g.caloriesKcal} kcal/100g`
                      : prod.barcode || ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
