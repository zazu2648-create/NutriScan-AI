import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { Request, Response } from 'express';
import { Router } from 'express';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseImagePayload(imageBase64: string, mimeType?: string) {
  let cleanBase64 = imageBase64.trim();
  let detectedMime = mimeType || 'image/jpeg';

  const dataUrlMatch = cleanBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    detectedMime = dataUrlMatch[1];
    cleanBase64 = dataUrlMatch[2];
  }

  return { data: cleanBase64, mimeType: detectedMime };
}

export const geminiRouter = Router();

geminiRouter.post('/analyze-food-photo', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add your key in Settings > Secrets.',
    });
    return;
  }

  const { imageBase64, mimeType, language } = req.body as {
    imageBase64?: string;
    mimeType?: string;
    language?: 'en' | 'ur';
  };

  if (!imageBase64 || imageBase64.length < 32) {
    res.status(400).json({ error: 'A valid food photo is required.' });
    return;
  }

  try {
    const imagePart = parseImagePayload(imageBase64, mimeType);
    const langInstruction =
      language === 'ur'
        ? 'Respond with food names and confidenceNote in natural Urdu script when possible, or clear bilingual names.'
        : 'Respond in clear English.';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          { inlineData: imagePart },
          {
            text: `Analyze this food photo. Identify every visible food component (including mixed-plate dishes, sides, drinks, or packaged snacks). Estimate reasonable serving weight in grams and estimated calories, protein, carbohydrates, sugars, total fat, saturated fat, fiber, and sodium (mg). Clearly treat every value as a visual AI estimate. ${langInstruction}`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are a careful nutrition-data engineer. Never claim visual food photo estimates are laboratory-verified facts. Split mixed meals into distinct editable food components.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealTitle: {
              type: Type.STRING,
              description: 'Concise overall title for the photographed meal or food.',
            },
            confidenceNote: {
              type: Type.STRING,
              description:
                'Brief note explaining visual estimation uncertainty (e.g., cooking oil, hidden sauces, or portion size assumptions).',
            },
            components: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  portionDescription: {
                    type: Type.STRING,
                    description: 'Human-friendly portion such as "1 medium bowl" or "2 slices".',
                  },
                  estimatedGrams: { type: Type.NUMBER },
                  caloriesKcal: { type: Type.NUMBER },
                  proteinG: { type: Type.NUMBER },
                  carbsG: { type: Type.NUMBER },
                  sugarsG: { type: Type.NUMBER, nullable: true },
                  fatG: { type: Type.NUMBER },
                  saturatedFatG: { type: Type.NUMBER, nullable: true },
                  fiberG: { type: Type.NUMBER, nullable: true },
                  sodiumMg: { type: Type.NUMBER, nullable: true },
                },
                required: [
                  'name',
                  'portionDescription',
                  'estimatedGrams',
                  'caloriesKcal',
                  'proteinG',
                  'carbsG',
                  'fatG',
                ],
              },
            },
          },
          required: ['mealTitle', 'confidenceNote', 'components'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const components = Array.isArray(parsed.components)
      ? parsed.components.map((c: Record<string, unknown>, idx: number) => ({
          id: `ai_comp_${Date.now()}_${idx}`,
          name: String(c.name || 'Food item'),
          portionDescription: String(c.portionDescription || '1 serving'),
          estimatedGrams: Math.max(1, Number(c.estimatedGrams) || 100),
          caloriesKcal: Math.max(0, Math.round(Number(c.caloriesKcal) || 0)),
          proteinG: Math.max(0, Math.round((Number(c.proteinG) || 0) * 10) / 10),
          carbsG: Math.max(0, Math.round((Number(c.carbsG) || 0) * 10) / 10),
          sugarsG: c.sugarsG !== null && c.sugarsG !== undefined ? Number(c.sugarsG) : null,
          fatG: Math.max(0, Math.round((Number(c.fatG) || 0) * 10) / 10),
          saturatedFatG:
            c.saturatedFatG !== null && c.saturatedFatG !== undefined
              ? Number(c.saturatedFatG)
              : null,
          fiberG: c.fiberG !== null && c.fiberG !== undefined ? Number(c.fiberG) : null,
          sodiumMg: c.sodiumMg !== null && c.sodiumMg !== undefined ? Math.round(Number(c.sodiumMg)) : null,
        }))
      : [];

    res.json({
      mealTitle: parsed.mealTitle || 'Photographed Meal',
      confidenceNote:
        parsed.confidenceNote ||
        'Values are AI estimates based on visual appearance and typical portion sizes.',
      components,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to analyze food photo.';
    res.status(502).json({ error: message });
  }
});

geminiRouter.post('/scan-nutrition-label', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add your key in Settings > Secrets.',
    });
    return;
  }

  const { imageBase64, mimeType } = req.body as {
    imageBase64?: string;
    mimeType?: string;
  };

  if (!imageBase64 || imageBase64.length < 32) {
    res.status(400).json({ error: 'A clear image of the nutrition label is required.' });
    return;
  }

  try {
    const imagePart = parseImagePayload(imageBase64, mimeType);

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          { inlineData: imagePart },
          {
            text: 'Perform high-precision OCR extraction on this packaged food nutrition label. Extract product name/brand if visible, serving size text and gram weight, whether the primary numeric column is per_100g or per_serving, calories (kcal), protein (g), carbohydrates (g), total sugars (g), added sugars (g), total fat (g), saturated fat (g), trans fat (g), dietary fiber (g), sodium (mg — convert from g if needed), salt (g), ingredients text, and allergens. CRITICAL: If a field is NOT visible or NOT printed on the label, return null. NEVER convert missing information into 0.',
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an OCR nutrition table extractor. Return null for any value not explicitly printed on the label. Never guess or convert missing fields into zero.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING, nullable: true },
            brand: { type: Type.STRING, nullable: true },
            servingSizeText: { type: Type.STRING, nullable: true },
            servingSizeGrams: { type: Type.NUMBER, nullable: true },
            basis: { type: Type.STRING, enum: ['per_100g', 'per_serving'] },
            caloriesKcal: { type: Type.NUMBER, nullable: true },
            proteinG: { type: Type.NUMBER, nullable: true },
            carbsG: { type: Type.NUMBER, nullable: true },
            sugarsG: { type: Type.NUMBER, nullable: true },
            addedSugarsG: { type: Type.NUMBER, nullable: true },
            fatG: { type: Type.NUMBER, nullable: true },
            saturatedFatG: { type: Type.NUMBER, nullable: true },
            transFatG: { type: Type.NUMBER, nullable: true },
            fiberG: { type: Type.NUMBER, nullable: true },
            sodiumMg: { type: Type.NUMBER, nullable: true },
            saltG: { type: Type.NUMBER, nullable: true },
            ingredients: { type: Type.STRING, nullable: true },
            allergens: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            extractionNotes: { type: Type.STRING },
          },
          required: ['basis', 'extractionNotes'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const numOrNull = (v: unknown): number | null =>
      v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

    let sodiumMg = numOrNull(parsed.sodiumMg);
    let saltG = numOrNull(parsed.saltG);
    if (sodiumMg === null && saltG !== null) {
      sodiumMg = Math.round(saltG * 400);
    }
    if (saltG === null && sodiumMg !== null) {
      saltG = Math.round((sodiumMg / 400) * 100) / 100;
    }

    res.json({
      productName: parsed.productName || null,
      brand: parsed.brand || null,
      servingSizeText: parsed.servingSizeText || null,
      servingSizeGrams: numOrNull(parsed.servingSizeGrams),
      basis: parsed.basis === 'per_100g' ? 'per_100g' : 'per_serving',
      nutrients: {
        caloriesKcal: numOrNull(parsed.caloriesKcal),
        proteinG: numOrNull(parsed.proteinG),
        carbsG: numOrNull(parsed.carbsG),
        sugarsG: numOrNull(parsed.sugarsG),
        addedSugarsG: numOrNull(parsed.addedSugarsG),
        fatG: numOrNull(parsed.fatG),
        saturatedFatG: numOrNull(parsed.saturatedFatG),
        transFatG: numOrNull(parsed.transFatG),
        fiberG: numOrNull(parsed.fiberG),
        sodiumMg,
        saltG,
      },
      ingredients: parsed.ingredients || null,
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens : [],
      extractionNotes:
        parsed.extractionNotes ||
        'Review extracted values against the physical label before saving.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract nutrition label.';
    res.status(502).json({ error: message });
  }
});
