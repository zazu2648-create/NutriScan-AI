import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type { FoodProduct, NutrientProfile } from '../types/nutrition';
import { getTodayDateKey } from '../utils/nutritionMath';

interface ManualProductModalProps {
  prefillBarcode?: string;
  language: LanguageCode;
  onSave: (product: FoodProduct) => Promise<void>;
  onClose: () => void;
}

export const ManualProductModal: React.FC<ManualProductModalProps> = ({
  prefillBarcode = '',
  language,
  onSave,
  onClose,
}) => {
  const t = TRANSLATIONS[language];
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(prefillBarcode);
  const [servingGrams, setServingGrams] = useState('100');
  const [packageGrams, setPackageGrams] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergensText, setAllergensText] = useState('');
  const [basis, setBasis] = useState<'per_100g' | 'per_serving'>('per_100g');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nutrients, setNutrients] = useState<NutrientProfile>({
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    sugarsG: null,
    addedSugarsG: null,
    fatG: null,
    saturatedFatG: null,
    transFatG: null,
    fiberG: null,
    sodiumMg: null,
    saltG: null,
  });

  const updateField = (key: keyof NutrientProfile, val: string) => {
    const parsed = val.trim() === '' ? null : Number(val);
    setNutrients((prev) => ({
      ...prev,
      [key]: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    setSaving(true);
    setError('');

    const sg = servingGrams ? Number(servingGrams) : 100;
    const pg = packageGrams ? Number(packageGrams) : null;

    const product: FoodProduct = {
      id: `manual_${Date.now()}`,
      barcode: barcode.trim() || undefined,
      name: name.trim(),
      brand: brand.trim() || undefined,
      servingSizeText: `${sg || 100} g`,
      servingSizeGrams: sg || 100,
      packageGrams: pg,
      nutrientsPer100g: basis === 'per_100g' ? nutrients : null,
      nutrientsPerServing: basis === 'per_serving' ? nutrients : null,
      ingredients: ingredients.trim() || undefined,
      allergens: allergensText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      dataSource: 'user_manual',
      isCustom: true,
      lastUpdated: getTodayDateKey(),
    };

    try {
      await onSave(product);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/15 dark:border-emerald-100/15 p-6 max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
            {t.scanner.actionAddManual}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-emerald-950/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                Product Name *
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                Brand
              </span>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.barcodeLabel}
              </span>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                Basis
              </span>
              <select
                value={basis}
                onChange={(e) =>
                  setBasis(e.target.value as 'per_100g' | 'per_serving')
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              >
                <option value="per_100g">{t.product.basisPer100g}</option>
                <option value="per_serving">{t.product.basisPerServing}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.servingSize} (g)
              </span>
              <input
                type="number"
                value={servingGrams}
                onChange={(e) => setServingGrams(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                Net Package Weight (g)
              </span>
              <input
                type="number"
                value={packageGrams}
                onChange={(e) => setPackageGrams(e.target.value)}
                placeholder="Optional e.g. 150"
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {(
              [
                ['caloriesKcal', `${t.product.calories} (kcal)`],
                ['proteinG', `${t.product.protein} (g)`],
                ['carbsG', `${t.product.carbohydrates} (g)`],
                ['sugarsG', `${t.product.totalSugars} (g)`],
                ['addedSugarsG', `${t.product.addedSugars} (g)`],
                ['fatG', `${t.product.totalFat} (g)`],
                ['saturatedFatG', `${t.product.saturatedFat} (g)`],
                ['transFatG', `${t.product.transFat} (g)`],
                ['fiberG', `${t.product.dietaryFiber} (g)`],
                ['sodiumMg', `${t.product.sodium} (mg)`],
                ['saltG', `${t.product.salt} (g)`],
              ] as Array<[keyof NutrientProfile, string]>
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-[#4C6154] dark:text-[#9BB5A4]">{label}</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="—"
                  value={nutrients[key] ?? ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full min-h-[38px] px-2.5 rounded-lg bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.ingredients}
              </span>
              <textarea
                rows={2}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                {t.product.allergens} (comma-separated)
              </span>
              <textarea
                rows={2}
                value={allergensText}
                onChange={(e) => setAllergensText(e.target.value)}
                placeholder="milk, soy, wheat"
                className="w-full p-2.5 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              />
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-emerald-950/15 text-sm font-medium cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {saving ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
