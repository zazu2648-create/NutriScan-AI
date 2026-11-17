import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Heart,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import { apiClient } from '../services/apiClient';
import type {
  AlternativeSuggestion,
  DataSourceType,
  FoodLogEntry,
  FoodProduct,
  MealType,
  NutritionGoals,
  ServingBasis,
  ServingMode,
} from '../types/nutrition';
import {
  calculateProductServing,
  evaluateNutrientIndicators,
  formatNutrientValue,
  getNutrientsPer100g,
  getTodayDateKey,
} from '../utils/nutritionMath';
import { ProductImage } from './ProductImage';

interface ProductDetailsViewProps {
  product: FoodProduct;
  goals: NutritionGoals;
  language: LanguageCode;
  isFavorite: boolean;
  onToggleFavorite: (product: FoodProduct) => void;
  onAddToLog: (entry: FoodLogEntry) => void;
  onSelectProduct: (product: FoodProduct) => void;
  onBack: () => void;
}

export const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  product,
  goals,
  language,
  isFavorite,
  onToggleFavorite,
  onAddToLog,
  onSelectProduct,
  onBack,
}) => {
  const t = TRANSLATIONS[language];
  const [servingMode, setServingMode] = useState<ServingMode>(
    product.servingSizeGrams || product.nutrientsPerServing
      ? 'one_serving'
      : 'hundred_g'
  );
  const [customGrams, setCustomGrams] = useState<number>(
    product.servingSizeGrams || 100
  );
  const [mealType, setMealType] = useState<MealType>('snacks');
  const [addedFeedback, setAddedFeedback] = useState(false);

  const [alternatives, setAlternatives] = useState<AlternativeSuggestion[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  useEffect(() => {
    setServingMode(
      product.servingSizeGrams || product.nutrientsPerServing
        ? 'one_serving'
        : 'hundred_g'
    );
    setCustomGrams(product.servingSizeGrams || 100);
    setAddedFeedback(false);

    let active = true;
    if (product.category && navigator.onLine) {
      setLoadingAlts(true);
      apiClient
        .getAlternatives(product)
        .then((list) => {
          if (active) setAlternatives(list);
        })
        .catch(() => {
          if (active) setAlternatives([]);
        })
        .finally(() => {
          if (active) setLoadingAlts(false);
        });
    } else {
      setAlternatives([]);
    }
    return () => {
      active = false;
    };
  }, [product]);

  const calc = calculateProductServing(product, servingMode, customGrams);
  const per100 = getNutrientsPer100g(product);
  const flags = evaluateNutrientIndicators(per100, goals);

  const basisLabelMap: Record<ServingBasis, string> = {
    per_100g: t.product.basisPer100g,
    per_serving: t.product.basisPerServing,
    entire_package: t.product.basisEntirePackage,
    selected_quantity: t.product.basisSelectedQty,
  };

  const sourceLabelMap: Record<DataSourceType, string> = {
    open_food_facts: `${t.product.verifiedDb} · Open Food Facts`,
    usda_fdc: `${t.product.verifiedDb} · USDA FoodData Central`,
    label_ocr: t.product.labelExtracted,
    ai_estimate: t.product.aiEstimate,
    user_manual: t.product.userManual,
  };

  const handleAdd = () => {
    const entry: FoodLogEntry = {
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
    };
    onAddToLog(entry);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const nutritionRows: Array<{ label: string; value: string; indent?: boolean; bold?: boolean }> = [
    {
      label: t.product.calories,
      value: formatNutrientValue(calc.nutrients.caloriesKcal, 'kcal', t.product.notReported),
      bold: true,
    },
    {
      label: t.product.protein,
      value: formatNutrientValue(calc.nutrients.proteinG, 'g', t.product.notReported),
      bold: true,
    },
    {
      label: t.product.carbohydrates,
      value: formatNutrientValue(calc.nutrients.carbsG, 'g', t.product.notReported),
      bold: true,
    },
    {
      label: t.product.totalSugars,
      value: formatNutrientValue(calc.nutrients.sugarsG, 'g', t.product.notReported),
      indent: true,
    },
    {
      label: t.product.addedSugars,
      value: formatNutrientValue(calc.nutrients.addedSugarsG, 'g', t.product.notReported),
      indent: true,
    },
    {
      label: t.product.totalFat,
      value: formatNutrientValue(calc.nutrients.fatG, 'g', t.product.notReported),
      bold: true,
    },
    {
      label: t.product.saturatedFat,
      value: formatNutrientValue(calc.nutrients.saturatedFatG, 'g', t.product.notReported),
      indent: true,
    },
    {
      label: t.product.transFat,
      value: formatNutrientValue(calc.nutrients.transFatG, 'g', t.product.notReported),
      indent: true,
    },
    {
      label: t.product.dietaryFiber,
      value: formatNutrientValue(calc.nutrients.fiberG, 'g', t.product.notReported),
    },
    {
      label: t.product.sodium,
      value: formatNutrientValue(calc.nutrients.sodiumMg, 'mg', t.product.notReported),
    },
    {
      label: t.product.salt,
      value: formatNutrientValue(calc.nutrients.saltG, 'g', t.product.notReported),
      indent: true,
    },
  ];

  const servingButtons: Array<{ mode: ServingMode; label: string }> = [
    { mode: 'one_serving', label: t.product.modeOneServing },
    { mode: 'one_packet', label: t.product.modeOnePacket },
    { mode: 'half_packet', label: t.product.modeHalfPacket },
    { mode: 'hundred_g', label: t.product.mode100g },
    { mode: 'fifty_g', label: t.product.mode50g },
    { mode: 'custom_g', label: t.product.modeCustom },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.common.back}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(product)}
          className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${
            isFavorite
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/40 text-[#14532D] dark:text-[#4ADE80]'
              : 'bg-white dark:bg-[#132019] border-emerald-950/15 dark:border-emerald-100/15 text-[#111C16] dark:text-[#EDF4EF]'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          <span>{isFavorite ? t.product.removeFavorite : t.product.addFavorite}</span>
        </button>
      </div>

      {/* Product Header Card */}
      <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 flex flex-col sm:flex-row gap-6 items-start">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl"
        />
        <div className="flex-1 min-w-0 space-y-2.5">
          <p className="text-xs font-medium text-[#15803D] dark:text-[#4ADE80]">
            {sourceLabelMap[product.dataSource]}
          </p>
          <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
            {product.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4C6154] dark:text-[#9BB5A4]">
            {product.brand && <span>{product.brand}</span>}
            {product.barcode && (
              <>
                {product.brand && <span aria-hidden="true">·</span>}
                <span className="font-mono tabular-nums">
                  {t.product.barcodeLabel}: {product.barcode}
                </span>
              </>
            )}
            {product.servingSizeText && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {t.product.servingSize}: {product.servingSizeText}
                </span>
              </>
            )}
            {product.countries && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {t.product.country}: {product.countries}
                </span>
              </>
            )}
            {product.lastUpdated && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {t.product.lastUpdated}: {product.lastUpdated}
                </span>
              </>
            )}
          </div>

          {/* Evidence-Based Visual Indicators (with explicit text & icon, never hue-only) */}
          {(flags.highSugar || flags.highSodium || flags.highSatFat) && (
            <div className="pt-2 space-y-2">
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-amber-800 dark:text-amber-200">
                {flags.highSugar && (
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{t.product.highSugar}</span>
                  </span>
                )}
                {flags.highSodium && (
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{t.product.highSodium}</span>
                  </span>
                )}
                {flags.highSatFat && (
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{t.product.highSatFat}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.indicatorDisclaimer}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Serving Calculator + Log CTA */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.product.servingCalculator}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {servingButtons.map((btn) => (
                <button
                  key={btn.mode}
                  type="button"
                  onClick={() => setServingMode(btn.mode)}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    servingMode === btn.mode
                      ? 'bg-[#14532D] text-white dark:bg-[#15803D]'
                      : 'bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] hover:bg-emerald-950/10'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {servingMode === 'custom_g' && (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={customGrams}
                  onChange={(e) => setCustomGrams(Number(e.target.value) || 1)}
                  className="w-32 min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                />
                <span className="text-sm text-[#4C6154] dark:text-[#9BB5A4]">g</span>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] text-xs space-y-1">
              <p className="text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.showingValuesFor}:{' '}
                <strong className="text-[#111C16] dark:text-[#EDF4EF] tabular-nums">
                  {calc.basisDescription}
                </strong>
              </p>
              <p className="font-medium text-[#15803D] dark:text-[#4ADE80]">
                {basisLabelMap[calc.basis]} ({calc.grams} g)
              </p>
            </div>

            <div className="pt-2 space-y-3 border-t border-emerald-950/10 dark:border-emerald-100/10">
              <label className="block text-xs font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.mealTarget}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealType[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMealType(m)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer truncate ${
                        mealType === m
                          ? 'bg-[#14532D] text-white'
                          : 'bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF]'
                      }`}
                    >
                      {t.diary[m]}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Logged ({calc.nutrients.caloriesKcal ?? 0} kcal)</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>{t.product.addToDiary}</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Ingredients & Allergens */}
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF] mb-1.5">
                {t.product.ingredients}
              </h3>
              <p className="text-xs leading-relaxed text-[#4C6154] dark:text-[#9BB5A4]">
                {product.ingredients || t.product.noIngredients}
              </p>
            </div>
            <div className="pt-3 border-t border-emerald-950/10 dark:border-emerald-100/10">
              <h3 className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF] mb-1.5">
                {t.product.allergens}
              </h3>
              <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] capitalize">
                {product.allergens && product.allergens.length > 0
                  ? product.allergens.join(' · ')
                  : t.product.noAllergens}
              </p>
            </div>
          </section>
        </div>

        {/* Professional Nutrition Facts Panel */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/15 dark:border-emerald-100/15 p-6">
            <div className="pb-3 border-b-4 border-[#111C16] dark:border-[#EDF4EF] flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
                {t.product.nutritionFacts}
              </h2>
              <span className="text-xs font-medium text-[#4C6154] dark:text-[#9BB5A4] tabular-nums">
                {calc.basisDescription}
              </span>
            </div>

            <div className="divide-y divide-emerald-950/10 dark:divide-emerald-100/10">
              {nutritionRows.map((row) => (
                <div
                  key={row.label}
                  className={`py-2.5 flex items-center justify-between gap-4 text-sm ${
                    row.indent ? 'ps-5 text-[#4C6154] dark:text-[#9BB5A4]' : ''
                  } ${
                    row.bold
                      ? 'font-semibold text-[#111C16] dark:text-[#EDF4EF]'
                      : ''
                  }`}
                >
                  <span>{row.label}</span>
                  <span className="font-mono tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Comparable Alternatives */}
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#111C16] dark:text-[#EDF4EF] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{t.product.healthyAlternatives}</span>
              </h3>
              <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.alternativesNote}
              </p>
            </div>

            {loadingAlts ? (
              <div className="flex items-center gap-2 text-xs text-[#4C6154] dark:text-[#9BB5A4] py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.product.loadingAlternatives}</span>
              </div>
            ) : alternatives.length === 0 ? (
              <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.noAlternatives}
              </p>
            ) : (
              <div className="space-y-2.5">
                {alternatives.map((alt) => (
                  <button
                    key={alt.product.id}
                    type="button"
                    onClick={() => onSelectProduct(alt.product)}
                    className="w-full text-left p-3.5 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] hover:bg-emerald-950/5 dark:hover:bg-white/10 flex items-center gap-3.5 cursor-pointer transition-colors"
                  >
                    <ProductImage
                      src={alt.product.imageUrl}
                      alt={alt.product.name}
                      className="w-12 h-12 rounded-xl"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF] truncate">
                        {alt.product.name}
                      </p>
                      <p className="text-xs text-[#15803D] dark:text-[#4ADE80] tabular-nums">
                        {alt.reasons.map((r) => r.deltaText).join(' · ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
