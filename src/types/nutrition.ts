export type DataSourceType =
  | 'open_food_facts'
  | 'usda_fdc'
  | 'label_ocr'
  | 'ai_estimate'
  | 'user_manual';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type ServingBasis =
  | 'per_100g'
  | 'per_serving'
  | 'entire_package'
  | 'selected_quantity';

export type ServingMode =
  | 'one_serving'
  | 'one_packet'
  | 'half_packet'
  | 'hundred_g'
  | 'fifty_g'
  | 'custom_g';

export interface NutrientProfile {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  addedSugarsG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  saltG: number | null;
}

export interface FoodProduct {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
  categoryTags?: string[];
  countries?: string;
  ingredients?: string;
  allergens?: string[];
  servingSizeText?: string;
  servingSizeGrams?: number | null;
  packageGrams?: number | null;
  nutrientsPer100g?: NutrientProfile | null;
  nutrientsPerServing?: NutrientProfile | null;
  dataSource: DataSourceType;
  lastUpdated?: string;
  isCustom?: boolean;
  attribution?: string;
}

export interface AlternativeSuggestion {
  product: FoodProduct;
  reasons: Array<{
    metric: 'sugar' | 'sodium' | 'protein' | 'fiber';
    label: string;
    deltaText: string;
  }>;
}

export interface FoodLogEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD
  mealType: MealType;
  productId: string;
  barcode?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  dataSource: DataSourceType;
  servingLabel: string;
  servingBasis: ServingBasis;
  gramsConsumed: number;
  nutrients: NutrientProfile;
  loggedAt: string;
}

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type FitnessGoal = 'maintain' | 'lose' | 'gain' | 'muscle';

export type BiologicalSex = 'female' | 'male' | 'unspecified';

export interface UserProfile {
  name: string;
  age: number;
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
  onboardingCompleted: boolean;
}

export interface NutritionGoals {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarThresholdPer100g: number;
  sodiumThresholdMgPer100g: number;
  satFatThresholdPer100g: number;
  isCustomTargets: boolean;
}

export interface AppSettings {
  language: 'en' | 'ur';
  theme: 'light' | 'dark';
  unitSystem: 'metric' | 'imperial';
  notificationsEnabled: boolean;
  mealReminders: boolean;
  dailySummaryReminder: boolean;
  reminderTime: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AiFoodComponent {
  id: string;
  name: string;
  estimatedGrams: number;
  portionDescription: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  sugarsG: number | null;
  fatG: number;
  saturatedFatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
}

export interface AiFoodAnalysisResult {
  mealTitle: string;
  confidenceNote: string;
  components: AiFoodComponent[];
}

export interface LabelOcrResult {
  productName: string | null;
  brand: string | null;
  servingSizeText: string | null;
  servingSizeGrams: number | null;
  basis: 'per_100g' | 'per_serving';
  nutrients: NutrientProfile;
  ingredients: string | null;
  allergens: string[];
  extractionNotes: string;
}
