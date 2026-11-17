import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { db, getDataDir } from './db.ts';

function resolveAuthSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  const secretPath = path.join(getDataDir(), '.auth_secret');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

const AUTH_SECRET = resolveAuthSecret();
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

interface TokenPayload {
  uid: string;
  email: string;
  exp: number;
}

function signToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  };
}

export function attachAuthUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    const payload = verifyToken(token);
    if (payload) {
      const row = db
        .prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
        .get(payload.uid) as
        | { id: string; email: string; name: string; created_at: string }
        | undefined;
      if (row) {
        req.authUser = {
          id: row.id,
          email: row.email,
          name: row.name,
          createdAt: row.created_at,
        };
      }
    }
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export const authRouter = Router();

authRouter.post('/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const rawPassword = String(password || '');

  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
    res.status(400).json({ error: 'Please enter a display name (2–80 characters).' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (rawPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(rawPassword);

  db.prepare(
    'INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, cleanEmail, cleanName, passwordHash, now, now);

  const token = signToken({
    uid: id,
    email: cleanEmail,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  res.status(201).json({
    token,
    user: { id, name: cleanName, email: cleanEmail, createdAt: now },
  });
});

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };
  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!cleanEmail || !rawPassword) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare('SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?')
    .get(cleanEmail) as
    | {
        id: string;
        email: string;
        name: string;
        password_hash: string;
        created_at: string;
      }
    | undefined;

  if (!row || !verifyPassword(rawPassword, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signToken({
    uid: row.id,
    email: row.email,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  res.json({
    token,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    },
  });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.authUser });
});

authRouter.delete('/account', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  db.prepare('DELETE FROM food_logs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_data WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM custom_products WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ deleted: true });
});
