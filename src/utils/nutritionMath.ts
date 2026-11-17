import type {
  ActivityLevel,
  BiologicalSex,
  FitnessGoal,
  FoodLogEntry,
  FoodProduct,
  NutrientProfile,
  NutritionGoals,
  ServingBasis,
  ServingMode,
  UserProfile,
} from '../types/nutrition';

export const EMPTY_NUTRIENTS: NutrientProfile = {
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
};

export function roundMetric(val: number | null | undefined, decimals = 1): number | null {
  if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
    return null;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function scaleNutrients(
  base: NutrientProfile | null | undefined,
  factor: number
): NutrientProfile {
  if (!base || !Number.isFinite(factor) || factor < 0) {
    return { ...EMPTY_NUTRIENTS };
  }
  const scale = (v: number | null | undefined, decimals = 1): number | null =>
    v === null || v === undefined || Number.isNaN(v) ? null : roundMetric(v * factor, decimals);

  return {
    caloriesKcal: scale(base.caloriesKcal, 0),
    proteinG: scale(base.proteinG, 1),
    carbsG: scale(base.carbsG, 1),
    sugarsG: scale(base.sugarsG, 1),
    addedSugarsG: scale(base.addedSugarsG, 1),
    fatG: scale(base.fatG, 1),
    saturatedFatG: scale(base.saturatedFatG, 1),
    transFatG: scale(base.transFatG, 2),
    fiberG: scale(base.fiberG, 1),
    sodiumMg: scale(base.sodiumMg, 0),
    saltG: scale(base.saltG, 2),
  };
}

/**
 * Normalizes a product's nutrients to per 100g whenever possible,
 * or falls back to per-serving math when only per-serving is available.
 */
export function getNutrientsPer100g(product: FoodProduct): NutrientProfile | null {
  if (product.nutrientsPer100g) {
    return product.nutrientsPer100g;
  }
  if (
    product.nutrientsPerServing &&
    product.servingSizeGrams &&
    product.servingSizeGrams > 0
  ) {
    return scaleNutrients(product.nutrientsPerServing, 100 / product.servingSizeGrams);
  }
  return null;
}

export interface CalculatedServingResult {
  grams: number;
  basis: ServingBasis;
  nutrients: NutrientProfile;
  basisDescription: string;
}

export function calculateProductServing(
  product: FoodProduct,
  mode: ServingMode,
  customGrams: number
): CalculatedServingResult {
  const per100 = getNutrientsPer100g(product);
  const servingG = product.servingSizeGrams && product.servingSizeGrams > 0
    ? product.servingSizeGrams
    : null;
  const packageG = product.packageGrams && product.packageGrams > 0
    ? product.packageGrams
    : null;

  if (mode === 'one_serving') {
    if (product.nutrientsPerServing && !per100) {
      return {
        grams: servingG ?? 100,
        basis: 'per_serving',
        nutrients: product.nutrientsPerServing,
        basisDescription: product.servingSizeText || '1 serving',
      };
    }
    const g = servingG ?? 100;
    if (product.nutrientsPerServing && servingG) {
      return {
        grams: g,
        basis: 'per_serving',
        nutrients: product.nutrientsPerServing,
        basisDescription: product.servingSizeText || `${g} g serving`,
      };
    }
    return {
      grams: g,
      basis: per100 ? 'per_serving' : 'selected_quantity',
      nutrients: scaleNutrients(per100, g / 100),
      basisDescription: product.servingSizeText || `${g} g`,
    };
  }

  if (mode === 'one_packet') {
    const g = packageG ?? servingG ?? 100;
    return {
      grams: g,
      basis: 'entire_package',
      nutrients: per100
        ? scaleNutrients(per100, g / 100)
        : scaleNutrients(product.nutrientsPerServing, servingG ? g / servingG : 1),
      basisDescription: `${g} g (1 packet)`,
    };
  }

  if (mode === 'half_packet') {
    const g = (packageG ?? servingG ?? 100) / 2;
    return {
      grams: roundMetric(g, 1) ?? 50,
      basis: 'selected_quantity',
      nutrients: per100
        ? scaleNutrients(per100, g / 100)
        : scaleNutrients(product.nutrientsPerServing, servingG ? g / servingG : 0.5),
      basisDescription: `${roundMetric(g, 1)} g (0.5 packet)`,
    };
  }

  if (mode === 'hundred_g') {
    return {
      grams: 100,
      basis: 'per_100g',
      nutrients: per100 ?? scaleNutrients(product.nutrientsPerServing, servingG ? 100 / servingG : 1),
      basisDescription: '100 g',
    };
  }

  if (mode === 'fifty_g') {
    return {
      grams: 50,
      basis: 'selected_quantity',
      nutrients: per100
        ? scaleNutrients(per100, 0.5)
        : scaleNutrients(product.nutrientsPerServing, servingG ? 50 / servingG : 0.5),
      basisDescription: '50 g',
    };
  }

  const safeCustom = Math.max(1, Math.min(5000, Number.isFinite(customGrams) ? customGrams : 100));
  return {
    grams: safeCustom,
    basis: safeCustom === 100 ? 'per_100g' : 'selected_quantity',
    nutrients: per100
      ? scaleNutrients(per100, safeCustom / 100)
      : scaleNutrients(product.nutrientsPerServing, servingG ? safeCustom / servingG : safeCustom / 100),
    basisDescription: `${safeCustom} g`,
  };
}

export interface ThresholdFlags {
  highSugar: boolean;
  highSodium: boolean;
  highSatFat: boolean;
}

/**
 * Evaluates general per-100g reference thresholds (configurable by user in Settings).
 * Defaults are aligned with common front-of-pack reference thresholds:
 * Sugar > 22.5 g / 100g, Sodium > 600 mg / 100g (1.5 g salt), Saturated fat > 5 g / 100g.
 */
export function evaluateNutrientIndicators(
  per100g: NutrientProfile | null | undefined,
  goals: NutritionGoals
): ThresholdFlags {
  if (!per100g) {
    return { highSugar: false, highSodium: false, highSatFat: false };
  }
  return {
    highSugar:
      per100g.sugarsG !== null && per100g.sugarsG >= goals.sugarThresholdPer100g,
    highSodium:
      per100g.sodiumMg !== null && per100g.sodiumMg >= goals.sodiumThresholdMgPer100g,
    highSatFat:
      per100g.saturatedFatG !== null &&
      per100g.saturatedFatG >= goals.satFatThresholdPer100g,
  };
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Calculates estimated daily calorie and macronutrient targets using
 * the Mifflin-St Jeor equation (an established general nutrition estimate, not a medical prescription).
 */
export function calculateEstimatedGoals(
  profile: UserProfile,
  existingThresholds?: Pick<
    NutritionGoals,
    'sugarThresholdPer100g' | 'sodiumThresholdMgPer100g' | 'satFatThresholdPer100g'
  >
): NutritionGoals {
  const weight = Math.max(30, Math.min(300, profile.weightKg || 70));
  const height = Math.max(100, Math.min(250, profile.heightCm || 170));
  const age = Math.max(13, Math.min(100, profile.age || 28));

  const sexOffset: Record<BiologicalSex, number> = {
    male: 5,
    female: -161,
    unspecified: -78,
  };

  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset[profile.sex];
  const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];

  let targetCalories = tdee;
  let proteinPerKg = 1.4;
  let fatRatio = 0.28;

  switch (profile.fitnessGoal) {
    case 'lose':
      targetCalories = Math.max(1200, tdee - 450);
      proteinPerKg = 1.7;
      fatRatio = 0.27;
      break;
    case 'gain':
      targetCalories = tdee + 350;
      proteinPerKg = 1.6;
      fatRatio = 0.28;
      break;
    case 'muscle':
      targetCalories = tdee + 250;
      proteinPerKg = 2.0;
      fatRatio = 0.25;
      break;
    case 'maintain':
    default:
      targetCalories = tdee;
      proteinPerKg = 1.4;
      fatRatio = 0.28;
      break;
  }

  const caloriesKcal = Math.round(targetCalories / 10) * 10;
  const proteinG = Math.round(weight * proteinPerKg);
  const fatG = Math.round((caloriesKcal * fatRatio) / 9);
  const remainingCals = Math.max(200, caloriesKcal - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingCals / 4);
  const fiberG = Math.max(20, Math.round((caloriesKcal / 1000) * 14));

  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    sugarThresholdPer100g: existingThresholds?.sugarThresholdPer100g ?? 22.5,
    sodiumThresholdMgPer100g: existingThresholds?.sodiumThresholdMgPer100g ?? 600,
    satFatThresholdPer100g: existingThresholds?.satFatThresholdPer100g ?? 5,
    isCustomTargets: false,
  };
}

export function sumDailyLogs(entries: FoodLogEntry[]) {
  return entries.reduce(
    (acc, entry) => ({
      caloriesKcal: acc.caloriesKcal + (entry.nutrients.caloriesKcal ?? 0),
      proteinG: roundMetric(acc.proteinG + (entry.nutrients.proteinG ?? 0), 1) ?? 0,
      carbsG: roundMetric(acc.carbsG + (entry.nutrients.carbsG ?? 0), 1) ?? 0,
      sugarsG: roundMetric(acc.sugarsG + (entry.nutrients.sugarsG ?? 0), 1) ?? 0,
      fatG: roundMetric(acc.fatG + (entry.nutrients.fatG ?? 0), 1) ?? 0,
      saturatedFatG:
        roundMetric(acc.saturatedFatG + (entry.nutrients.saturatedFatG ?? 0), 1) ?? 0,
      fiberG: roundMetric(acc.fiberG + (entry.nutrients.fiberG ?? 0), 1) ?? 0,
      sodiumMg: Math.round(acc.sodiumMg + (entry.nutrients.sodiumMg ?? 0)),
    }),
    {
      caloriesKcal: 0,
      proteinG: 0,
      carbsG: 0,
      sugarsG: 0,
      fatG: 0,
      saturatedFatG: 0,
      fiberG: 0,
      sodiumMg: 0,
    }
  );
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatNutrientValue(
  val: number | null | undefined,
  unit: string,
  notReportedLabel: string
): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return notReportedLabel;
  }
  return `${val} ${unit}`;
}
