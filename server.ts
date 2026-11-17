import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import type { FoodLogEntry, FoodProduct } from './src/types/nutrition.ts';
import {
  attachAuthUser,
  authRouter,
  requireAuth,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { db } from './server/db.ts';
import { foodRouter } from './server/foodApis.ts';
import { geminiRouter } from './server/geminiRoutes.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(attachAuthUser);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nutriscan-ai-api' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/products', foodRouter);
  app.use('/api/ai', geminiRouter);

  // Cloud Sync endpoints for signed-in users
  app.get('/api/sync/pull', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const userData = db
      .prepare('SELECT profile_json, goals_json, settings_json, updated_at FROM user_data WHERE user_id = ?')
      .get(userId) as
      | {
          profile_json: string;
          goals_json: string;
          settings_json: string;
          updated_at: string;
        }
      | undefined;

    const logs = db
      .prepare('SELECT entry_json FROM food_logs WHERE user_id = ? AND deleted = 0')
      .all(userId) as Array<{ entry_json: string }>;

    const favs = db
      .prepare('SELECT product_json FROM favorites WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Array<{ product_json: string }>;

    res.json({
      profile: userData ? JSON.parse(userData.profile_json) : null,
      goals: userData ? JSON.parse(userData.goals_json) : null,
      settings: userData ? JSON.parse(userData.settings_json) : null,
      logs: logs.map((r) => JSON.parse(r.entry_json) as FoodLogEntry),
      favorites: favs.map((r) => JSON.parse(r.product_json) as FoodProduct),
      syncedAt: new Date().toISOString(),
    });
  });

  app.post('/api/sync/push', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const { profile, goals, settings, logs, deletedLogIds, favorites } = req.body as {
      profile?: unknown;
      goals?: unknown;
      settings?: unknown;
      logs?: FoodLogEntry[];
      deletedLogIds?: string[];
      favorites?: FoodProduct[];
    };

    const now = new Date().toISOString();

    if (profile && goals && settings) {
      db.prepare(
        'INSERT OR REPLACE INTO user_data (user_id, profile_json, goals_json, settings_json, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        userId,
        JSON.stringify(profile),
        JSON.stringify(goals),
        JSON.stringify(settings),
        now
      );
    }

    if (Array.isArray(logs)) {
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO food_logs (id, user_id, date_key, meal_type, entry_json, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)'
      );
      for (const entry of logs) {
        if (entry?.id && entry?.dateKey) {
          stmt.run(
            entry.id,
            userId,
            entry.dateKey,
            entry.mealType,
            JSON.stringify(entry),
            now
          );
        }
      }
    }

    if (Array.isArray(deletedLogIds)) {
      const delStmt = db.prepare(
        'UPDATE food_logs SET deleted = 1, updated_at = ? WHERE user_id = ? AND id = ?'
      );
      for (const id of deletedLogIds) {
        delStmt.run(now, userId, id);
      }
    }

    if (Array.isArray(favorites)) {
      db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
      const favStmt = db.prepare(
        'INSERT OR REPLACE INTO favorites (user_id, product_id, product_json, created_at) VALUES (?, ?, ?, ?)'
      );
      for (const prod of favorites) {
        if (prod?.id) {
          favStmt.run(userId, prod.id, JSON.stringify(prod), now);
        }
      }
    }

    res.json({ syncedAt: now });
  });

  app.get('/api/export', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const userData = db
      .prepare('SELECT profile_json, goals_json, settings_json FROM user_data WHERE user_id = ?')
      .get(userId) as
      | { profile_json: string; goals_json: string; settings_json: string }
      | undefined;
    const logs = db
      .prepare('SELECT entry_json FROM food_logs WHERE user_id = ? AND deleted = 0')
      .all(userId) as Array<{ entry_json: string }>;
    const favs = db
      .prepare('SELECT product_json FROM favorites WHERE user_id = ?')
      .all(userId) as Array<{ product_json: string }>;

    res.json({
      exportedAt: new Date().toISOString(),
      user: req.authUser,
      profile: userData ? JSON.parse(userData.profile_json) : null,
      goals: userData ? JSON.parse(userData.goals_json) : null,
      settings: userData ? JSON.parse(userData.settings_json) : null,
      logs: logs.map((r) => JSON.parse(r.entry_json)),
      favorites: favs.map((r) => JSON.parse(r.product_json)),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriScan AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NutriScan AI server:', err);
  process.exit(1);
});
