import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import { apiClient, capturePhotoViaCapacitor, isNativeAndroid } from '../services/apiClient';
import type {
  AiFoodComponent,
  FoodLogEntry,
  FoodProduct,
  LabelOcrResult,
  MealType,
  NutrientProfile,
} from '../types/nutrition';
import { getTodayDateKey } from '../utils/nutritionMath';

interface PhotoScannerViewProps {
  initialMode: 'meal' | 'ocr';
  prefillBarcode?: string;
  language: LanguageCode;
  onLogEntries: (entries: FoodLogEntry[]) => void;
  onSaveCustomProduct: (product: FoodProduct) => Promise<void>;
  onClose: () => void;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve({
        base64: result,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export const PhotoScannerView: React.FC<PhotoScannerViewProps> = ({
  initialMode,
  prefillBarcode,
  language,
  onLogEntries,
  onSaveCustomProduct,
  onClose,
}) => {
  const t = TRANSLATIONS[language];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<'meal' | 'ocr'>(initialMode);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [imagePayload, setImagePayload] = useState<{
    base64: string;
    mimeType: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Meal photo AI state
  const [mealTitle, setMealTitle] = useState('');
  const [confidenceNote, setConfidenceNote] = useState('');
  const [components, setComponents] = useState<AiFoodComponent[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');

  // Nutrition label OCR state
  const [ocrResult, setOcrResult] = useState<LabelOcrResult | null>(null);
  const [ocrBarcode, setOcrBarcode] = useState(prefillBarcode || '');

  const handleSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const data = await fileToBase64(file);
      setImagePayload(data);
      setPreviewUrl(data.base64);
      setComponents([]);
      setOcrResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCaptureClick = async () => {
    setError('');
    if (isNativeAndroid()) {
      try {
        const cap = await capturePhotoViaCapacitor();
        if (cap) {
          const dataUrl = `data:${cap.mimeType};base64,${cap.base64}`;
          setImagePayload(cap);
          setPreviewUrl(dataUrl);
          setComponents([]);
          setOcrResult(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Camera capture cancelled.');
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const runAnalysis = async () => {
    if (!imagePayload) return;
    setAnalyzing(true);
    setError('');

    try {
      if (mode === 'meal') {
        const res = await apiClient.analyzeFoodPhoto(
          imagePayload.base64,
          imagePayload.mimeType,
          language
        );
        setMealTitle(res.mealTitle);
        setConfidenceNote(res.confidenceNote);
        setComponents(res.components);
      } else {
        const res = await apiClient.scanNutritionLabel(
          imagePayload.base64,
          imagePayload.mimeType
        );
        setOcrResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateComponent = (
    id: string,
    field: keyof AiFoodComponent,
    value: string | number
  ) => {
    setComponents((prev) =>
      prev.map((comp) => (comp.id === id ? { ...comp, [field]: value } : comp))
    );
  };

  const addEmptyComponent = () => {
    setComponents((prev) => [
      ...prev,
      {
        id: `ai_comp_${Date.now()}`,
        name: 'Added item',
        portionDescription: '1 serving',
        estimatedGrams: 100,
        caloriesKcal: 150,
        proteinG: 5,
        carbsG: 20,
        sugarsG: null,
        fatG: 5,
        saturatedFatG: null,
        fiberG: null,
        sodiumMg: null,
      },
    ]);
  };

  const handleLogMealComponents = () => {
    const dateKey = getTodayDateKey();
    const now = new Date().toISOString();
    const entries: FoodLogEntry[] = components.map((comp) => ({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      dateKey,
      mealType: selectedMeal,
      productId: comp.id,
      name: comp.name,
      brand: mealTitle || undefined,
      dataSource: 'ai_estimate',
      servingLabel: `${comp.portionDescription} (${comp.estimatedGrams} g)`,
      servingBasis: 'selected_quantity',
      gramsConsumed: comp.estimatedGrams,
      nutrients: {
        caloriesKcal: comp.caloriesKcal,
        proteinG: comp.proteinG,
        carbsG: comp.carbsG,
        sugarsG: comp.sugarsG,
        addedSugarsG: null,
        fatG: comp.fatG,
        saturatedFatG: comp.saturatedFatG,
        transFatG: null,
        fiberG: comp.fiberG,
        sodiumMg: comp.sodiumMg,
        saltG: null,
      },
      loggedAt: now,
    }));
    onLogEntries(entries);
    onClose();
  };

  const updateOcrNutrient = (key: keyof NutrientProfile, raw: string) => {
    if (!ocrResult) return;
    const val = raw.trim() === '' ? null : Number(raw);
    setOcrResult({
      ...ocrResult,
      nutrients: {
        ...ocrResult.nutrients,
        [key]: val !== null && Number.isFinite(val) ? val : null,
      },
    });
  };

  const handleSaveOcrProductAndLog = async () => {
    if (!ocrResult) return;
    const productName = ocrResult.productName?.trim() || 'Scanned Label Product';
    const servingGrams = ocrResult.servingSizeGrams || 100;

    const product: FoodProduct = {
      id: `ocr_${Date.now()}`,
      barcode: ocrBarcode.trim() || undefined,
      name: productName,
      brand: ocrResult.brand || undefined,
      servingSizeText: ocrResult.servingSizeText || `${servingGrams} g`,
      servingSizeGrams: servingGrams,
      nutrientsPer100g:
        ocrResult.basis === 'per_100g' ? ocrResult.nutrients : null,
      nutrientsPerServing:
        ocrResult.basis === 'per_serving' ? ocrResult.nutrients : null,
      ingredients: ocrResult.ingredients || undefined,
      allergens: ocrResult.allergens,
      dataSource: 'label_ocr',
      isCustom: true,
      lastUpdated: getTodayDateKey(),
    };

    await onSaveCustomProduct(product);

    const entry: FoodLogEntry = {
      id: `log_${Date.now()}`,
      dateKey: getTodayDateKey(),
      mealType: selectedMeal,
      productId: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      dataSource: 'label_ocr',
      servingLabel:
        ocrResult.basis === 'per_100g'
          ? '100 g'
          : ocrResult.servingSizeText || `${servingGrams} g`,
      servingBasis:
        ocrResult.basis === 'per_100g' ? 'per_100g' : 'per_serving',
      gramsConsumed: ocrResult.basis === 'per_100g' ? 100 : servingGrams,
      nutrients: ocrResult.nutrients,
      loggedAt: new Date().toISOString(),
    };

    onLogEntries([entry]);
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
            {t.photoScanner.title}
          </h1>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#E8EFEA] dark:bg-[#192A20]">
          <button
            type="button"
            onClick={() => {
              setMode('meal');
              setOcrResult(null);
            }}
            className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'meal'
                ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80] shadow-xs'
                : 'text-[#4C6154] dark:text-[#9BB5A4]'
            }`}
          >
            {t.photoScanner.tabMealPhoto}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('ocr');
              setComponents([]);
            }}
            className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'ocr'
                ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80] shadow-xs'
                : 'text-[#4C6154] dark:text-[#9BB5A4]'
            }`}
          >
            {t.photoScanner.tabLabelOcr}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upload / Capture Pane */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {mode === 'meal'
                ? t.photoScanner.mealPromptTitle
                : t.photoScanner.labelPromptTitle}
            </h2>
            <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] leading-relaxed">
              {mode === 'meal'
                ? t.photoScanner.mealPromptDesc
                : t.photoScanner.labelPromptDesc}
            </p>
          </div>

          {previewUrl ? (
            <div className="rounded-2xl overflow-hidden border border-emerald-950/10 dark:border-emerald-100/10 bg-black/5">
              <img
                src={previewUrl}
                alt="Captured food preview"
                className="w-full max-h-72 object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="h-48 rounded-2xl border-2 border-dashed border-emerald-950/15 dark:border-emerald-100/20 flex flex-col items-center justify-center text-center p-6 gap-2 text-[#4C6154] dark:text-[#9BB5A4]">
              {mode === 'meal' ? (
                <Camera className="w-8 h-8 text-[#15803D] dark:text-[#4ADE80]" />
              ) : (
                <FileText className="w-8 h-8 text-[#15803D] dark:text-[#4ADE80]" />
              )}
              <span className="text-xs">
                {mode === 'meal'
                  ? t.photoScanner.mealPromptTitle
                  : t.photoScanner.labelPromptTitle}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => void handleCaptureClick()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
              <span>{t.photoScanner.takePhoto}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
              <span>{t.photoScanner.uploadPhoto}</span>
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void handleSelectedFile(e)}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handleSelectedFile(e)}
            className="hidden"
          />

          <button
            type="button"
            disabled={!imagePayload || analyzing}
            onClick={() => void runAnalysis()}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.photoScanner.analyzing}</span>
              </>
            ) : (
              <span>
                {mode === 'meal'
                  ? t.photoScanner.analyzeMeal
                  : t.photoScanner.extractLabel}
              </span>
            )}
          </button>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Editable Extraction Results Pane */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-5">
          {mode === 'meal' && components.length > 0 && (
            <>
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                <p className="font-semibold">{t.photoScanner.aiEstimateBanner}</p>
                {confidenceNote && <p>{confidenceNote}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4C6154] dark:text-[#9BB5A4] mb-1">
                    {t.photoScanner.mealTitleLabel}
                  </label>
                  <input
                    type="text"
                    value={mealTitle}
                    onChange={(e) => setMealTitle(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 dark:border-emerald-100/15 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4C6154] dark:text-[#9BB5A4] mb-1">
                    {t.product.mealTarget}
                  </label>
                  <select
                    value={selectedMeal}
                    onChange={(e) => setSelectedMeal(e.target.value as MealType)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 dark:border-emerald-100/15 text-sm"
                  >
                    <option value="breakfast">{t.diary.breakfast}</option>
                    <option value="lunch">{t.diary.lunch}</option>
                    <option value="dinner">{t.diary.dinner}</option>
                    <option value="snacks">{t.diary.snacks}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {components.map((comp) => (
                  <div
                    key={comp.id}
                    className="p-4 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] border border-emerald-950/10 dark:border-emerald-100/10 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={comp.name}
                        onChange={(e) =>
                          updateComponent(comp.id, 'name', e.target.value)
                        }
                        className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-white dark:bg-[#0B120E] border border-emerald-950/10 text-sm font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setComponents((prev) =>
                            prev.filter((c) => c.id !== comp.id)
                          )
                        }
                        className="min-h-[38px] px-2.5 text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t.photoScanner.removeItem}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                      <label className="sm:col-span-2 space-y-1">
                        <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                          {t.photoScanner.portionLabel}
                        </span>
                        <input
                          type="text"
                          value={comp.portionDescription}
                          onChange={(e) =>
                            updateComponent(
                              comp.id,
                              'portionDescription',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#0B120E] border border-emerald-950/10"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                          {t.photoScanner.gramsLabel}
                        </span>
                        <input
                          type="number"
                          value={comp.estimatedGrams}
                          onChange={(e) =>
                            updateComponent(
                              comp.id,
                              'estimatedGrams',
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-full min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#0B120E] border border-emerald-950/10 font-mono tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                          kcal
                        </span>
                        <input
                          type="number"
                          value={comp.caloriesKcal}
                          onChange={(e) =>
                            updateComponent(
                              comp.id,
                              'caloriesKcal',
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-full min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#0B120E] border border-emerald-950/10 font-mono tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                          Protein (g)
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={comp.proteinG}
                          onChange={(e) =>
                            updateComponent(
                              comp.id,
                              'proteinG',
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-full min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#0B120E] border border-emerald-950/10 font-mono tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                          Carbs (g)
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={comp.carbsG}
                          onChange={(e) =>
                            updateComponent(
                              comp.id,
                              'carbsG',
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-full min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#0B120E] border border-emerald-950/10 font-mono tabular-nums"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={addEmptyComponent}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-emerald-950/15 dark:border-emerald-100/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.photoScanner.addComponent}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogMealComponents}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.photoScanner.logMealBtn}</span>
                </button>
              </div>
            </>
          )}

          {mode === 'ocr' && ocrResult && (
            <>
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs text-[#14532D] dark:text-emerald-200 space-y-1">
                <p className="font-semibold">{t.photoScanner.ocrBanner}</p>
                <p>{ocrResult.extractionNotes}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                    Product Name
                  </span>
                  <input
                    type="text"
                    value={ocrResult.productName || ''}
                    onChange={(e) =>
                      setOcrResult({ ...ocrResult, productName: e.target.value })
                    }
                    placeholder="Enter product name"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                    Brand
                  </span>
                  <input
                    type="text"
                    value={ocrResult.brand || ''}
                    onChange={(e) =>
                      setOcrResult({ ...ocrResult, brand: e.target.value })
                    }
                    placeholder="Brand name"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                    {t.product.barcodeLabel}
                  </span>
                  <input
                    type="text"
                    value={ocrBarcode}
                    onChange={(e) => setOcrBarcode(e.target.value)}
                    placeholder="Optional barcode"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                    {t.product.servingSize} (g)
                  </span>
                  <input
                    type="number"
                    value={ocrResult.servingSizeGrams ?? ''}
                    onChange={(e) =>
                      setOcrResult({
                        ...ocrResult,
                        servingSizeGrams: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    placeholder="e.g. 30"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
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
                    <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                      {label}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={ocrResult.nutrients[key] ?? ''}
                      placeholder="—"
                      onChange={(e) => updateOcrNutrient(key, e.target.value)}
                      className="w-full min-h-[38px] px-2.5 rounded-lg bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <select
                  value={selectedMeal}
                  onChange={(e) => setSelectedMeal(e.target.value as MealType)}
                  className="min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                >
                  <option value="breakfast">{t.diary.breakfast}</option>
                  <option value="lunch">{t.diary.lunch}</option>
                  <option value="dinner">{t.diary.dinner}</option>
                  <option value="snacks">{t.diary.snacks}</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleSaveOcrProductAndLog()}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.photoScanner.saveProductAndLog}</span>
                </button>
              </div>
            </>
          )}

          {((mode === 'meal' && components.length === 0) ||
            (mode === 'ocr' && !ocrResult)) && (
            <div className="py-12 text-center space-y-2 text-sm text-[#4C6154] dark:text-[#9BB5A4]">
              <p>
                {mode === 'meal'
                  ? t.photoScanner.mealPromptDesc
                  : t.photoScanner.labelPromptDesc}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
