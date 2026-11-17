import React, { useState } from 'react';
import { AlertCircle, History, Loader2, Search, X } from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import { apiClient } from '../services/apiClient';
import type { FoodProduct } from '../types/nutrition';
import { ProductImage } from './ProductImage';

interface FoodSearchViewProps {
  language: LanguageCode;
  recentSearches: string[];
  onRecordSearch: (term: string) => void;
  onClearRecentSearches: () => void;
  onSelectProduct: (product: FoodProduct) => void;
}

const CATEGORY_FILTERS = [
  { id: 'all', labelEn: 'All', labelUr: 'سب' },
  { id: 'snacks', labelEn: 'Snacks & Chips', labelUr: 'اسنیکس اور چپس' },
  { id: 'beverages', labelEn: 'Beverages', labelUr: 'مشروبات' },
  { id: 'dairies', labelEn: 'Dairy', labelUr: 'ڈیری' },
  { id: 'cereals', labelEn: 'Cereals', labelUr: 'اناج' },
  { id: 'noodles', labelEn: 'Noodles', labelUr: 'نوڈلز' },
  { id: 'biscuits-and-cakes', labelEn: 'Biscuits & Chocolate', labelUr: 'بسکٹ اور چاکلیٹ' },
];

export const FoodSearchView: React.FC<FoodSearchViewProps> = ({
  language,
  recentSearches,
  onRecordSearch,
  onClearRecentSearches,
  onSelectProduct,
}) => {
  const t = TRANSLATIONS[language];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  const executeSearch = async (term: string, cat = category) => {
    const clean = term.trim();
    if (!clean && cat === 'all') return;
    setLoading(true);
    setError('');
    setHasSearched(true);
    if (clean) onRecordSearch(clean);

    try {
      const data = await apiClient.searchFood(clean, cat);
      setResults(data.results || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to search food database.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
          {t.search.title}
        </h1>
        <p className="text-sm text-[#4C6154] dark:text-[#9BB5A4]">
          {t.search.subtitle}
        </p>
      </div>

      <div className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-5 sm:p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executeSearch(query, category);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#4C6154] dark:text-[#9BB5A4] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search.placeholder}
              className="w-full min-h-[46px] ps-10 pe-9 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 dark:border-emerald-100/15 text-sm text-[#111C16] dark:text-[#EDF4EF] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-[#4C6154] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? t.common.loading : t.search.searchBtn}
          </button>
        </form>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.id);
                if (query.trim() || cat.id !== 'all') {
                  void executeSearch(query, cat.id);
                }
              }}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                category === cat.id
                  ? 'bg-[#14532D] text-white dark:bg-[#15803D]'
                  : 'bg-[#F2F6F3] dark:bg-[#192A20] text-[#4C6154] dark:text-[#9BB5A4] hover:text-[#111C16]'
              }`}
            >
              {language === 'ur' ? cat.labelUr : cat.labelEn}
            </button>
          ))}
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="pt-2 border-t border-emerald-950/10 dark:border-emerald-100/10 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#4C6154] dark:text-[#9BB5A4] inline-flex items-center gap-1">
              <History className="w-3.5 h-3.5" />
              <span>{t.search.recentSearches}:</span>
            </span>
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  void executeSearch(term, category);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#F6F8F7] dark:bg-[#192A20] text-xs font-medium text-[#111C16] dark:text-[#EDF4EF] hover:bg-emerald-950/10 cursor-pointer"
              >
                {term}
              </button>
            ))}
            <button
              type="button"
              onClick={onClearRecentSearches}
              className="text-xs text-[#15803D] dark:text-[#4ADE80] hover:underline ms-auto cursor-pointer"
            >
              {t.search.clearRecent}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-sm text-red-800 dark:text-red-200 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm text-[#4C6154] dark:text-[#9BB5A4]">
          <Loader2 className="w-6 h-6 animate-spin text-[#15803D]" />
          <span>{t.scanner.searchingDb}</span>
        </div>
      )}

      {!loading && !hasSearched && (
        <div className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-8 text-center space-y-4">
          <p className="text-sm text-[#4C6154] dark:text-[#9BB5A4] max-w-lg mx-auto">
            {t.search.startPrompt}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Lays Classic', 'Oreo', 'Greek Yogurt', 'Basmati Rice', 'Almonds'].map(
              (sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setQuery(sample);
                    void executeSearch(sample, 'all');
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] cursor-pointer"
                >
                  {sample}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <div className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-8 text-center text-sm text-[#4C6154] dark:text-[#9BB5A4]">
          {t.search.noResults}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((prod) => {
            const p100 = prod.nutrientsPer100g;
            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => onSelectProduct(prod)}
                className="text-left p-4 rounded-2xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 hover:border-[#15803D]/50 flex items-start gap-3.5 transition-colors cursor-pointer"
              >
                <ProductImage
                  src={prod.imageUrl}
                  alt={prod.name}
                  className="w-16 h-16 rounded-xl"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] font-medium text-[#15803D] dark:text-[#4ADE80] truncate">
                    {prod.dataSource === 'usda_fdc'
                      ? 'USDA FoodData Central'
                      : prod.dataSource === 'open_food_facts'
                        ? 'Open Food Facts'
                        : t.product.userManual}
                  </p>
                  <p className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF] line-clamp-2">
                    {prod.name}
                  </p>
                  <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] truncate">
                    {prod.brand || prod.category || ''}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-[#111C16] dark:text-[#EDF4EF]">
                    {p100?.caloriesKcal !== null && p100?.caloriesKcal !== undefined
                      ? `${p100.caloriesKcal} kcal`
                      : t.product.notReported}
                    {' · '}
                    {p100?.proteinG !== null && p100?.proteinG !== undefined
                      ? `P ${p100.proteinG}g`
                      : 'P —'}
                    {' · '}
                    {p100?.carbsG !== null && p100?.carbsG !== undefined
                      ? `C ${p100.carbsG}g`
                      : 'C —'}
                    {' · '}
                    {p100?.fatG !== null && p100?.fatG !== undefined
                      ? `F ${p100.fatG}g`
                      : 'F —'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
