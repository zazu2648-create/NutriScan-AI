import crypto from 'node:crypto';
import type { Response } from 'express';
import { Router } from 'express';
import type {
  AlternativeSuggestion,
  FoodProduct,
  NutrientProfile,
} from '../src/types/nutrition.ts';
import type { AuthenticatedRequest } from './auth.ts';
import { db } from './db.ts';

const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const OFF_USER_AGENT = 'NutriScanAI/1.0 (https://nutriscan.ai; contact@nutriscan.ai)';

function toNullableNumber(val: unknown, decimals = 2): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function parseServingGrams(servingSize?: string, servingQty?: unknown): number | null {
  const direct = toNullableNumber(servingQty, 1);
  if (direct && direct > 0) return direct;
  if (!servingSize) return null;
  const match = servingSize.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grams|ml)\b/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapOffNutrients(
  nutriments: Record<string, unknown> | undefined,
  suffix: '_100g' | '_serving'
): NutrientProfile | null {
  if (!nutriments) return null;

  const pick = (key: string): number | null => {
    const val = nutriments[`${key}${suffix}`];
    return toNullableNumber(val, 2);
  };

  let calories = pick('energy-kcal');
  if (calories === null) {
    const kj = pick('energy-kj') ?? pick('energy');
    if (kj !== null && kj > 0) {
      calories = Math.round(kj / 4.184);
    }
  } else {
    calories = Math.round(calories);
  }

  const proteinG = pick('proteins');
  const carbsG = pick('carbohydrates');
  const sugarsG = pick('sugars');
  const addedSugarsG = pick('added-sugars');
  const fatG = pick('fat');
  const saturatedFatG = pick('saturated-fat');
  const transFatG = pick('trans-fat');
  const fiberG = pick('fiber');

  // Open Food Facts reports sodium_100g and salt_100g in grams
  const sodiumGrams = pick('sodium');
  let saltG = pick('salt');
  let sodiumMg = sodiumGrams !== null ? Math.round(sodiumGrams * 1000) : null;

  if (sodiumMg === null && saltG !== null) {
    sodiumMg = Math.round(saltG * 400);
  }
  if (saltG === null && sodiumMg !== null) {
    saltG = Math.round((sodiumMg / 400) * 100) / 100;
  }

  const hasAny = [
    calories,
    proteinG,
    carbsG,
    sugarsG,
    fatG,
    fiberG,
    sodiumMg,
  ].some((v) => v !== null);

  if (!hasAny) return null;

  return {
    caloriesKcal: calories,
    proteinG,
    carbsG,
    sugarsG,
    addedSugarsG,
    fatG,
    saturatedFatG,
    transFatG,
    fiberG,
    sodiumMg,
    saltG,
  };
}

function mapOffProduct(raw: Record<string, unknown>): FoodProduct | null {
  const code = String(raw.code || raw._id || '').trim();
  const name = String(
    raw.product_name || raw.product_name_en || raw.generic_name || ''
  ).trim();
  if (!name) return null;

  const nutriments = raw.nutriments as Record<string, unknown> | undefined;
  const per100g = mapOffNutrients(nutriments, '_100g');
  const perServing = mapOffNutrients(nutriments, '_serving');

  const servingSizeText = raw.serving_size ? String(raw.serving_size).trim() : undefined;
  const servingSizeGrams = parseServingGrams(servingSizeText, raw.serving_quantity);
  const packageGrams = parseServingGrams(
    raw.quantity ? String(raw.quantity) : undefined,
    raw.product_quantity
  );

  const allergensRaw = Array.isArray(raw.allergens_tags)
    ? (raw.allergens_tags as string[]).map((t) =>
        t.replace(/^[a-z]{2}:/i, '').replace(/-/g, ' ')
      )
    : [];

  const categoryTags = Array.isArray(raw.categories_tags)
    ? (raw.categories_tags as string[])
    : [];

  const primaryCategory =
    categoryTags.length > 0
      ? categoryTags[categoryTags.length - 1]
          .replace(/^[a-z]{2}:/i, '')
          .replace(/-/g, ' ')
      : raw.categories
        ? String(raw.categories).split(',')[0].trim()
        : undefined;

  const lastModifiedTs = Number(raw.last_modified_t);
  const lastUpdated =
    Number.isFinite(lastModifiedTs) && lastModifiedTs > 0
      ? new Date(lastModifiedTs * 1000).toISOString().split('T')[0]
      : undefined;

  return {
    id: code ? `off_${code}` : `off_${crypto.randomUUID()}`,
    barcode: code || undefined,
    name,
    brand: raw.brands ? String(raw.brands).split(',')[0].trim() : undefined,
    imageUrl: raw.image_front_url
      ? String(raw.image_front_url)
      : raw.image_url
        ? String(raw.image_url)
        : undefined,
    category: primaryCategory,
    categoryTags,
    countries: raw.countries ? String(raw.countries) : undefined,
    ingredients: raw.ingredients_text
      ? String(raw.ingredients_text).trim()
      : undefined,
    allergens: allergensRaw,
    servingSizeText,
    servingSizeGrams,
    packageGrams,
    nutrientsPer100g: per100g,
    nutrientsPerServing: perServing,
    dataSource: 'open_food_facts',
    lastUpdated,
    attribution: 'Open Food Facts (ODbL)',
  };
}

interface UsdaFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

function mapUsdaProduct(raw: Record<string, unknown>): FoodProduct | null {
  const fdcId = raw.fdcId ? String(raw.fdcId) : '';
  const name = raw.description ? String(raw.description).trim() : '';
  if (!fdcId || !name) return null;

  const nutrientsList = Array.isArray(raw.foodNutrients)
    ? (raw.foodNutrients as UsdaFoodNutrient[])
    : [];

  const findByIds = (ids: number[], unitMatch?: string): number | null => {
    for (const id of ids) {
      const match = nutrientsList.find((n) => n.nutrientId === id);
      if (match && match.value !== undefined && match.value !== null) {
        if (unitMatch && match.unitName && match.unitName.toLowerCase() !== unitMatch) {
          continue;
        }
        return toNullableNumber(match.value, 2);
      }
    }
    return null;
  };

  const caloriesKcal = findByIds([1008, 2047, 2048], 'kcal');
  const proteinG = findByIds([1003]);
  const carbsG = findByIds([1005]);
  const sugarsG = findByIds([2000, 1063]);
  const addedSugarsG = findByIds([1235]);
  const fatG = findByIds([1004]);
  const saturatedFatG = findByIds([1258]);
  const transFatG = findByIds([1257]);
  const fiberG = findByIds([1079]);
  const sodiumMg = findByIds([1093]);
  const saltG =
    sodiumMg !== null ? Math.round((sodiumMg / 400) * 100) / 100 : null;

  const per100g: NutrientProfile = {
    caloriesKcal: caloriesKcal !== null ? Math.round(caloriesKcal) : null,
    proteinG,
    carbsG,
    sugarsG,
    addedSugarsG,
    fatG,
    saturatedFatG,
    transFatG,
    fiberG,
    sodiumMg: sodiumMg !== null ? Math.round(sodiumMg) : null,
    saltG,
  };

  const servingGrams = toNullableNumber(raw.servingSize, 1);
  const servingUnit = raw.servingSizeUnit ? String(raw.servingSizeUnit) : 'g';
  const servingText =
    raw.householdServingFullText
      ? String(raw.householdServingFullText)
      : servingGrams
        ? `${servingGrams} ${servingUnit}`
        : undefined;

  return {
    id: `usda_${fdcId}`,
    barcode: raw.gtinUpc ? String(raw.gtinUpc).trim() : undefined,
    name,
    brand: raw.brandOwner
      ? String(raw.brandOwner).trim()
      : raw.brandName
        ? String(raw.brandName).trim()
        : 'USDA Reference',
    category: raw.foodCategory ? String(raw.foodCategory) : undefined,
    ingredients: raw.ingredients ? String(raw.ingredients) : undefined,
    allergens: [],
    servingSizeText: servingText,
    servingSizeGrams: servingUnit.toLowerCase() === 'g' ? servingGrams : null,
    nutrientsPer100g: per100g,
    nutrientsPerServing: null,
    dataSource: 'usda_fdc',
    lastUpdated: raw.publishedDate ? String(raw.publishedDate) : undefined,
    attribution: 'USDA FoodData Central (CC0)',
  };
}

async function fetchOpenFoodFactsByBarcode(barcode: string): Promise<FoodProduct | null> {
  const fields = [
    'code',
    'product_name',
    'product_name_en',
    'generic_name',
    'brands',
    'image_front_url',
    'image_url',
    'serving_size',
    'serving_quantity',
    'quantity',
    'product_quantity',
    'countries',
    'ingredients_text',
    'allergens_tags',
    'categories',
    'categories_tags',
    'nutriments',
    'last_modified_t',
  ].join(',');

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': OFF_USER_AGENT },
    signal: AbortSignal.timeout(9000),
  });
  if (!resp.ok) {
    throw new Error(`Open Food Facts returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { status?: number; product?: Record<string, unknown> };
  if (data.status !== 1 || !data.product) {
    return null;
  }
  return mapOffProduct({ ...data.product, code: barcode });
}

async function fetchUsdaSearch(query: string, pageSize = 10): Promise<FoodProduct[]> {
  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(9000),
  });
  if (!resp.ok) {
    throw new Error(`USDA FoodData Central returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { foods?: Record<string, unknown>[] };
  if (!Array.isArray(data.foods)) return [];
  return data.foods
    .map(mapUsdaProduct)
    .filter((p): p is FoodProduct => p !== null);
}

async function fetchOffSearch(
  query: string,
  category?: string,
  pageSize = 20
): Promise<FoodProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    fields:
      'code,product_name,product_name_en,brands,image_front_url,image_url,serving_size,serving_quantity,quantity,product_quantity,countries,ingredients_text,allergens_tags,categories,categories_tags,nutriments,last_modified_t',
  });
  if (category && category !== 'all') {
    params.set('tagtype_0', 'categories');
    params.set('tag_contains_0', 'contains');
    params.set('tag_0', category);
  }

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': OFF_USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    throw new Error(`Open Food Facts search returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { products?: Record<string, unknown>[] };
  if (!Array.isArray(data.products)) return [];
  return data.products
    .map(mapOffProduct)
    .filter((p): p is FoodProduct => p !== null);
}

export const foodRouter = Router();

foodRouter.get('/barcode/:code', async (req: AuthenticatedRequest, res: Response) => {
  const code = String(req.params.code || '').replace(/\s+/g, '');
  if (!/^[a-zA-Z0-9\-_]{4,32}$/.test(code)) {
    res.status(400).json({ error: 'Invalid barcode format.' });
    return;
  }

  // 1. Check user/custom contributed products first
  const customRow = db
    .prepare('SELECT product_json FROM custom_products WHERE barcode = ? ORDER BY updated_at DESC LIMIT 1')
    .get(code) as { product_json: string } | undefined;
  if (customRow) {
    res.json({ found: true, product: JSON.parse(customRow.product_json), cached: true });
    return;
  }

  // 2. Check server-side product cache (24h TTL)
  const cachedRow = db
    .prepare('SELECT product_json, fetched_at FROM product_cache WHERE barcode = ?')
    .get(code) as { product_json: string; fetched_at: number } | undefined;
  if (cachedRow && Date.now() - cachedRow.fetched_at < PRODUCT_CACHE_TTL_MS) {
    res.json({ found: true, product: JSON.parse(cachedRow.product_json), cached: true });
    return;
  }

  let offError: string | null = null;
  let usdaError: string | null = null;

  // 3. Primary source: Open Food Facts API
  try {
    const product = await fetchOpenFoodFactsByBarcode(code);
    if (product) {
      db.prepare(
        'INSERT OR REPLACE INTO product_cache (barcode, source, product_json, fetched_at) VALUES (?, ?, ?, ?)'
      ).run(code, product.dataSource, JSON.stringify(product), Date.now());
      res.json({ found: true, product, cached: false });
      return;
    }
  } catch (err) {
    offError = err instanceof Error ? err.message : 'Open Food Facts lookup failed';
  }

  // 4. Secondary source: USDA FoodData Central GTIN/UPC query
  try {
    const usdaResults = await fetchUsdaSearch(code, 5);
    const exactMatch = usdaResults.find((p) => p.barcode === code) || usdaResults[0];
    if (exactMatch) {
      db.prepare(
        'INSERT OR REPLACE INTO product_cache (barcode, source, product_json, fetched_at) VALUES (?, ?, ?, ?)'
      ).run(code, exactMatch.dataSource, JSON.stringify(exactMatch), Date.now());
      res.json({ found: true, product: exactMatch, cached: false });
      return;
    }
  } catch (err) {
    usdaError = err instanceof Error ? err.message : 'USDA lookup failed';
  }

  // If stale cache exists and upstream failed, serve stale cache with warning
  if (cachedRow && (offError || usdaError)) {
    res.json({
      found: true,
      product: JSON.parse(cachedRow.product_json),
      cached: true,
      staleWarning: 'Served from local cache because upstream nutrition database was temporarily unreachable.',
    });
    return;
  }

  if (offError && usdaError) {
    res.status(502).json({
      found: false,
      error: `Unable to reach food databases (${offError}).`,
    });
    return;
  }

  res.json({ found: false, barcode: code });
});

foodRouter.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  const query = String(req.query.q || '').trim();
  const category = String(req.query.category || 'all').trim();

  if (!query && category === 'all') {
    res.status(400).json({ error: 'Search query or category is required.' });
    return;
  }

  const cacheKey = `${query.toLowerCase()}::${category.toLowerCase()}`;
  const cached = db
    .prepare('SELECT results_json, fetched_at FROM search_cache WHERE cache_key = ?')
    .get(cacheKey) as { results_json: string; fetched_at: number } | undefined;

  // Include matching custom products
  const customRows = db
    .prepare('SELECT product_json FROM custom_products ORDER BY updated_at DESC LIMIT 30')
    .all() as Array<{ product_json: string }>;
  const customMatches = customRows
    .map((r) => JSON.parse(r.product_json) as FoodProduct)
    .filter((p) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q))
      );
    });

  if (cached && Date.now() - cached.fetched_at < SEARCH_CACHE_TTL_MS) {
    const remote = JSON.parse(cached.results_json) as FoodProduct[];
    res.json({ results: [...customMatches, ...remote], cached: true });
    return;
  }

  const [offSettled, usdaSettled] = await Promise.allSettled([
    fetchOffSearch(query || category, category, 18),
    query ? fetchUsdaSearch(query, 8) : Promise.resolve([]),
  ]);

  const offResults = offSettled.status === 'fulfilled' ? offSettled.value : [];
  const usdaResults = usdaSettled.status === 'fulfilled' ? usdaSettled.value : [];

  if (
    offSettled.status === 'rejected' &&
    usdaSettled.status === 'rejected' &&
    customMatches.length === 0
  ) {
    res.status(502).json({
      error: 'Food databases are temporarily unreachable. Please check your connection or retry.',
    });
    return;
  }

  const combined = [...offResults, ...usdaResults];
  if (combined.length > 0) {
    db.prepare(
      'INSERT OR REPLACE INTO search_cache (cache_key, results_json, fetched_at) VALUES (?, ?, ?)'
    ).run(cacheKey, JSON.stringify(combined), Date.now());
  }

  res.json({
    results: [...customMatches, ...combined],
    cached: false,
    sourcesQueried: {
      openFoodFacts: offSettled.status === 'fulfilled',
      usdaFdc: usdaSettled.status === 'fulfilled',
    },
  });
});

foodRouter.get('/alternatives', async (req: AuthenticatedRequest, res: Response) => {
  const category = String(req.query.category || '').trim();
  const barcode = String(req.query.barcode || '').trim();
  const baseSugars = toNullableNumber(req.query.sugars, 1);
  const baseSodium = toNullableNumber(req.query.sodium, 0);
  const baseProtein = toNullableNumber(req.query.protein, 1);
  const baseFiber = toNullableNumber(req.query.fiber, 1);
  const baseCalories = toNullableNumber(req.query.calories, 0);

  if (!category || baseCalories === null) {
    res.json({ alternatives: [] });
    return;
  }

  try {
    const candidates = await fetchOffSearch(category, category, 20);
    const suggestions: AlternativeSuggestion[] = [];

    for (const candidate of candidates) {
      if (barcode && candidate.barcode === barcode) continue;
      const n = candidate.nutrientsPer100g;
      if (!n || n.caloriesKcal === null || n.proteinG === null) continue;

      const reasons: AlternativeSuggestion['reasons'] = [];

      if (
        baseSugars !== null &&
        baseSugars > 5 &&
        n.sugarsG !== null &&
        n.sugarsG <= baseSugars * 0.75 &&
        baseSugars - n.sugarsG >= 2
      ) {
        const diff = Math.round((baseSugars - n.sugarsG) * 10) / 10;
        reasons.push({
          metric: 'sugar',
          label: 'Lower sugar',
          deltaText: `-${diff}g sugar per 100g`,
        });
      }

      if (
        baseSodium !== null &&
        baseSodium > 200 &&
        n.sodiumMg !== null &&
        n.sodiumMg <= baseSodium * 0.75 &&
        baseSodium - n.sodiumMg >= 60
      ) {
        const diff = Math.round(baseSodium - n.sodiumMg);
        reasons.push({
          metric: 'sodium',
          label: 'Lower sodium',
          deltaText: `-${diff}mg sodium per 100g`,
        });
      }

      if (
        baseProtein !== null &&
        n.proteinG !== null &&
        n.proteinG >= baseProtein + 3
      ) {
        const diff = Math.round((n.proteinG - baseProtein) * 10) / 10;
        reasons.push({
          metric: 'protein',
          label: 'Higher protein',
          deltaText: `+${diff}g protein per 100g`,
        });
      }

      if (
        baseFiber !== null &&
        n.fiberG !== null &&
        n.fiberG >= baseFiber + 2
      ) {
        const diff = Math.round((n.fiberG - baseFiber) * 10) / 10;
        reasons.push({
          metric: 'fiber',
          label: 'Higher fiber',
          deltaText: `+${diff}g fiber per 100g`,
        });
      }

      if (reasons.length > 0) {
        suggestions.push({ product: candidate, reasons });
      }
      if (suggestions.length >= 3) break;
    }

    res.json({ alternatives: suggestions });
  } catch {
    res.json({ alternatives: [] });
  }
});

foodRouter.post('/custom', (req: AuthenticatedRequest, res: Response) => {
  const product = req.body as FoodProduct;
  if (!product || !product.name || product.name.trim().length < 2) {
    res.status(400).json({ error: 'Product name is required.' });
    return;
  }

  const now = new Date().toISOString();
  const id = product.id || `custom_${crypto.randomUUID()}`;
  const cleanBarcode = product.barcode ? product.barcode.trim() : null;
  const saved: FoodProduct = {
    ...product,
    id,
    barcode: cleanBarcode || undefined,
    isCustom: true,
    lastUpdated: now.split('T')[0],
  };

  db.prepare(
    'INSERT OR REPLACE INTO custom_products (id, user_id, barcode, product_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    req.authUser?.id || null,
    cleanBarcode,
    JSON.stringify(saved),
    now,
    now
  );

  res.status(201).json({ product: saved });
});
