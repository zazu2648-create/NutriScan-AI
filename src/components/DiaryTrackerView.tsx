import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Edit3,
  Heart,
  Plus,
  Trash2,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  FoodLogEntry,
  FoodProduct,
  MealType,
  NutritionGoals,
} from '../types/nutrition';
import {
  getTodayDateKey,
  scaleNutrients,
  sumDailyLogs,
} from '../utils/nutritionMath';
import { ProductImage } from './ProductImage';

interface DiaryTrackerViewProps {
  language: LanguageCode;
  logs: FoodLogEntry[];
  goals: NutritionGoals;
  favorites: FoodProduct[];
  recentScans: FoodProduct[];
  onUpdateLog: (entry: FoodLogEntry) => void;
  onDeleteLog: (id: string) => void;
  onSelectProduct: (product: FoodProduct) => void;
  onQuickAddProduct: (product: FoodProduct, mealType: MealType) => void;
  onOpenScanner: () => void;
}

function shiftDateKey(baseKey: string, deltaDays: number): string {
  const [y, m, d] = baseKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export const DiaryTrackerView: React.FC<DiaryTrackerViewProps> = ({
  language,
  logs,
  goals,
  favorites,
  recentScans,
  onUpdateLog,
  onDeleteLog,
  onSelectProduct,
  onQuickAddProduct,
  onOpenScanner,
}) => {
  const t = TRANSLATIONS[language];
  const todayKey = getTodayDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [subTab, setSubTab] = useState<'log' | 'history'>('log');
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [editGrams, setEditGrams] = useState<number>(100);
  const [editMeal, setEditMeal] = useState<MealType>('lunch');

  const dateScroller = useMemo(() => {
    return [-3, -2, -1, 0, 1].map((offset) => {
      const key = shiftDateKey(todayKey, offset);
      const [y, m, d] = key.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return {
        key,
        weekday: dt.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-US', {
          weekday: 'short',
        }),
        day: d,
      };
    });
  }, [todayKey, language]);

  const dayLogs = useMemo(
    () => logs.filter((l) => l.dateKey === selectedDate),
    [logs, selectedDate]
  );

  const dayTotals = useMemo(() => sumDailyLogs(dayLogs), [dayLogs]);
  const remainingCalories = Math.round(goals.caloriesKcal - dayTotals.caloriesKcal);

  const weeklyBars = useMemo(() => {
    return [-6, -5, -4, -3, -2, -1, 0].map((offset) => {
      const key = shiftDateKey(todayKey, offset);
      const entries = logs.filter((l) => l.dateKey === key);
      const totals = sumDailyLogs(entries);
      const [, m, d] = key.split('-');
      return {
        key,
        label: `${m}/${d}`,
        calories: totals.caloriesKcal,
      };
    });
  }, [logs, todayKey]);

  const maxWeeklyCal = Math.max(
    goals.caloriesKcal,
    ...weeklyBars.map((b) => b.calories),
    100
  );

  const mealGroups: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

  const startEdit = (entry: FoodLogEntry) => {
    setEditingEntry(entry);
    setEditGrams(entry.gramsConsumed || 100);
    setEditMeal(entry.mealType);
  };

  const commitEdit = () => {
    if (!editingEntry) return;
    const baseGrams = editingEntry.gramsConsumed > 0 ? editingEntry.gramsConsumed : 100;
    const newGrams = Math.max(1, editGrams);
    const ratio = newGrams / baseGrams;
    const updated: FoodLogEntry = {
      ...editingEntry,
      mealType: editMeal,
      gramsConsumed: newGrams,
      servingLabel: `${newGrams} g`,
      servingBasis: 'selected_quantity',
      nutrients: scaleNutrients(editingEntry.nutrients, ratio),
    };
    onUpdateLog(updated);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
          {t.diary.title}
        </h1>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#E8EFEA] dark:bg-[#192A20]">
          <button
            type="button"
            onClick={() => setSubTab('log')}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'log'
                ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                : 'text-[#4C6154] dark:text-[#9BB5A4]'
            }`}
          >
            {t.diary.historyTab}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'history'
                ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                : 'text-[#4C6154] dark:text-[#9BB5A4]'
            }`}
          >
            {t.diary.favoritesTab}
          </button>
        </div>
      </div>

      {subTab === 'log' ? (
        <>
          {/* Date Scroller + Calendar Picker */}
          <div className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              {dateScroller.map((item) => {
                const active = item.key === selectedDate;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedDate(item.key)}
                    className={`min-w-[54px] min-h-[56px] px-3 py-2 rounded-2xl flex flex-col items-center justify-center text-xs cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#14532D] text-white dark:bg-[#15803D]'
                        : 'bg-[#F6F8F7] dark:bg-[#192A20] text-[#4C6154] dark:text-[#9BB5A4]'
                    }`}
                  >
                    <span>{item.weekday}</span>
                    <span className="text-sm font-bold tabular-nums">{item.day}</span>
                  </button>
                );
              })}
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-[#4C6154] dark:text-[#9BB5A4]">
              <Calendar className="w-4 h-4 text-[#15803D]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-xs font-mono text-[#111C16] dark:text-[#EDF4EF]"
              />
            </label>
          </div>

          {/* Daily Totals Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {[
              { label: t.diary.consumed, val: `${Math.round(dayTotals.caloriesKcal)} kcal` },
              {
                label: t.diary.remaining,
                val: `${remainingCalories} kcal`,
              },
              { label: t.home.protein, val: `${dayTotals.proteinG} / ${goals.proteinG} g` },
              { label: t.home.carbs, val: `${dayTotals.carbsG} / ${goals.carbsG} g` },
              { label: t.home.fat, val: `${dayTotals.fatG} / ${goals.fatG} g` },
              { label: t.home.fiber, val: `${dayTotals.fiberG} / ${goals.fiberG} g` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-4"
              >
                <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">
                  {stat.label}
                </p>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-[#111C16] dark:text-[#EDF4EF]">
                  {stat.val}
                </p>
              </div>
            ))}
          </div>

          {/* Meal Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mealGroups.map((meal) => {
              const items = dayLogs.filter((l) => l.mealType === meal);
              const mealCals = items.reduce(
                (acc, x) => acc + (x.nutrients.caloriesKcal ?? 0),
                0
              );
              return (
                <section
                  key={meal}
                  className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-950/10 dark:border-emerald-100/10">
                    <div>
                      <h2 className="text-base font-semibold text-[#111C16] dark:text-[#EDF4EF]">
                        {t.diary[meal]}
                      </h2>
                      <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
                        {Math.round(mealCals)} kcal
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.diary.addFood}</span>
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] py-3">
                      —
                    </p>
                  ) : (
                    <div className="divide-y divide-emerald-950/10 dark:divide-emerald-100/10">
                      {items.map((entry) => (
                        <div
                          key={entry.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111C16] dark:text-[#EDF4EF] truncate">
                              {entry.name}
                            </p>
                            <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
                              {entry.servingLabel} · {entry.nutrients.caloriesKcal ?? 0} kcal · P{' '}
                              {entry.nutrients.proteinG ?? 0}g · C{' '}
                              {entry.nutrients.carbsG ?? 0}g · F{' '}
                              {entry.nutrients.fatG ?? 0}g
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              aria-label={`${t.diary.editEntry} ${entry.name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#4C6154] hover:text-[#14532D] cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteLog(entry.id)}
                              aria-label={`${t.diary.deleteEntry} ${entry.name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#4C6154] hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* 7-Day Calorie Trend Chart */}
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#111C16] dark:text-[#EDF4EF]">
                {t.diary.weeklyTrend}
              </h2>
              <span className="text-xs text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
                {t.diary.target}: {goals.caloriesKcal} kcal
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 pt-4">
              {weeklyBars.map((bar) => {
                const heightPct = Math.max(
                  4,
                  Math.round((bar.calories / maxWeeklyCal) * 100)
                );
                const isSelected = bar.key === selectedDate;
                return (
                  <button
                    key={bar.key}
                    type="button"
                    onClick={() => setSelectedDate(bar.key)}
                    className="h-full flex flex-col items-center justify-end gap-1.5 cursor-pointer group"
                  >
                    <span className="text-[11px] font-mono tabular-nums text-[#4C6154] dark:text-[#9BB5A4]">
                      {bar.calories > 0 ? Math.round(bar.calories) : ''}
                    </span>
                    <div className="w-full max-w-[36px] flex-1 flex items-end">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg transition-all ${
                          isSelected
                            ? 'bg-[#14532D] dark:bg-[#22C55E]'
                            : 'bg-emerald-700/35 dark:bg-emerald-400/30 group-hover:bg-emerald-700/60'
                        }`}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-[#4C6154] dark:text-[#9BB5A4]">
                      {bar.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        /* Favorites & History Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#111C16] dark:text-[#EDF4EF] flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#15803D]" />
              <span>{t.product.removeFavorite}</span>
            </h2>
            {favorites.length === 0 ? (
              <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">—</p>
            ) : (
              <div className="space-y-2.5">
                {favorites.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProduct(prod)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <ProductImage
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-11 h-11 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{prod.name}</p>
                        <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] truncate">
                          {prod.brand || prod.barcode || ''}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickAddProduct(prod, 'snacks')}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#14532D] text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      {t.diary.quickAddToday}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.diary.scannedProducts}
            </h2>
            {recentScans.length === 0 ? (
              <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">—</p>
            ) : (
              <div className="space-y-2.5">
                {recentScans.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProduct(prod)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <ProductImage
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-11 h-11 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{prod.name}</p>
                        <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] truncate">
                          {prod.brand || prod.barcode || ''}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickAddProduct(prod, 'snacks')}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#14532D] text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      {t.diary.quickAddToday}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Edit Log Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/15 p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#111C16] dark:text-[#EDF4EF]">
              {t.diary.editEntry}: {editingEntry.name}
            </h3>
            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                  {t.photoScanner.gramsLabel}
                </span>
                <input
                  type="number"
                  min={1}
                  value={editGrams}
                  onChange={(e) => setEditGrams(Number(e.target.value) || 1)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                  {t.product.mealTarget}
                </span>
                <select
                  value={editMeal}
                  onChange={(e) => setEditMeal(e.target.value as MealType)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                >
                  <option value="breakfast">{t.diary.breakfast}</option>
                  <option value="lunch">{t.diary.lunch}</option>
                  <option value="dinner">{t.diary.dinner}</option>
                  <option value="snacks">{t.diary.snacks}</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-emerald-950/15 text-sm cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={commitEdit}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
              >
                {t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
